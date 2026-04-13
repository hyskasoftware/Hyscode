import { TitleBar } from './components/titlebar';
import { Sidebar } from './components/sidebar';
import { EditorArea } from './components/editor';
import { AgentPanel } from './components/agent';
import { TerminalPanel } from './components/terminal';
import { StatusBar } from './components/statusbar';
import { WelcomePage } from './components/welcome';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useProjectStore, useFileStore } from './stores';
import { useEffect } from 'react';
import { pickFolder } from './lib/tauri-dialog';

function IDE() {
  const projectRootPath = useProjectStore((s) => s.rootPath);
  const fileRootPath = useFileStore((s) => s.rootPath);
  const openFolder = useFileStore((s) => s.openFolder);

  // On mount: if fileStore is empty but projectStore has a path (from persistence),
  // reload the directory tree
  useEffect(() => {
    if (projectRootPath && !fileRootPath) {
      openFolder(projectRootPath).catch(console.error);
    }
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden p-1.5 pt-0">
        <PanelGroup direction="horizontal">
          {/* Sidebar */}
          <Panel defaultSize={16} minSize={12} maxSize={24}>
            <div className="h-full rounded-lg border border-border bg-surface">
              <Sidebar />
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5" />

          {/* Editor + Terminal stacked */}
          <Panel defaultSize={50} minSize={30}>
            <PanelGroup direction="vertical">
              <Panel defaultSize={65} minSize={25}>
                <div className="h-full rounded-lg border border-border bg-surface">
                  <EditorArea />
                </div>
              </Panel>

              <PanelResizeHandle className="h-1.5" />

              <Panel defaultSize={35} minSize={15}>
                <div className="h-full rounded-lg border border-border bg-surface">
                  <TerminalPanel />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-1.5" />

          {/* Agent — single unified block */}
          <Panel defaultSize={34} minSize={22} maxSize={50}>
            <div className="h-full rounded-lg border border-border bg-surface">
              <AgentPanel />
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <StatusBar />
    </div>
  );
}

export function App() {
  const rootPath = useProjectStore((s) => s.rootPath);
  const openProject = useProjectStore((s) => s.openProject);
  const openFolder = useFileStore((s) => s.openFolder);

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

  if (!rootPath) {
    return <WelcomePage />;
  }

  return <IDE />;
}
