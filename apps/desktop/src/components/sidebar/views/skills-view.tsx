import { useState, useMemo, useCallback } from 'react';
import {
  ToggleLeft,
  ToggleRight,
  Globe,
  FolderOpen,
  Package,
  FileCode,
  Plus,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useSkillsStore, type SkillEntry } from '@/stores/skills-store';
import { useEditorStore } from '@/stores/editor-store';
import { useProjectStore } from '@/stores/project-store';
import { HarnessBridge } from '@/lib/harness-bridge';
import { tauriInvoke } from '@/lib/tauri-invoke';
import type { AgentType, SkillScope } from '@hyscode/agent-harness';
import { getViewerType } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────────────────

const SCOPE_ICONS: Record<SkillScope, typeof Globe> = {
  'built-in': Package,
  global: Globe,
  workspace: FolderOpen,
};

const SCOPE_LABELS: Record<SkillScope, string> = {
  'built-in': 'Built-in',
  global: 'Global (~/.agents/skills)',
  workspace: 'Workspace (.agents/skills)',
};

const AGENT_MODES: { value: AgentType; label: string }[] = [
  { value: 'chat', label: 'Chat' },
  { value: 'build', label: 'Build' },
  { value: 'review', label: 'Review' },
  { value: 'debug', label: 'Debug' },
  { value: 'plan', label: 'Plan' },
];

const NEW_SKILL_TEMPLATE = `---
name: my-skill
description: Describe what this skill does.
version: 1.0.0
scope: workspace
activation: manual
---

# My Skill

## Instructions

Add your skill instructions here.
`;

// ─── Component ──────────────────────────────────────────────────────────────

