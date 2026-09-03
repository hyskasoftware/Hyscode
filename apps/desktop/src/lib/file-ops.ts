// ── Shared file operations for the explorer ─────────────────────────────────
// Cross-platform path helpers plus editor/cache/diagnostics synchronization
// after move / rename / delete. All multi-separator aware: paths may use `/`,
// `\` or a mix (Windows UNC, drag-drop payloads), so helpers normalize before
// comparing and only use the backend `join_path` command to build new paths.

import { tauriFs } from './tauri-fs';
import { useEditorStore } from '../stores/editor-store';
import { useFileStore } from '../stores/file-store';
import { useDiagnosticsStore } from '../stores/diagnostics-store';
import { useLayoutStore } from '../stores/layout-store';

// ── Path helpers (pure, sync, unit-tested) ───────────────────────────────────

const WINDOWS_PATH_RE = /^[A-Za-z]:\//;
const UNC_PATH_RE = /^\/\//;

/** Normalize separators to `/` and drop trailing slashes (keeps roots). */
export function normalizeFsPath(path: string): string {
  let out = path.replace(/\\/g, '/');
  if (WINDOWS_PATH_RE.test(out)) {
    out = out.replace(/\/+$/, '');
    return out.length <= 2 ? `${out}/` : out;
  }
  if (UNC_PATH_RE.test(out)) {
    return `//${out.slice(2).replace(/^\/+/, '').replace(/\/+$/, '')}`;
  }
  if (out.length > 1) out = out.replace(/\/+$/, '');
  return out === '' ? '/' : out;
}

/** True for drive-letter (`C:/...`) or UNC (`//server/...`) paths, which live
 *  on case-insensitive filesystems on Windows and (by default) macOS clients. */
export function isWindowsStylePath(path: string): boolean {
  const slash = path.replace(/\\/g, '/');
  return WINDOWS_PATH_RE.test(slash) || slash.startsWith('//');
}

function fsPathKey(path: string): string {
  const normalized = normalizeFsPath(path);
  return isWindowsStylePath(normalized) ? normalized.toLowerCase() : normalized;
}

/** Case-aware path equality: case-insensitive for Windows-style paths. */
export function fsPathsEqual(left: string, right: string): boolean {
  return fsPathKey(left) === fsPathKey(right);
}

/**
 * True when `child` equals `parent` or is nested inside it, with a real path
 * boundary (`/a/b2` is NOT within `/a/b`). Case-insensitive for
 * Windows-style paths.
 */
export function isSameOrWithin(child: string, parent: string): boolean {
  const childKey = fsPathKey(child);
  let parentKey = fsPathKey(parent);
  if (parentKey.length > 1) parentKey = parentKey.replace(/\/+$/, '');
  if (parentKey === '' || parentKey === '/') return childKey.startsWith('/');
  if (childKey === parentKey) return true;
  return childKey.startsWith(`${parentKey}/`);
}

/** Parent directory handling both separators; preserves the input style. */
export function parentDir(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (idx < 0) return '';
  if (idx === 0) return trimmed.slice(0, 1);
  const head = trimmed.slice(0, idx);
  if (/^[A-Za-z]:$/.test(head)) return `${head}${trimmed[idx]}`;
  return head;
}

/** Final segment of a path, handling both separators. */
export function baseName(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '');
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return idx < 0 ? trimmed : trimmed.slice(idx + 1);
}

/** Split `archive.tar.gz` -> { base: 'archive.tar', ext: '.gz' }. */
export function splitName(name: string): { base: string; ext: string } {
  const dotIdx = name.lastIndexOf('.');
  if (dotIdx > 0) return { base: name.slice(0, dotIdx), ext: name.slice(dotIdx) };
  return { base: name, ext: '' };
}

/** `photo.png` + 2 -> `photo (2).png`; `docs` + 1 -> `docs (1)`. */
export function buildUniqueName(name: string, attempt: number): string {
  const { base, ext } = splitName(name);
  return `${base} (${attempt})${ext}`;
}

/** Local `parent + sep + name` join preserving the parent's separator style.
 *  Only a fallback — prefer `joinChild` (backend `join_path`) at runtime. */
export function localJoin(parent: string, name: string): string {
  const clean = parent.replace(/[/\\]+$/, '');
  const sep = parent.includes('\\') && !parent.includes('/') ? '\\' : '/';
  return `${clean}${sep}${name}`;
}

/** Join via the backend (OS-correct separator + name validation). */
export async function joinChild(parent: string, name: string): Promise<string> {
  try {
    return await tauriFs.joinPath(parent, name);
  } catch {
    return localJoin(parent, name);
  }
}

