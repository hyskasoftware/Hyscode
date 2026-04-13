// ─── Skill Loader ───────────────────────────────────────────────────────────
// Loads skill definitions from built-in, global, and workspace directories.
// Parses YAML frontmatter from Markdown skill files.

import type { Skill, SkillFrontmatter, SkillScope, AgentType } from './types';

// ─── Frontmatter Parser ─────────────────────────────────────────────────────
// Lightweight YAML-subset parser for skill frontmatter.
// Only handles simple key: value pairs, arrays with - syntax.

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    return { frontmatter: {}, body: content };
  }

  const fmRaw = fmMatch[1];
  const body = fmMatch[2];
  const frontmatter: Record<string, unknown> = {};

  let currentKey = '';
  let currentArray: string[] | null = null;

  for (const line of fmRaw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Array item
    if (trimmed.startsWith('- ') && currentKey) {
      if (!currentArray) currentArray = [];
      currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
      frontmatter[currentKey] = currentArray;
      continue;
    }

    // Key: value
    const kvMatch = trimmed.match(/^(\w+)\s*:\s*(.*)$/);
    if (kvMatch) {
      // Save previous array if any
      currentArray = null;
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim().replace(/^["']|["']$/g, '');

      if (value === '') {
        // Might be followed by array items
        frontmatter[currentKey] = [];
        currentArray = frontmatter[currentKey] as string[];
      } else if (value === 'true') {
        frontmatter[currentKey] = true;
      } else if (value === 'false') {
        frontmatter[currentKey] = false;
      } else {
        frontmatter[currentKey] = value;
      }
    }
  }

  return { frontmatter, body };
}

function validateFrontmatter(fm: Record<string, unknown>, filePath: string): SkillFrontmatter {
  const name = (fm.name as string) || filePath.split('/').pop()?.replace('.md', '') || 'unknown';
  return {
    name,
    description: (fm.description as string) || '',
    version: (fm.version as string) || '1.0.0',
    scope: ((fm.scope as string) || 'built-in') as SkillScope,
    activation: ((fm.activation as string) || 'manual') as 'always' | 'manual' | 'trigger',
    trigger: fm.trigger as string | undefined,
    agents: fm.agents as AgentType[] | undefined,
    globs: fm.globs as string[] | undefined,
  };
}

// ─── Skill Loader ───────────────────────────────────────────────────────────

export type ReadDirFn = (path: string) => Promise<Array<{ name: string; is_dir: boolean }>>;
export type ReadFileFn = (path: string) => Promise<string>;
export type PathExistsFn = (path: string) => Promise<boolean>;

export interface SkillLoaderConfig {
  builtInPath: string;
  globalPath: string;
  workspacePath?: string;
  readDir: ReadDirFn;
  readFile: ReadFileFn;
  pathExists: PathExistsFn;
}

export class SkillLoader {
  private skills: Skill[] = [];
  private config: SkillLoaderConfig;

  constructor(config: SkillLoaderConfig) {
    this.config = config;
  }

  async loadAll(): Promise<Skill[]> {
    const builtIn = await this.loadFromDir(this.config.builtInPath, 'built-in');
    const global = await this.loadFromDir(this.config.globalPath, 'global');

    let workspace: Skill[] = [];
    if (this.config.workspacePath) {
      const wsSkillsPath = `${this.config.workspacePath}/.hyscode/skills`;
      workspace = await this.loadFromDir(wsSkillsPath, 'workspace');
    }

    // Merge: workspace > global > built-in (by name)
    this.skills = this.mergeSkills(builtIn, global, workspace);
    return this.skills;
  }

  getAll(): Skill[] {
    return this.skills;
  }

  getByName(name: string): Skill | undefined {
    return this.skills.find((s) => s.frontmatter.name === name);
  }

  getActive(): Skill[] {
    return this.skills.filter((s) => s.active);
  }

  /** Get skills that should be always-active for a given agent type */
  getAlwaysActive(agentType?: AgentType): Skill[] {
    return this.skills.filter((s) => {
      if (s.frontmatter.activation !== 'always') return false;
      if (s.frontmatter.agents && agentType) {
        return s.frontmatter.agents.includes(agentType);
      }
      return true;
    });
  }

  /** Activate a skill by name */
  activate(name: string): boolean {
    const skill = this.getByName(name);
    if (!skill) return false;
    skill.active = true;
    return true;
  }

  /** Deactivate a skill by name */
  deactivate(name: string): boolean {
    const skill = this.getByName(name);
    if (!skill) return false;
    skill.active = false;
    return true;
  }

  /** Check if a skill should be triggered based on user message */
  checkTriggers(userMessage: string): Skill[] {
    const triggered: Skill[] = [];

    for (const skill of this.skills) {
      if (skill.active) continue; // Already active
      if (skill.frontmatter.activation !== 'trigger') continue;
      if (!skill.frontmatter.trigger) continue;

      // Simple keyword matching from trigger string
      const triggerLower = skill.frontmatter.trigger.toLowerCase();
      const messageLower = userMessage.toLowerCase();

      // Extract keywords from trigger description
      // e.g. "when user mentions testing" → check for "testing"
      const keywords = triggerLower
        .replace(/^when\s+(user\s+)?(mentions?|asks?\s+about|discusses?|talks?\s+about)\s+/i, '')
        .split(/[,\s]+/)
        .filter((k) => k.length > 2);

      if (keywords.some((k) => messageLower.includes(k))) {
        triggered.push(skill);
      }
    }

    return triggered;
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async loadFromDir(dirPath: string, scope: SkillScope): Promise<Skill[]> {
    try {
      const exists = await this.config.pathExists(dirPath);
      if (!exists) return [];

      const entries = await this.config.readDir(dirPath);
      const skills: Skill[] = [];

      for (const entry of entries) {
        if (entry.is_dir || !entry.name.endsWith('.md')) continue;

        try {
          const filePath = `${dirPath}/${entry.name}`;
          const content = await this.config.readFile(filePath);
          const { frontmatter: fm, body } = parseFrontmatter(content);
          const frontmatter = validateFrontmatter(fm, filePath);
          frontmatter.scope = scope;

          skills.push({
            id: `${scope}:${frontmatter.name}`,
            frontmatter,
            content: body.trim(),
            filePath,
            active: frontmatter.activation === 'always',
          });
        } catch {
          // Skip invalid skill files
        }
      }

      return skills;
    } catch {
      return [];
    }
  }

  private mergeSkills(builtIn: Skill[], global: Skill[], workspace: Skill[]): Skill[] {
    const byName = new Map<string, Skill>();

    for (const skill of builtIn) {
      byName.set(skill.frontmatter.name, skill);
    }
    for (const skill of global) {
      byName.set(skill.frontmatter.name, skill);
    }
    for (const skill of workspace) {
      byName.set(skill.frontmatter.name, skill);
    }

    return Array.from(byName.values());
  }
}
