import { TitleBar } from './components/titlebar';
import { Sidebar } from './components/sidebar';
import { EditorArea } from './components/editor';
import { AgentPanel } from './components/agent';
import { TerminalPanel } from './components/terminal';
import { StatusBar } from './components/statusbar';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

export function App() {
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
