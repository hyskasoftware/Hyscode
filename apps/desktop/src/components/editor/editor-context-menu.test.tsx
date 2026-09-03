/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EditorContextMenu } from './editor-context-menu';
import { useEditorStore } from '../../stores/editor-store';
import { useFileStore } from '../../stores/file-store';
import { useLspStore } from '../../stores/lsp-store';
import { useExtensionUiStore } from '../../stores/extension-ui-store';
import { tauriInvoke } from '../../lib/tauri-invoke';
import { writeClipboard } from '../../lib/utils';

vi.mock('../../lib/tauri-invoke', () => ({ tauriInvoke: vi.fn() }));
vi.mock('../../lib/tauri-fs', () => ({
  tauriFs: {
    statPath: vi.fn(),
    watch: vi.fn().mockResolvedValue(undefined),
    unwatch: vi.fn().mockResolvedValue(undefined),
    listDir: vi.fn().mockResolvedValue([]),
    readFile: vi.fn().mockResolvedValue(''),
  },
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }));
vi.mock('../../lib/utils', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../lib/utils')>();
  return { ...orig, writeClipboard: vi.fn().mockResolvedValue(undefined) };
});

const tauriInvokeMock = vi.mocked(tauriInvoke);
const writeClipboardMock = vi.mocked(writeClipboard);

interface FakeSelection {
  startLineNumber: number;
  endLineNumber: number;
  startColumn: number;
  endColumn: number;
}

function fakeEditor(selection: FakeSelection | null, selectedText: string | null) {
  const pushEditOperations = vi.fn();
  return {
    trigger: vi.fn(),
    focus: vi.fn(),
    pushEditOperations,
    getPosition: () => ({ lineNumber: 3, column: 5 }),
    getSelection: () => selection,
    getModel: () => ({
      getValue: () => 'const x = 1;',
      getValueInRange: () => selectedText ?? '',
      getFullModelRange: () => ({}),
      pushStackElement: () => {},
      pushEditOperations,
    }),
  };
}

function setCodeTab(filePath: string, language = 'plaintext') {
  useEditorStore.setState({
    tabs: [
      {
        id: filePath,
        filePath,
        fileName: filePath.split('/').pop() ?? filePath,
        language,
        isDirty: false,
        isPinned: false,
        isPreview: false,
        type: 'file',
        viewerType: 'code',
      },
    ],
    activeTabId: filePath,
  });
}

