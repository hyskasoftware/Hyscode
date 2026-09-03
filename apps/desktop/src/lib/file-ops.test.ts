import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { enableMapSet } from 'immer';

enableMapSet();

const {
  joinMock,
  statMock,
  moveMock,
  copyMock,
  validateMock,
  listenMock,
} = vi.hoisted(() => ({
  joinMock: vi.fn(),
  statMock: vi.fn(),
  moveMock: vi.fn(),
  copyMock: vi.fn(),
  validateMock: vi.fn(),
  listenMock: vi.fn(),
}));

vi.mock('./tauri-fs', () => ({
  TRASH_UNAVAILABLE_PREFIX: 'TRASH_UNAVAILABLE',
  tauriFs: {
    joinPath: joinMock,
    statPath: statMock,
    movePath: moveMock,
    copyPath: copyMock,
    validateName: validateMock,
    listDir: vi.fn(),
    watch: vi.fn().mockResolvedValue(undefined),
    unwatch: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(''),
  },
}));

vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));

import {
  baseName,
  buildUniqueName,
  fsPathsEqual,
  getUniqueDestPath,
  isSameOrWithin,
  localJoin,
  loadDeletePref,
  normalizeFsPath,
  parentDir,
  performCopy,
  performMove,
  remapMovedPath,
  saveDeletePref,
  splitName,
  syncTabsAfterDelete,
  syncTabsAfterMove,
  validateNameClient,
} from './file-ops';
import { useEditorStore, type Tab } from '../stores/editor-store';
import { useFileStore } from '../stores/file-store';
import { useDiagnosticsStore } from '../stores/diagnostics-store';
import { useLayoutStore } from '../stores/layout-store';

function seedLocalStorage() {
  const backing = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => {
      backing.set(key, String(value));
    },
    removeItem: (key: string) => {
      backing.delete(key);
    },
    clear: () => backing.clear(),
  });
}

function seedTab(overrides: Partial<Tab> & { id: string; filePath: string }): Tab {
  return {
    fileName: overrides.filePath.split('/').pop() ?? 'file',
    language: 'typescript',
    isDirty: false,
    isPinned: false,
    isPreview: false,
    type: 'file',
    viewerType: 'code',
    ...overrides,
  };
}

