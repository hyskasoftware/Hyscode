import { useEffect, useState, type ReactNode } from 'react';
import {
  X,
  Code2,
  Palette,
  Terminal,
  GitBranch,
  Settings2,
  BrainCircuit,
  Braces,
  Smartphone,
} from 'lucide-react';
import { useSettingsStore } from '../../stores';
import { EditorTab } from './tabs/editor-tab';
import { ThemeTab } from './tabs/theme-tab';
import { TerminalTab } from './tabs/terminal-tab';
import { GitTab } from './tabs/git-tab';
import { GeneralTab } from './tabs/general-tab';
import { AiTab } from './tabs/ai-tab';
import { LanguageServersTab } from './tabs/language-servers-tab';
import { MobileTab } from './tabs/mobile-tab';

type SettingsTab = 'editor' | 'theme' | 'terminal' | 'git' | 'general' | 'ai' | 'languages' | 'mobile';

const TAB_ITEMS: { id: SettingsTab; icon: typeof Code2; label: string }[] = [
  { id: 'editor', icon: Code2, label: 'Editor' },
  { id: 'theme', icon: Palette, label: 'Themes' },
  { id: 'languages', icon: Braces, label: 'Languages' },
  { id: 'terminal', icon: Terminal, label: 'Terminal' },
  { id: 'git', icon: GitBranch, label: 'Git' },
  { id: 'ai', icon: BrainCircuit, label: 'AI & Providers' },
  { id: 'mobile', icon: Smartphone, label: 'Mobile' },
  { id: 'general', icon: Settings2, label: 'General' },
];

const TAB_CONTENT: Record<SettingsTab, ReactNode> = {
  editor: <EditorTab />,
  theme: <ThemeTab />,
  languages: <LanguageServersTab />,
  terminal: <TerminalTab />,
  git: <GitTab />,
  ai: <AiTab />,
  mobile: <MobileTab />,
  general: <GeneralTab />,
};

export function SettingsModal() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const close = useSettingsStore((s) => s.closeSettings);
  const [activeTab, setActiveTab] = useState<SettingsTab>('editor');

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex h-[580px] w-[860px] overflow-hidden rounded-xl bg-surface shadow-2xl">
        {/* Left navigation */}
        <nav className="flex w-[200px] flex-col bg-background p-3">
          <div className="mb-4 flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Settings
            </span>
            <button
              onClick={close}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            {TAB_ITEMS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors ${
                  activeTab === id
                    ? 'bg-surface-raised text-foreground'
                    : 'text-muted-foreground hover:bg-surface-raised/50 hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Right content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tab header */}
          <div className="flex h-12 items-center border-b border-surface-raised px-6">
            <h2 className="text-[13px] font-semibold text-foreground">
              {TAB_ITEMS.find((t) => t.id === activeTab)?.label}
            </h2>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {TAB_CONTENT[activeTab]}
          </div>
        </div>
      </div>
    </div>
  );
}
