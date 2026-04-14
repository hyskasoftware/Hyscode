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
import { useProjectStore, useFileStore, useSettingsStore, useEditorStore } from './stores';
import { useSkillsStore } from './stores/skills-store';
import { useEffect, useRef } from 'react';
import { pickFolder, pickFile } from './lib/tauri-dialog';
import { initProviders } from './lib/init-providers';
import { HarnessBridge } from './lib/harness-bridge';
import { getViewerType } from './lib/utils';

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

    // HarnessBridge.init is async (resolves home dir via Rust)
    (async () => {
      try {
        const bridge = await HarnessBridge.init(projectRootPath, projectRootPath);
        const skills = await bridge.loadSkills();
        // Populate the skills store with discovered skills
        useSkillsStore.getState().setDiscoveredSkills(skills);
        await bridge.registerMcpTools();
      } catch (err) {
        console.warn('[App] Failed to initialize harness:', err);
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
  const closeProject = useProjectStore((s) => s.closeProject);
  const openFolder = useFileStore((s) => s.openFolder);
  const closeFolder = useFileStore((s) => s.closeFolder);
  const openUntitled = useEditorStore((s) => s.openUntitled);
  const openTab = useEditorStore((s) => s.openTab);
  const closeTab = useEditorStore((s) => s.closeTab);

  // Initialize AI providers on app startup (once)
  useEffect(() => {
    initProviders().catch(console.error);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    let waitingForSecond: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearChord = () => {
      waitingForSecond = null;
      if (timer) { clearTimeout(timer); timer = null; }
    };

    const handler = async (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // ── Ctrl+K chord sequences ──
      if (ctrl && e.key === 'k') {
        e.preventDefault();
        waitingForSecond = 'k';
        timer = setTimeout(clearChord, 1000);
        return;
      }

      if (waitingForSecond === 'k' && ctrl) {
        if (e.key === 'o') {
          // Ctrl+K Ctrl+O → Open Folder
          e.preventDefault();
          clearChord();
          const path = await pickFolder();
          if (path) {
            openProject(path);
            await openFolder(path);
          }
          return;
        }
        if (e.key === 'f') {
          // Ctrl+K F → Close Folder
          e.preventDefault();
          clearChord();
          closeProject();
          closeFolder();
          return;
        }
      }

      // Reset chord if a non-chord key was pressed
      if (waitingForSecond) {
        clearChord();
      }

      // ── Single key shortcuts ──
      if (ctrl && e.key === 'n') {
        // Ctrl+N → New untitled file
        e.preventDefault();
        openUntitled();
        return;
      }

      if (ctrl && e.key === 'o' && !e.shiftKey) {
        // Ctrl+O → Open file
        e.preventDefault();
        const path = await pickFile();
        if (path) {
          const sep = path.includes('/') ? '/' : '\\';
          const fileName = path.split(sep).pop() ?? 'file';
          const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
          openTab({
            id: path,
            filePath: path,
            fileName,
            language: ext || 'plaintext',
            viewerType: getViewerType(fileName),
          });
        }
        return;
      }

      if (e.key === 'F4' && ctrl) {
        // Ctrl+F4 → Close active editor tab
        e.preventDefault();
        const activeId = useEditorStore.getState().activeTabId;
        if (activeId) closeTab(activeId);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openProject, openFolder, closeProject, closeFolder, openUntitled, openTab, closeTab]);

  return (
    <TooltipProvider>
      {!rootPath ? <WelcomePage /> : <IDE />}
    </TooltipProvider>
  );
}