beforeEach(() => {
  seedLocalStorage();
  joinMock.mockReset().mockImplementation((parent: string, name: string) => {
    const clean = String(parent).replace(/[/\\]+$/, '');
    const sep = clean.includes('\\') ? '\\' : '/';
    return Promise.resolve(`${clean}${sep}${name}`);
  });
  statMock.mockReset().mockRejectedValue(new Error('Path not found'));
  moveMock.mockReset().mockResolvedValue(undefined);
  copyMock.mockReset().mockResolvedValue(undefined);
  validateMock.mockReset().mockResolvedValue(undefined);
  listenMock.mockReset().mockResolvedValue(vi.fn());

  useEditorStore.setState({ tabs: [], activeTabId: null });
  useFileStore.setState((s) => {
    s.fileCache.clear();
    s.externalConflicts.clear();
  });
  useDiagnosticsStore.getState().clearAll();
  useLayoutStore.getState().setAgentPreviewFile(null);
  useLayoutStore.getState().setAgentSelectedChangeFile(null);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('cross-platform path helpers', () => {
  it('normalizes mixed separators and trailing slashes', () => {
    expect(normalizeFsPath('C:\\Users\\a\\')).toBe('C:/Users/a');
    expect(normalizeFsPath('/a/b//')).toBe('/a/b');
    expect(normalizeFsPath('C:/')).toBe('C:/');
  });

  it('compares windows paths case-insensitively, posix case-sensitively', () => {
    expect(fsPathsEqual('C:\\A\\f.ts', 'c:/a/F.TS')).toBe(true);
    expect(fsPathsEqual('/a/f.ts', '/A/F.ts')).toBe(false);
    expect(fsPathsEqual('/a/f.ts', '/a/f.ts')).toBe(true);
  });

  it('detects nesting with a real boundary', () => {
    expect(isSameOrWithin('/a/b/c', '/a/b')).toBe(true);
    expect(isSameOrWithin('/a/b', '/a/b')).toBe(true);
    expect(isSameOrWithin('/a/b2', '/a/b')).toBe(false);
    expect(isSameOrWithin('C:\\A\\b', 'c:/a')).toBe(true);
    expect(isSameOrWithin('C:\\AB', 'C:\\A')).toBe(false);
  });

  it('computes parent dirs and base names for both styles', () => {
    expect(parentDir('C:\\a\\b\\f.ts')).toBe('C:\\a\\b');
    expect(parentDir('/a/b/f.ts')).toBe('/a/b');
    expect(parentDir('/f.ts')).toBe('/');
    expect(baseName('C:\\a\\b\\f.ts')).toBe('f.ts');
    expect(baseName('/a/b/')).toBe('b');
  });

  it('builds unique names preserving extensions', () => {
    expect(splitName('photo.png')).toEqual({ base: 'photo', ext: '.png' });
    expect(splitName('docs')).toEqual({ base: 'docs', ext: '' });
    expect(buildUniqueName('photo.png', 2)).toBe('photo (2).png');
    expect(buildUniqueName('docs', 1)).toBe('docs (1)');
    expect(localJoin('C:\\a', 'f.ts')).toBe('C:\\a\\f.ts');
    expect(localJoin('/a/', 'f.ts')).toBe('/a/f.ts');
  });

  it('rejects universally invalid names on the client', () => {
    expect(validateNameClient('')).not.toBeNull();
    expect(validateNameClient('a/b')).not.toBeNull();
    expect(validateNameClient('a\\b')).not.toBeNull();
    expect(validateNameClient('ok file (1).ts')).toBeNull();
  });
});

describe('getUniqueDestPath', () => {
  it('returns the plain join when free', async () => {
    await expect(getUniqueDestPath('/a', 'f.ts')).resolves.toBe('/a/f.ts');
  });

  it('auto-renames on conflict', async () => {
    statMock.mockImplementation((p: string) =>
      p === '/a/f.ts' || p === '/a/f (1).ts'
        ? Promise.resolve({ is_dir: false })
        : Promise.reject(new Error('missing')),
    );
    await expect(getUniqueDestPath('/a', 'f.ts')).resolves.toBe('/a/f (2).ts');
  });
});

describe('performMove / performCopy', () => {
  it('moves with an OS-joined destination', async () => {
    const dest = await performMove('/a/f.ts', '/b');
    expect(dest).toBe('/b/f.ts');
    expect(moveMock).toHaveBeenCalledWith('/a/f.ts', '/b/f.ts');
  });

  it('is a no-op when the source already lives in the target dir', async () => {
    const dest = await performMove('/a/f.ts', '/a');
    expect(dest).toBe('/a/f.ts');
    expect(moveMock).not.toHaveBeenCalled();
  });

  it('refuses to move a folder into itself', async () => {
    await expect(performMove('/a', '/a/b')).rejects.toThrow('into itself');
    expect(moveMock).not.toHaveBeenCalled();
  });

  it('auto-renames the destination on conflict', async () => {
    statMock.mockImplementation((p: string) =>
      p === '/b/f.ts' ? Promise.resolve({ is_dir: false }) : Promise.reject(new Error('missing')),
    );
    const dest = await performMove('/a/f.ts', '/b');
    expect(dest).toBe('/b/f (1).ts');
    expect(moveMock).toHaveBeenCalledWith('/a/f.ts', '/b/f (1).ts');
  });

  it('copies with auto-rename and refuses self-copy', async () => {
    statMock.mockRejectedValue(new Error('missing'));
    const dest = await performCopy('/a/f.ts', '/b');
    expect(dest).toBe('/b/f.ts');
    expect(copyMock).toHaveBeenCalledWith('/a/f.ts', '/b/f.ts');
    await expect(performCopy('/a', '/a/sub')).rejects.toThrow('into itself');
  });
});

describe('remapMovedPath', () => {
  it('remaps exact files and nested dir children', () => {
    expect(remapMovedPath('/a/f.ts', '/a/f.ts', '/b/f.ts', false)).toBe('/b/f.ts');
    expect(remapMovedPath('/a/sub/f.ts', '/a', '/b', true)).toBe('/b/sub/f.ts');
    expect(remapMovedPath('/other/f.ts', '/a', '/b', true)).toBeNull();
    expect(remapMovedPath('/a2/f.ts', '/a', '/b', true)).toBeNull();
  });

  it('matches windows paths case-insensitively', () => {
    expect(remapMovedPath('C:\\A\\f.ts', 'c:/a', 'D:/n', true)).toBe('D:/n/f.ts');
  });
});

describe('delete preference', () => {
  it('round-trips the mode and dontAsk flag', () => {
    expect(loadDeletePref()).toBeNull();
    saveDeletePref({ mode: 'permanent', dontAsk: true });
    expect(loadDeletePref()).toEqual({ mode: 'permanent', dontAsk: true });
  });
});

describe('syncTabsAfterDelete', () => {
  it('closes tabs and clears caches for a deleted file', () => {
    useEditorStore.setState({
      tabs: [
        seedTab({ id: '/a/f.ts', filePath: '/a/f.ts' }),
        seedTab({ id: '/a/keep.ts', filePath: '/a/keep.ts' }),
      ],
      activeTabId: '/a/f.ts',
    });
    useFileStore.getState().setFileContent('/a/f.ts', 'x');
    useFileStore.setState((s) => {
      s.externalConflicts.add('/a/f.ts');
    });
    useDiagnosticsStore.getState().setDiagnostics('/a/f.ts', { errors: 1, warnings: 0 });
    useLayoutStore.getState().setAgentPreviewFile('/a/f.ts');

    syncTabsAfterDelete('/a/f.ts', false);

    expect(useEditorStore.getState().tabs.map((t) => t.id)).toEqual(['/a/keep.ts']);
    expect(useFileStore.getState().fileCache.has('/a/f.ts')).toBe(false);
    expect(useFileStore.getState().externalConflicts.has('/a/f.ts')).toBe(false);
    expect(useDiagnosticsStore.getState().diagnostics.has('/a/f.ts')).toBe(false);
    expect(useLayoutStore.getState().agentPreviewFile).toBeNull();
  });

  it('closes every tab nested in a deleted folder', () => {
    useEditorStore.setState({
      tabs: [
        seedTab({ id: '/a/sub/f.ts', filePath: '/a/sub/f.ts' }),
        seedTab({ id: '/a2/f.ts', filePath: '/a2/f.ts' }),
      ],
      activeTabId: '/a/sub/f.ts',
    });
    useFileStore.getState().setFileContent('/a/sub/f.ts', 'x');

    syncTabsAfterDelete('/a', true);

    expect(useEditorStore.getState().tabs.map((t) => t.id)).toEqual(['/a2/f.ts']);
    expect(useFileStore.getState().fileCache.has('/a/sub/f.ts')).toBe(false);
  });
});

describe('syncTabsAfterMove', () => {
  it('remaps a renamed file tab, its id, cache and diagnostics', () => {
    useEditorStore.setState({
      tabs: [seedTab({ id: '/a/old.ts', filePath: '/a/old.ts' })],
      activeTabId: '/a/old.ts',
    });
    useFileStore.getState().setFileContent('/a/old.ts', 'x');
    useDiagnosticsStore.getState().setDiagnostics('/a/old.ts', { errors: 2, warnings: 1 });
    useLayoutStore.getState().setAgentPreviewFile('/a/old.ts');

    syncTabsAfterMove('/a/old.ts', '/a/new.ts', false, (p) =>
      p.endsWith('.ts') ? 'typescript' : 'text',
    );

    const editor = useEditorStore.getState();
    expect(editor.tabs.map((t) => t.id)).toEqual(['/a/new.ts']);
    expect(editor.tabs[0]?.filePath).toBe('/a/new.ts');
    expect(editor.tabs[0]?.fileName).toBe('new.ts');
    expect(editor.activeTabId).toBe('/a/new.ts');
    expect(useFileStore.getState().fileCache.get('/a/new.ts')).toBe('x');
    expect(useFileStore.getState().fileCache.has('/a/old.ts')).toBe(false);
    expect(useDiagnosticsStore.getState().diagnostics.get('/a/new.ts')).toEqual({
      errors: 2,
      warnings: 1,
    });
    expect(useLayoutStore.getState().agentPreviewFile).toBe('/a/new.ts');
  });

  it('remaps nested tabs when a folder moves', () => {
    useEditorStore.setState({
      tabs: [
        seedTab({ id: '/a/sub/f.ts', filePath: '/a/sub/f.ts' }),
        seedTab({ id: '/other/f.ts', filePath: '/other/f.ts' }),
      ],
      activeTabId: '/other/f.ts',
    });

    syncTabsAfterMove('/a', '/b', true);

    expect(useEditorStore.getState().tabs.map((t) => t.filePath).sort()).toEqual([
      '/b/sub/f.ts',
      '/other/f.ts',
    ]);
    expect(useEditorStore.getState().activeTabId).toBe('/other/f.ts');
  });
});
