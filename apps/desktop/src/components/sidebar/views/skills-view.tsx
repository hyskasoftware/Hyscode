import { useState, useEffect } from 'react';
import { Puzzle, ToggleLeft, ToggleRight, Globe, FolderOpen, Package } from 'lucide-react';

interface Skill {
  id: string;
  name: string;
  description: string;
  scope: 'builtin' | 'global' | 'workspace';
  enabled: boolean;
}

const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'code-completion',
    name: 'Code Completion',
    description: 'AI-powered code suggestions as you type',
    scope: 'builtin',
    enabled: true,
  },
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Automated code review with best practice checks',
    scope: 'builtin',
    enabled: true,
  },
  {
    id: 'refactor',
    name: 'Refactor',
    description: 'Intelligent code refactoring suggestions',
    scope: 'builtin',
    enabled: true,
  },
  {
    id: 'test-generation',
    name: 'Test Generation',
    description: 'Generate unit tests for functions and modules',
    scope: 'builtin',
    enabled: false,
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Auto-generate docs and comments',
    scope: 'builtin',
    enabled: false,
  },
  {
    id: 'git-assistant',
    name: 'Git Assistant',
    description: 'Smart commit messages and branch management',
    scope: 'global',
    enabled: true,
  },
  {
    id: 'terminal-helper',
    name: 'Terminal Helper',
    description: 'Command suggestions and error explanations',
    scope: 'global',
    enabled: true,
  },
];

const SCOPE_ICONS: Record<string, typeof Globe> = {
  builtin: Package,
  global: Globe,
  workspace: FolderOpen,
};

const SCOPE_LABELS: Record<string, string> = {
  builtin: 'Built-in',
  global: 'Global',
  workspace: 'Workspace',
};

export function SkillsView() {
  const [skills, setSkills] = useState<Skill[]>(DEFAULT_SKILLS);

  const toggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  };

  const grouped = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    if (!acc[s.scope]) acc[s.scope] = [];
    acc[s.scope].push(s);
    return acc;
  }, {});

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Skills
        </span>
        <span className="text-[10px] text-muted-foreground">
          {enabledCount}/{skills.length} active
        </span>
      </div>

      {/* Skills list */}
      <div className="flex-1 overflow-auto">
        {(['builtin', 'global', 'workspace'] as const).map((scope) => {
          const scopeSkills = grouped[scope];
          if (!scopeSkills || scopeSkills.length === 0) return null;

          const ScopeIcon = SCOPE_ICONS[scope];

          return (
            <div key={scope} className="border-b border-border">
              <div className="flex items-center gap-1.5 px-2 py-1">
                <ScopeIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {SCOPE_LABELS[scope]}
                </span>
              </div>

              {scopeSkills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => toggleSkill(skill.id)}
                  className="flex w-full items-start gap-2 px-2 py-1.5 text-left hover:bg-accent-muted transition-colors"
                >
                  <div className="mt-0.5 shrink-0">
                    {skill.enabled ? (
                      <ToggleRight className="h-4 w-4 text-accent" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-muted-foreground opacity-50" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-[11px] font-medium ${skill.enabled ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                      {skill.name}
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {skill.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          );
        })}

        {skills.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Puzzle className="mb-3 h-8 w-8 opacity-30" />
            <p className="text-xs">No skills installed</p>
          </div>
        )}
      </div>
    </div>
  );
}
