// ─── Rule Loader ────────────────────────────────────────────────────────────
// Loads rule definitions from global and workspace directories.
// Rules are plain Markdown files (AGENTS.md-compatible) with no frontmatter.

import type { Rule, RuleScope } from './types';

export type ReadDirFn = (path: string) => Promise<Array<{ name: string; is_dir: boolean }>>;
export type ReadFileFn = (path: string) => Promise<string>;
export type PathExistsFn = (path: string) => Promise<boolean>;

export interface RuleLoaderConfig {
  globalPath: string;
  workspacePath?: string;
  readDir: ReadDirFn;
  readFile: ReadFileFn;
  pathExists: PathExistsFn;
}

export class RuleLoader {
  private rules: Rule[] = [];
  private config: RuleLoaderConfig;

  constructor(config: RuleLoaderConfig) {
    this.config = config;
  }

  async loadAll(): Promise<Rule[]> {
    const global = await this.loadFromDir(this.config.globalPath, 'global');

    let workspace: Rule[] = [];
    if (this.config.workspacePath) {
      const wsRulesPath = `${this.config.workspacePath}/.hyscode/rules`;
      workspace = await this.loadFromDir(wsRulesPath, 'workspace');
    }

    // Merge: workspace > global (by name)
    this.rules = this.mergeRules(global, workspace);
    return this.rules;
  }

  getAll(): Rule[] {
    return this.rules;
  }

  getById(id: string): Rule | undefined {
    return this.rules.find((r) => r.id === id);
  }

  getActive(): Rule[] {
    return this.rules.filter((r) => r.enabled);
  }

  /** Enable a rule by id */
  enable(id: string): boolean {
    const rule = this.getById(id);
    if (!rule) return false;
    rule.enabled = true;
    return true;
  }

  /** Disable a rule by id */
  disable(id: string): boolean {
    const rule = this.getById(id);
    if (!rule) return false;
    rule.enabled = false;
    return true;
  }

  /** Set enabled state for a rule by id */
  setEnabled(id: string, enabled: boolean): boolean {
    const rule = this.getById(id);
    if (!rule) return false;
    rule.enabled = enabled;
    return true;
  }

  /** Compute the file path for a new rule */
  getRulePath(name: string, scope: RuleScope): string {
    const dir = scope === 'global'
      ? this.config.globalPath
      : `${this.config.workspacePath}/.hyscode/rules`;
    return `${dir}/${name}.md`;
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async loadFromDir(dirPath: string, scope: RuleScope): Promise<Rule[]> {
    try {
      const exists = await this.config.pathExists(dirPath);
      if (!exists) return [];

      const entries = await this.config.readDir(dirPath);
      const rules: Rule[] = [];

      for (const entry of entries) {
        if (entry.is_dir || !entry.name.endsWith('.md')) continue;

        try {
          const filePath = `${dirPath}/${entry.name}`;
          const content = await this.config.readFile(filePath);
          const name = entry.name.replace(/\.md$/i, '');

          rules.push({
            id: `${scope}:${name}`,
            name,
            filePath,
            scope,
            content: content.trim(),
            enabled: true, // default; actual state managed by store
          });
        } catch {
          // Skip invalid rule files
        }
      }

      return rules;
    } catch {
      return [];
    }
  }

  private mergeRules(global: Rule[], workspace: Rule[]): Rule[] {
    const byName = new Map<string, Rule>();

    for (const rule of global) {
      byName.set(rule.name, rule);
    }
    for (const rule of workspace) {
      byName.set(rule.name, rule);
    }

    return Array.from(byName.values());
  }
}
