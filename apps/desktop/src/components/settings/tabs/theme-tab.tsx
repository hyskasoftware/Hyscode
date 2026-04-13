import { Check } from 'lucide-react';
import { useSettingsStore } from '../../../stores';
import type { ThemeId } from '../../../stores/settings-store';

interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  colors: {
    bg: string;
    surface: string;
    sidebar: string;
    accent: string;
    fg: string;
    muted: string;
  };
}

const THEMES: ThemeOption[] = [
  {
    id: 'hyscode-dark',
    name: 'HysCode Dark',
    description: 'Default dark theme with purple accents',
    colors: {
      bg: '#0d0d0d',
      surface: '#181818',
      sidebar: '#111111',
      accent: '#a855f7',
      fg: '#e8e8e8',
      muted: '#888888',
    },
  },
  {
    id: 'hyscode-light',
    name: 'HysCode Light',
    description: 'Clean light theme for daytime work',
    colors: {
      bg: '#f5f5f5',
      surface: '#ffffff',
      sidebar: '#eaeaea',
      accent: '#7c3aed',
      fg: '#1a1a1a',
      muted: '#666666',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    description: 'Cool arctic blues inspired by the polar night',
    colors: {
      bg: '#2e3440',
      surface: '#3b4252',
      sidebar: '#292e39',
      accent: '#88c0d0',
      fg: '#d8dee9',
      muted: '#a0a8b7',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai',
    description: 'Classic warm theme with vibrant colors',
    colors: {
      bg: '#1e1f1c',
      surface: '#272822',
      sidebar: '#1a1b18',
      accent: '#f92672',
      fg: '#f8f8f2',
      muted: '#8f908a',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    description: 'Dark theme with purple-pink tones',
    colors: {
      bg: '#282a36',
      surface: '#2d2f3d',
      sidebar: '#21222c',
      accent: '#bd93f9',
      fg: '#f8f8f2',
      muted: '#a0a4b8',
    },
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    description: 'Dark theme inspired by GitHub interface',
    colors: {
      bg: '#0d1117',
      surface: '#161b22',
      sidebar: '#010409',
      accent: '#58a6ff',
      fg: '#c9d1d9',
      muted: '#8b949e',
    },
  },
];

export function ThemeTab() {
  const themeId = useSettingsStore((s) => s.themeId);
  const setThemeId = useSettingsStore((s) => s.setThemeId);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-muted-foreground">
        Choose a color theme for the entire application. Changes apply immediately.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {THEMES.map((theme) => {
          const isActive = themeId === theme.id;
          return (
            <button
              key={theme.id}
              onClick={() => setThemeId(theme.id)}
              className={`group relative flex flex-col overflow-hidden rounded-lg transition-all ${
                isActive
                  ? 'ring-2 ring-accent ring-offset-1 ring-offset-background'
                  : 'hover:ring-1 hover:ring-muted-foreground/30'
              }`}
            >
              {/* Theme preview */}
              <div
                className="flex h-24 w-full flex-col p-2"
                style={{ background: theme.colors.bg }}
              >
                {/* Mini layout preview */}
                <div className="flex flex-1 gap-1">
                  {/* Sidebar preview */}
                  <div
                    className="w-5 rounded-sm"
                    style={{ background: theme.colors.sidebar }}
                  />
                  {/* Editor preview */}
                  <div
                    className="flex flex-1 flex-col gap-1 rounded-sm p-1.5"
                    style={{ background: theme.colors.surface }}
                  >
                    {/* Fake code lines */}
                    <div className="flex gap-1">
                      <div
                        className="h-1 w-6 rounded-full"
                        style={{ background: theme.colors.accent, opacity: 0.8 }}
                      />
                      <div
                        className="h-1 w-10 rounded-full"
                        style={{ background: theme.colors.fg, opacity: 0.3 }}
                      />
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="h-1 w-3 rounded-full"
                        style={{ background: theme.colors.muted, opacity: 0.5 }}
                      />
                      <div
                        className="h-1 w-8 rounded-full"
                        style={{ background: theme.colors.fg, opacity: 0.25 }}
                      />
                      <div
                        className="h-1 w-5 rounded-full"
                        style={{ background: theme.colors.accent, opacity: 0.5 }}
                      />
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="h-1 w-8 rounded-full"
                        style={{ background: theme.colors.fg, opacity: 0.2 }}
                      />
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="h-1 w-4 rounded-full"
                        style={{ background: theme.colors.accent, opacity: 0.6 }}
                      />
                      <div
                        className="h-1 w-12 rounded-full"
                        style={{ background: theme.colors.fg, opacity: 0.15 }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Label */}
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ background: theme.colors.surface }}
              >
                {isActive && (
                  <Check
                    className="h-3 w-3 shrink-0"
                    style={{ color: theme.colors.accent }}
                  />
                )}
                <div className="flex flex-col items-start">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: theme.colors.fg }}
                  >
                    {theme.name}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: theme.colors.muted }}
                  >
                    {theme.description}
                  </span>
                </div>
              </div>

              {/* Color swatches */}
              <div
                className="flex gap-0 border-t"
                style={{
                  borderColor: `${theme.colors.muted}33`,
                  background: theme.colors.surface,
                }}
              >
                {[
                  theme.colors.bg,
                  theme.colors.surface,
                  theme.colors.sidebar,
                  theme.colors.accent,
                  theme.colors.fg,
                  theme.colors.muted,
                ].map((color, i) => (
                  <div
                    key={i}
                    className="h-2 flex-1"
                    style={{ background: color }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