async function destExists(path: string): Promise<boolean> {
  try {
    await tauriFs.statPath(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Unique destination for copy/move/duplicate: `name`, else `name (1)`, ...
 * Uses the backend join so the separator is always OS-correct.
 */
export async function getUniqueDestPath(targetDir: string, name: string): Promise<string> {
  let dest = await joinChild(targetDir, name);
  if (!(await destExists(dest))) return dest;
  let attempt = 1;
  for (;;) {
    dest = await joinChild(targetDir, buildUniqueName(name, attempt));
    if (!(await destExists(dest))) return dest;
    attempt += 1;
  }
}

/**
 * Fast client-side name check. The backend `validate_name` command is
 * authoritative (Windows reserved names, trailing dots, ...); this only
 * rejects what is invalid on every OS so valid names are never blocked here.
 */
export function validateNameClient(name: string): string | null {
  if (!name || !name.trim()) return 'Name cannot be empty';
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
    return 'Name cannot contain `/`, `\\` or null characters';
  }
  if (name.length > 255) return 'Name is too long (max 255 characters)';
  return null;
}

/** Human-readable message from a Tauri invoke rejection. */
export function extractInvokeMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

// ── Delete preference ("Don't show again") ───────────────────────────────────

export type DeleteMode = 'trash' | 'permanent';

export interface DeletePref {
  mode: DeleteMode;
  dontAsk: boolean;
}

const DELETE_PREF_KEY = 'hyscode-delete-pref';

export function loadDeletePref(): DeletePref | null {
  try {
    const raw = localStorage.getItem(DELETE_PREF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeletePref>;
    if (parsed.mode !== 'trash' && parsed.mode !== 'permanent') return null;
    return { mode: parsed.mode, dontAsk: parsed.dontAsk === true };
  } catch {
    return null;
  }
}

export function saveDeletePref(pref: DeletePref): void {
  try {
    localStorage.setItem(DELETE_PREF_KEY, JSON.stringify(pref));
  } catch {
    // Storage unavailable (private mode, etc.) — just ask every time.
  }
}

// ── Move / copy with auto-rename ─────────────────────────────────────────────

/**
 * Move `srcPath` into `targetDir`, auto-renaming (`name (1).ext`) on conflict.
 * Works across volumes/drives (backend copy+delete fallback). No-op when the
 * source already lives in the target dir. Returns the final destination path.
 */
export async function performMove(srcPath: string, targetDir: string): Promise<string> {
  if (isSameOrWithin(targetDir, srcPath)) {
    throw new Error('Cannot move a folder into itself');
  }
  const name = baseName(srcPath);
  let dest = await joinChild(targetDir, name);
  if (fsPathsEqual(dest, srcPath)) return srcPath;
  if (await destExists(dest)) dest = await getUniqueDestPath(targetDir, name);
  if (fsPathsEqual(dest, srcPath)) return srcPath;
  await tauriFs.movePath(srcPath, dest);
  return dest;
}

/** Copy `srcPath` into `targetDir`, auto-renaming on conflict. */
export async function performCopy(srcPath: string, targetDir: string): Promise<string> {
  if (isSameOrWithin(targetDir, srcPath)) {
    throw new Error('Cannot copy a folder into itself');
  }
  const name = baseName(srcPath);
  const dest = await getUniqueDestPath(targetDir, name);
  await tauriFs.copyPath(srcPath, dest);
  return dest;
}

// ── Tab / cache / diagnostics synchronization ────────────────────────────────

function matchesTarget(candidate: string | null | undefined, target: string, isDir: boolean): boolean {
  if (!candidate) return false;
  return isDir ? isSameOrWithin(candidate, target) : fsPathsEqual(candidate, target);
}

/**
 * Remap a path affected by a move/rename. Returns the new path, or null when
 * `candidate` is outside the moved tree. Remainder separators follow the style
 * of `newPath` so results stay consistent on every OS.
 */
export function remapMovedPath(
  candidate: string,
  oldPath: string,
  newPath: string,
  isDir: boolean,
): string | null {
  if (!candidate) return null;
  if (fsPathsEqual(candidate, oldPath)) return newPath;
  if (!isDir) return null;
  const candidateKey = fsPathKey(candidate);
  const oldKey = fsPathKey(oldPath).replace(/\/+$/, '');
  if (oldKey === '' || oldKey === '/') return null;
  if (!candidateKey.startsWith(`${oldKey}/`)) return null;
  const oldStrippedLength = normalizeFsPath(oldPath).replace(/\/+$/, '').length;
  const remainder = candidate.slice(oldStrippedLength);
  const sep = newPath.includes('\\') && !newPath.includes('/') ? '\\' : '/';
  return `${newPath.replace(/[/\\]+$/, '')}${remainder.replace(/[/\\]/g, sep)}`;
}

/** Close editor tabs + drop caches/diagnostics for a deleted file or folder. */
export function syncTabsAfterDelete(targetPath: string, isDir: boolean): void {
  const matches = (p: string | null | undefined) => matchesTarget(p, targetPath, isDir);

  const editor = useEditorStore.getState();
  const idsToClose = editor.tabs
    .filter(
      (t) =>
        matches(t.filePath) ||
        matches(t.diffProps?.filePath) ||
        matches(t.historyProps?.originalPath) ||
        matches(t.dbSchemaProps?.sourceFile),
    )
    .map((t) => t.id);
  for (const id of idsToClose) useEditorStore.getState().closeTab(id);

  useFileStore.setState((s) => {
    for (const key of [...s.fileCache.keys()]) {
      if (matches(key)) s.fileCache.delete(key);
    }
    for (const key of [...s.externalConflicts]) {
      if (matches(key)) s.externalConflicts.delete(key);
    }
  });

  const diagnostics = useDiagnosticsStore.getState();
  const diagKeys = new Set<string>([
    ...diagnostics.diagnostics.keys(),
    ...diagnostics.details.keys(),
    ...diagnostics.openFiles.keys(),
  ]);
  for (const key of diagKeys) {
    if (matches(key)) diagnostics.clearDiagnostics(key);
  }

  const layout = useLayoutStore.getState();
  if (matches(layout.agentPreviewFile)) layout.setAgentPreviewFile(null);
  if (matches(layout.agentSelectedChangeFile)) layout.setAgentSelectedChangeFile(null);
}

/**
 * Remap editor tabs, file caches and diagnostics after a move/rename.
 * `detectLanguage` refreshes tab languages when a rename changes extension.
 */
export function syncTabsAfterMove(
  oldPath: string,
  newPath: string,
  isDir: boolean,
  detectLanguage?: (path: string) => string,
): void {
  const remap = (p: string | null | undefined) =>
    p ? remapMovedPath(p, oldPath, newPath, isDir) : null;

  const idRemaps = new Map<string, string>();
  useEditorStore.setState((s) => {
    for (const tab of s.tabs) {
      const nextFile = remap(tab.filePath);
      if (nextFile) {
        if (tab.id === tab.filePath) idRemaps.set(tab.id, nextFile);
        if (tab.id === tab.filePath) tab.id = nextFile;
        tab.filePath = nextFile;
        tab.fileName = baseName(nextFile);
        if (detectLanguage) {
          try {
            tab.language = detectLanguage(nextFile);
          } catch {
            // Keep the previous language on detector failure.
          }
        }
      }
      const nextDiff = remap(tab.diffProps?.filePath);
      if (nextDiff && tab.diffProps) tab.diffProps.filePath = nextDiff;
      const nextHistory = remap(tab.historyProps?.originalPath);
      if (nextHistory && tab.historyProps) tab.historyProps.originalPath = nextHistory;
      const nextSchema = remap(tab.dbSchemaProps?.sourceFile);
      if (nextSchema && tab.dbSchemaProps) tab.dbSchemaProps.sourceFile = nextSchema;
    }
    if (idRemaps.size > 0 && s.activeTabId && idRemaps.has(s.activeTabId)) {
      s.activeTabId = idRemaps.get(s.activeTabId) ?? s.activeTabId;
    }
  });

  useFileStore.setState((s) => {
    for (const [key, value] of [...s.fileCache.entries()]) {
      const next = remap(key);
      if (next) {
        s.fileCache.delete(key);
        s.fileCache.set(next, value);
      }
    }
    for (const key of [...s.externalConflicts]) {
      const next = remap(key);
      if (next) {
        s.externalConflicts.delete(key);
        s.externalConflicts.add(next);
      }
    }
  });

  useDiagnosticsStore.setState((s) => {
    for (const map of [s.diagnostics, s.details, s.openFiles] as Array<Map<string, unknown>>) {
      const moves: Array<[string, string, unknown]> = [];
      for (const [key, value] of map) {
        const next = remap(key);
        if (next && next !== key) moves.push([key, next, value]);
      }
      for (const [key, next, value] of moves) {
        map.delete(key);
        map.set(next, value);
      }
    }
  });

  const layout = useLayoutStore.getState();
  const nextPreview = remap(layout.agentPreviewFile);
  if (nextPreview) layout.setAgentPreviewFile(nextPreview);
  const nextSelected = remap(layout.agentSelectedChangeFile);
  if (nextSelected) layout.setAgentSelectedChangeFile(nextSelected);
}