export function SkillsView() {
  const skills = useSkillsStore((s) => s.skills);
  const loading = useSkillsStore((s) => s.loading);
  const toggleSkill = useSkillsStore((s) => s.toggleSkill);
  const setSkillModes = useSkillsStore((s) => s.setSkillModes);
  const addSkill = useSkillsStore((s) => s.addSkill);

  const [collapsedScopes, setCollapsedScopes] = useState<Set<string>>(new Set());
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Group skills by scope
  const grouped = useMemo(() => {
    const groups: Record<string, SkillEntry[]> = {};
    for (const s of skills) {
      (groups[s.scope] ??= []).push(s);
    }
    return groups;
  }, [skills]);

  const enabledCount = useMemo(() => skills.filter((s) => s.enabled).length, [skills]);

  // ─── Handlers ─────────────────────────────────────────────────────

  const toggleScope = useCallback((scope: string) => {
    setCollapsedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  }, []);

  const handleOpenInEditor = useCallback((skill: SkillEntry) => {
    if (!skill.filePath) return;
    const fileName = skill.filePath.split('/').pop() ?? skill.name;
    useEditorStore.getState().openTab({
      id: skill.filePath,
      fileName,
      filePath: skill.filePath,
      language: 'markdown',
      viewerType: getViewerType(fileName),
    });
  }, []);

  const handleModeToggle = useCallback((skillId: string, mode: AgentType, currentModes: AgentType[]) => {
    const next = currentModes.includes(mode)
      ? currentModes.filter((m) => m !== mode)
      : [...currentModes, mode];
    setSkillModes(skillId, next);
  }, [setSkillModes]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const bridge = HarnessBridge.get();
      const discovered = await bridge.loadSkills();
      useSkillsStore.getState().setDiscoveredSkills(discovered);
    } catch (err) {
      console.warn('[SkillsView] Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleCreateSkill = useCallback(async () => {
    const workspacePath = useProjectStore.getState().rootPath;
    if (!workspacePath) return;

    const skillName = `new-skill-${Date.now()}`;
    const dirPath = `${workspacePath}/.agents/skills`;
    const filePath = `${dirPath}/${skillName}.md`;

    try {
      // Ensure directory exists
      try {
        await tauriInvoke('create_directory', { path: dirPath });
      } catch { /* may exist */ }

      await tauriInvoke('write_file', { path: filePath, content: NEW_SKILL_TEMPLATE });

      // Add to store
      addSkill({
        id: `workspace:${skillName}`,
        name: skillName,
        description: 'New skill',
        scope: 'workspace',
        enabled: true,
        filePath,
        content: NEW_SKILL_TEMPLATE,
        modes: [],
      });

      // Open in editor
      useEditorStore.getState().openTab({
        id: filePath,
        fileName: `${skillName}.md`,
        filePath,
        language: 'markdown',
        viewerType: 'code',
      });
    } catch (err) {
      console.error('[SkillsView] Failed to create skill:', err);
    }
  }, [addSkill]);

  // ─── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between bg-surface-raised px-2 py-1">
        <span className="text-[10px] text-muted-foreground">
          {enabledCount}/{skills.length} active
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Refresh skills"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleCreateSkill}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Create new workspace skill"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>
      </div>

      {/* Skills list */}
      <div className="flex-1 overflow-auto">
        {skills.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">
              No skills discovered yet.
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              Open a project or add skills to ~/.agents/skills/
            </p>
          </div>
        )}

        {(['built-in', 'global', 'workspace'] as const).map((scope) => {
          const scopeSkills = grouped[scope];
          if (!scopeSkills || scopeSkills.length === 0) return null;

          const ScopeIcon = SCOPE_ICONS[scope];
          const isCollapsed = collapsedScopes.has(scope);

          return (
            <div key={scope}>
              {/* Scope header */}
              <button
                onClick={() => toggleScope(scope)}
                className="flex w-full items-center gap-1.5 px-2 py-1 hover:bg-muted/50"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
                <ScopeIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {SCOPE_LABELS[scope]}
                </span>
                <span className="ml-auto text-[9px] text-muted-foreground/60">
                  {scopeSkills.filter((s) => s.enabled).length}/{scopeSkills.length}
                </span>
              </button>

              {/* Skill items */}
              {!isCollapsed &&
                scopeSkills.map((skill) => (
                  <SkillItem
                    key={skill.id}
                    skill={skill}
                    isExpanded={expandedSkill === skill.id}
                    onToggle={() => toggleSkill(skill.id)}
                    onExpand={() =>
                      setExpandedSkill(expandedSkill === skill.id ? null : skill.id)
                    }
                    onOpenEditor={() => handleOpenInEditor(skill)}
                    onModeToggle={(mode) => handleModeToggle(skill.id, mode, skill.modes)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Skill Item ─────────────────────────────────────────────────────────────

interface SkillItemProps {
  skill: SkillEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onOpenEditor: () => void;
  onModeToggle: (mode: AgentType) => void;
}

function SkillItem({ skill, isExpanded, onToggle, onExpand, onOpenEditor, onModeToggle }: SkillItemProps) {
  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div className="group flex w-full items-start gap-2 px-2 py-1.5 text-left transition-colors hover:bg-muted">
        {/* Toggle */}
        <button onClick={onToggle} className="mt-0.5 shrink-0" title={skill.enabled ? 'Disable' : 'Enable'}>
          {skill.enabled ? (
            <ToggleRight className="h-4 w-4 text-accent" />
          ) : (
            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* Info + expand */}
        <button onClick={onExpand} className="min-w-0 flex-1 text-left">
          <div className="truncate text-[11px] font-medium text-foreground">{skill.name}</div>
          <div className="truncate text-[10px] text-muted-foreground">{skill.description}</div>
          {/* Mode badges */}
          {skill.modes.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-0.5">
              {skill.modes.map((m) => (
                <span
                  key={m}
                  className="rounded bg-accent/10 px-1 py-0 text-[8px] font-medium text-accent"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </button>

        {/* Open in editor */}
        {skill.filePath && (
          <button
            onClick={onOpenEditor}
            className="mt-0.5 shrink-0 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
            title="Open in editor"
          >
            <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Expanded: per-mode assignment */}
      {isExpanded && (
        <div className="border-t border-border/20 bg-muted/30 px-3 py-2">
          <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
            Active in modes {skill.modes.length === 0 && '(all)'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AGENT_MODES.map(({ value, label }) => {
              const active = skill.modes.length === 0 || skill.modes.includes(value);
              return (
                <button
                  key={value}
                  onClick={() => onModeToggle(value)}
                  className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    active
                      ? 'bg-accent/15 text-accent hover:bg-accent/25'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {skill.modes.length > 0 && (
            <button
              onClick={() => useSkillsStore.getState().setSkillModes(skill.id, [])}
              className="mt-1.5 text-[9px] text-muted-foreground hover:text-foreground"
            >
              Reset to all modes
            </button>
          )}
        </div>
      )}
    </div>
  );
}
