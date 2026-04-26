import { useDiagnosticsStore, type FileDiagnostics } from '../stores/diagnostics-store';

let initialized = false;

function uriToPath(uri: string): string {
  // file:///C:/Users/... → C:/Users/...
  let path = uri.replace(/^file:\/\//, '');
  // On Windows, paths may come as /C:/Users/... (leading slash)
  if (path.startsWith('/')) {
    path = path.slice(1);
  }
  return path.replace(/\//g, '\\');
}

function countMarkers(markers: Array<{ severity?: number }>): FileDiagnostics {
  let errors = 0;
  let warnings = 0;
  for (const m of markers) {
    if (m.severity === 8) errors++;      // monaco.MarkerSeverity.Error
    else if (m.severity === 4) warnings++; // monaco.MarkerSeverity.Warning
  }
  return { errors, warnings };
}

export function initDiagnosticsTracker(monaco: typeof import('monaco-editor')) {
  if (initialized) return;
  initialized = true;

  const originalSetModelMarkers = monaco.editor.setModelMarkers;

  monaco.editor.setModelMarkers = function (
    model: import('monaco-editor').editor.ITextModel,
    owner: string,
    markers: import('monaco-editor').editor.IMarkerData[],
  ) {
    originalSetModelMarkers.call(monaco.editor, model, owner, markers);

    const rawUri = model.uri.toString();
    const path = uriToPath(rawUri);
    const counts = countMarkers(markers);

    if (counts.errors === 0 && counts.warnings === 0) {
      useDiagnosticsStore.getState().clearDiagnostics(path);
    } else {
      useDiagnosticsStore.getState().setDiagnostics(path, counts);
    }
  };

  // Listen for model disposal to clear diagnostics immediately
  monaco.editor.onWillDisposeModel((model: import('monaco-editor').editor.ITextModel) => {
    const rawUri = model.uri.toString();
    const path = uriToPath(rawUri);
    useDiagnosticsStore.getState().clearDiagnostics(path);
  });
}
