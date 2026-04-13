import { useState, useEffect } from 'react';
import { Puzzle, ToggleLeft, ToggleRight, Globe, FolderOpen, Package } from 'lucide-react';
import { useAgentStore } from '@/stores/agent-store';
import type { SkillScope } from '@hyscode/agent-harness';

interface SkillDisplay {
  id: string;
  name: string;
  description: string;
  scope: SkillScope;
  enabled: boolean;
}

// ─── Default built-in skills (from @hyscode/skills package) ─────────────────

const BUILTIN_SKILLS: SkillDisplay[] = [
  { id: 'code-style', name: 'Code Style', description: 'Enforce consistent coding patterns and best practices', scope: 'built-in', enabled: true },
  { id: 'testing', name: 'Testing', description: 'Guide test writing with framework-aware patterns', scope: 'built-in', enabled: true },
  { id: 'security', name: 'Security', description: 'Detect and prevent security vulnerabilities', scope: 'built-in', enabled: true },
  { id: 'git-workflow', name: 'Git Workflow', description: 'Smart commit messages, branch naming, and PR descriptions', scope: 'built-in', enabled: true },
  { id: 'performance', name: 'Performance', description: 'Identify and fix performance bottlenecks', scope: 'built-in', enabled: false },
  { id: 'documentation', name: 'Documentation', description: 'Auto-generate docs, comments, and READMEs', scope: 'built-in', enabled: false },
];

const SCOPE_ICONS: Record<SkillScope, typeof Globe> = {
  'built-in': Package,
  global: Globe,
  workspace: FolderOpen,
};

const SCOPE_LABELS: Record<SkillScope, string> = {
  'built-in': 'Built-in',
  global: 'Global',
  workspace: 'Workspace',
};

export function SkillsView() {
  const [skills, setSkills] = useState<SkillDisplay[]>(BUILTIN_SKILLS);
  const activeSkills = useAgentStore((s) => s.activeSkills);

  // Sync active state from store
  useEffect(() => {
    setSkills((prev) =>
      prev.map((s) => ({
        ...s,
        enabled: activeSkills.includes(s.id) || (s.scope === 'built-in' && s.enabled),
      })),
    );
  }, [activeSkills]);

  const toggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
    // Sync to store
    const skill = skills.find((s) => s.id === id);
    if (skill) {
      const currentActive = useAgentStore.getState().activeSkills;
      if (skill.enabled) {
        useAgentStore.getState().setActiveSkills(currentActive.filter((s) => s !== id));
      } else {
        useAgentStore.getState().setActiveSkills([...currentActive, id]);
      }
    }
  };

  const grouped = skills.reduce<Record<string, SkillDisplay[]>>((acc, s) => {
    if (!acc[s.scope]) acc[s.scope] = [];
    acc[s.scope].push(s);
    return acc;
  }, {});

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-raised px-2 py-1">
        <span className="text-[10px] text-muted-foreground">
          {enabledCount}/{skills.length} active
        </span>
      </div>

      {/* Skills list */}
      <div className="flex-1 overflow-auto">
        {(['built-in', 'global', 'workspace'] as const).map((scope) => {
          const scopeSkills = grouped[scope];
          if (!scopeSkills || scopeSkills.length === 0) return null;

          const ScopeIcon = SCOPE_ICONS[scope];

          return (
            <div key={scope} className="">
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
                  className="flex w-full items-start gap-2 px-2 py-1.5 text-left hover:bg-muted transition-colors"
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
