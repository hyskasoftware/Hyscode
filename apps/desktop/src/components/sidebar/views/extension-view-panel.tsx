import { useEffect, useState } from 'react';
import { LayoutList, RefreshCw, ChevronRight, ChevronDown, FileText, AlertCircle } from 'lucide-react';
import { useExtensionStore } from '../../../stores/extension-store';

interface TreeItem {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  icon?: string;
  children?: TreeItem[];
  command?: string;
  collapsible?: boolean;
}

interface ExtensionViewPanelProps {
  viewId: string;
}

function TreeNode({ item, depth = 0 }: { item: TreeItem; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;

  const handleClick = () => {
    if (hasChildren) {
      setExpanded(!expanded);
    } else if (item.command) {
      // Execute command via globalThis.hyscode
      const api = (globalThis as any).hyscode;
      if (api?.commands?.execute) {
        api.commands.execute(item.command);
      }
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-muted/50 transition-colors"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        title={item.tooltip || item.label}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : (
          <FileText className="h-3 w-3 shrink-0 text-muted-foreground/60" />
        )}
        <span className="truncate text-[11px] text-foreground">{item.label}</span>
        {item.description && (
          <span className="ml-auto truncate text-[10px] text-muted-foreground/60">
            {item.description}
          </span>
        )}
      </button>
      {hasChildren && expanded && (
        <div>
          {item.children!.map((child) => (
            <TreeNode key={child.id} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExtensionViewPanel({ viewId }: ExtensionViewPanelProps) {
  const extensionViews = useExtensionStore((s) => s.contributions.views);
  const viewDef = extensionViews.find((v) => v.id === viewId);
  const [treeData, setTreeData] = useState<TreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadViewData();
  }, [viewId]);

  function loadViewData() {
    setLoading(true);
    setError(null);

    try {
      // Check if the extension registered a view provider via the API
      const api = (globalThis as any).hyscode;
      if (api?.views?.getTreeData) {
        const data = api.views.getTreeData(viewId);
        if (data && Array.isArray(data)) {
          setTreeData(data);
          setLoading(false);
          return;
        }
      }

      // Also check the window-level view registry
      const viewRegistry = (globalThis as any).__hyscode_view_registry;
      if (viewRegistry && viewRegistry[viewId]) {
        const provider = viewRegistry[viewId];
        if (typeof provider.getTreeData === 'function') {
          const data = provider.getTreeData();
          if (data && Array.isArray(data)) {
            setTreeData(data);
            setLoading(false);
            return;
          }
        }
      }

      // No data yet — show placeholder
      setTreeData([]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!viewDef) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <AlertCircle className="h-5 w-5 text-muted-foreground/40" />
        <p className="text-[10px] text-muted-foreground/60">View not found: {viewId}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5">
        <div className="flex items-center gap-1.5">
          <LayoutList className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">
            {viewDef.name}
          </span>
        </div>
        <button
          onClick={loadViewData}
          className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="flex items-center gap-1.5 rounded bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && treeData.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <LayoutList className="h-6 w-6 text-muted-foreground/20" />
            <p className="text-[10px] text-muted-foreground/50 text-center px-4">
              {viewDef.name} is active. Open a workspace with relevant files to see content.
            </p>
            <button
              onClick={loadViewData}
              className="text-[10px] text-accent hover:text-accent/80 transition-colors"
            >
              Refresh
            </button>
          </div>
        )}

        {treeData.length > 0 && (
          <div className="space-y-0">
            {treeData.map((item) => (
              <TreeNode key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
