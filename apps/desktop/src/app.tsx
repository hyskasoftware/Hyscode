import { TitleBar } from './components/titlebar';
import { Sidebar } from './components/sidebar';
import { EditorArea } from './components/editor';
import { AgentPanel } from './components/agent';
import { TerminalPanel } from './components/terminal';
import { StatusBar } from './components/statusbar';
import { WelcomePage } from './components/welcome';
import { SettingsModal } from './components/settings';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { TooltipProvider } from './components/ui/tooltip';
import { useProjectStore, useFileStore, useSettingsStore } from './stores';
import { useEffect, useRef } from 'react';
import { pickFolder } from './lib/tauri-dialog';
import { initProviders } from './lib/init-providers';
import { HarnessBridge } from './lib/harness-bridge';

// ── Theme effect — applies CSS class on <html> whenever themeId changes ──────
const LIGHT_THEMES = new Set(['hyscode-light']);

function useThemeEffect() {
  const themeId = useSettingsStore((s) => s.themeId);
  useEffect(() => {
    const el = document.documentElement;
    // Remove any existing theme-* classes
    el.classList.forEach((cls) => {
      if (cls.startsWith('theme-')) el.classList.remove(cls);
    });
    el.classList.add(`theme-${themeId}`);
    // Toggle dark class for shadcn dark: variant support
    if (LIGHT_THEMES.has(themeId)) {
      el.classList.remove('dark');
    } else {
      el.classList.add('dark');
    }
  }, [themeId]);
}

function IDE() {
  const projectRootPath = useProjectStore((s) => s.rootPath);
  const fileRootPath = useFileStore((s) => s.rootPath);
  const openFolder = useFileStore((s) => s.openFolder);
  const bridgeInitRef = useRef(false);

  useThemeEffect();

  // On mount: if fileStore is empty but projectStore has a path (from persistence),
  // reload the directory tree
  useEffect(() => {
    if (projectRootPath && !fileRootPath) {
      openFolder(projectRootPath).catch(console.error);
    }
  }, []);

  // Initialize HarnessBridge when project is open
  useEffect(() => {
    if (!projectRootPath || bridgeInitRef.current) return;
    bridgeInitRef.current = true;
    const bridge = HarnessBridge.init(projectRootPath, projectRootPath);

    // Bootstrap skills and MCP tools asynchronously
    (async () => {
      try {
        await bridge.loadSkills();
      } catch (err) {
        console.warn('[App] Failed to load skills:', err);
      }
      try {
        await bridge.registerMcpTools();
      } catch (err) {
        console.warn('[App] Failed to register MCP tools:', err);
      }
    })();

    return () => {
      HarnessBridge.destroy();
      bridgeInitRef.current = false;
    };
  }, [projectRootPath]);

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden p-1.5 pt-0">
        <PanelGroup direction="horizontal">
          {/* Sidebar */}
          <Panel defaultSize={16} minSize={12} maxSize={24}>
            <div className="h-full rounded-lg bg-surface overflow-hidden">
              <Sidebar />
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5" />

          {/* Editor + Terminal stacked */}
          <Panel defaultSize={50} minSize={30}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={65} minSize={25}>
                <div className="h-full rounded-lg bg-surface overflow-hidden">
                  <EditorArea />
                </div>
              </Panel>

              <PanelResizeHandle className="h-1.5" />

              <Panel defaultSize={35} minSize={15}>
                <div className="h-full rounded-lg bg-surface overflow-hidden">
                  <TerminalPanel />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-1.5" />

          {/* Agent — single unified block */}
          <Panel defaultSize={34} minSize={22} maxSize={50}>
            <div className="h-full rounded-lg bg-surface overflow-hidden">
              <AgentPanel />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar />
      <SettingsModal />
    </div>
  );
}

export function App() {
  const rootPath = useProjectStore((s) => s.rootPath);
  const openProject = useProjectStore((s) => s.openProject);
  const openFolder = useFileStore((s) => s.openFolder);

  // Initialize AI providers on app startup (once)
  useEffect(() => {
    initProviders().catch(console.error);
  }, []);

  // Initialize AI providers on app startup (once)
  useEffect(() => {
    initProviders().catch(console.error);
  }, []);

  // Global keyboard shortcut: Ctrl+K Ctrl+O to open folder
  useEffect(() => {
    let waitingForO = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handler = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        waitingForO = true;
        timer = setTimeout(() => {
          waitingForO = false;
        }, 1000);
      } else if (waitingForO && (e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        waitingForO = false;
        if (timer) clearTimeout(timer);
        const path = await pickFolder();
        if (path) {
          openProject(path);
          await openFolder(path);
        }
      } else {
        waitingForO = false;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openProject, openFolder]);

  return (
    <TooltipProvider>
      {!rootPath ? <WelcomePage /> : <IDE />}
    </TooltipProvider>
  );
}
