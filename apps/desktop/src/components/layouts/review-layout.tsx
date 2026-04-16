import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { ReviewFileList } from '../review/review-file-list';
import { ReviewDiffPanel } from '../review/review-diff-panel';
import { ReviewCommentsPanel } from '../review/review-comments-panel';

export function ReviewLayout() {
  return (
    <PanelGroup direction="horizontal">
      {/* Left: File list */}
      <Panel defaultSize={18} minSize={12} maxSize={28}>
        <div className="h-full rounded-lg bg-surface overflow-hidden">
          <ReviewFileList />
        </div>
      </Panel>

      <PanelResizeHandle className="w-1.5" />

      {/* Center: Diff viewer */}
      <Panel defaultSize={52} minSize={30}>
        <div className="h-full rounded-lg bg-surface overflow-hidden">
          <ReviewDiffPanel />
        </div>
      </Panel>

      <PanelResizeHandle className="w-1.5" />

      {/* Right: Score + Comments */}
      <Panel defaultSize={30} minSize={18} maxSize={40}>
        <div className="h-full rounded-lg bg-surface overflow-hidden">
          <ReviewCommentsPanel />
        </div>
      </Panel>
    </PanelGroup>
  );
}