beforeEach(() => {
  useFileStore.setState({ rootPath: 'C:/proj' });
  useLspStore.setState({ serverStatuses: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useEditorStore.setState({ tabs: [], activeTabId: null });
  useFileStore.setState({ rootPath: null });
  useLspStore.setState({ serverStatuses: {} });
  useExtensionUiStore.setState({ contextMenuItems: [], formatters: [], notifications: [] });
});

describe('EditorContextMenu', () => {
  it('disables LSP actions for plaintext without a running server', () => {
    setCodeTab('C:/proj/notes.txt');
    const editor = fakeEditor(null, null);

    render(<EditorContextMenu x={10} y={10} editorInstance={editor} onClose={() => {}} />);

    expect(
      (screen.getByRole('menuitem', { name: /Go to Definition/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('menuitem', { name: /Rename Symbol/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('menuitem', { name: /Show Code Actions/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    // Clipboard stays available (accessible name concatenates label + shortcut).
    expect(
      (screen.getByRole('menuitem', { name: 'CopyCtrl+C' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('keeps navigation enabled for TypeScript via native intelligence', () => {
    setCodeTab('C:/proj/app.ts', 'typescript');
    const editor = fakeEditor(null, null);

    render(<EditorContextMenu x={10} y={10} editorInstance={editor} onClose={() => {}} />);

    expect(
      (screen.getByRole('menuitem', { name: /Go to Definition/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(
      (screen.getByRole('menuitem', { name: /Rename Symbol/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('enables navigation for other languages once the LSP server is ready', () => {
    setCodeTab('C:/proj/main.rs', 'rust');
    useLspStore.setState({
      serverStatuses: {
        rust: {
          serverId: 'lsp-rust',
          languageId: 'rust',
          displayName: 'rust-analyzer',
          status: 'ready',
          source: 'builtin',
        },
      },
    });
    const editor = fakeEditor(null, null);

    render(<EditorContextMenu x={10} y={10} editorInstance={editor} onClose={() => {}} />);

    expect(
      (screen.getByRole('menuitem', { name: /Go to Definition/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('triggers the Monaco navigation action on click', () => {
    setCodeTab('C:/proj/app.ts', 'typescript');
    const editor = fakeEditor(null, null);
    const onClose = vi.fn();

    render(<EditorContextMenu x={10} y={10} editorInstance={editor} onClose={onClose} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /Go to Definition/ }));

    expect(editor.trigger).toHaveBeenCalledWith('contextMenu', 'editor.action.revealDefinition');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables Copy and Trim without a selection and copies trimmed text with one', () => {
    setCodeTab('C:/proj/app.ts', 'typescript');

    const { unmount } = render(
      <EditorContextMenu x={10} y={10} editorInstance={fakeEditor(null, null)} onClose={() => {}} />,
    );
    expect(
      (screen.getByRole('menuitem', { name: /Copy and Trim/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    unmount();

    render(
      <EditorContextMenu
        x={10}
        y={10}
        editorInstance={fakeEditor(
          { startLineNumber: 1, endLineNumber: 2, startColumn: 1, endColumn: 3 },
          'hello   \nworld\t',
        )}
        onClose={() => {}}
      />,
    );
    const item = screen.getByRole('menuitem', { name: /Copy and Trim/ });
    expect((item as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(item);
    expect(writeClipboardMock).toHaveBeenCalledWith('hello\nworld');
  });

  it('copies path with line and selection range', () => {
    setCodeTab('C:/proj/app.ts', 'typescript');
    const editor = fakeEditor(
      { startLineNumber: 3, endLineNumber: 3, startColumn: 2, endColumn: 9 },
      'selected',
    );

    render(<EditorContextMenu x={10} y={10} editorInstance={editor} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /Copy Path with Line/ }));

    expect(writeClipboardMock).toHaveBeenCalledWith('C:/proj/app.ts:3:2-9');
  });

  it('filters extension items by when-clause', () => {
    setCodeTab('C:/proj/app.ts', 'typescript');
    const { dispose } = useExtensionUiStore.getState().addContextMenuItem('test-ext', {
      id: 'sel-action',
      label: 'Selection Action',
      when: 'editorHasSelection',
      handler: () => {},
    });

    const { unmount } = render(
      <EditorContextMenu x={10} y={10} editorInstance={fakeEditor(null, null)} onClose={() => {}} />,
    );
    expect(screen.queryByRole('menuitem', { name: /Selection Action/ })).toBeNull();
    unmount();

    render(
      <EditorContextMenu
        x={10}
        y={10}
        editorInstance={fakeEditor(
          { startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 4 },
          'abc',
        )}
        onClose={() => {}}
      />,
    );
    expect(
      (screen.getByRole('menuitem', { name: /Selection Action/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
    dispose();
  });

  it('applies formatter output and marks the tab dirty', async () => {
    setCodeTab('C:/proj/app.ts', 'typescript');
    const { dispose } = useExtensionUiStore.getState().addFormatter('test-ext', {
      id: 'test-fmt',
      displayName: 'TestFmt',
      languageIds: ['typescript'],
      format: async () => 'const x = 1;\n',
    });
    const editor = fakeEditor(null, null);

    render(<EditorContextMenu x={10} y={10} editorInstance={editor} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /Format with TestFmt/ }));

    await waitFor(() => {
      expect(editor.pushEditOperations).toHaveBeenCalledTimes(1);
    });
    expect(useEditorStore.getState().tabs[0].isDirty).toBe(true);
    dispose();
  });

  it('opens a real commit tab when a history entry is clicked', async () => {
    setCodeTab('C:/proj/app.ts', 'typescript');
    tauriInvokeMock.mockResolvedValue([
      {
        hash: 'abc123def456',
        short_hash: 'abc123d',
        message: 'Fix the thing',
        author: 'Dev',
        email: 'dev@example.com',
        timestamp: 1700000000,
      },
    ]);
    const editor = fakeEditor(null, null);

    render(<EditorContextMenu x={10} y={10} editorInstance={editor} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /View File History/ }));

    const entry = await screen.findByRole('menuitem', { name: /Fix the thing/ });
    fireEvent.click(entry);

    expect(useEditorStore.getState().tabs.some((t) => t.type === 'commit')).toBe(true);
  });
});
