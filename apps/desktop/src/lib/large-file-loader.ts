import { tauriFs } from './tauri-fs';

export const SMALL_FILE_FAST_PATH_BYTES = 256 * 1024;
export const LOAD_CHUNK_BYTES = 256 * 1024;

export function isCancelError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { name?: unknown }).name === 'AbortError'
  );
}

export async function loadFileText(
  path: string,
  opts: { signal: AbortSignal; onProgress?: (loaded: number, total: number) => void },
): Promise<{ text: string; totalSize: number }> {
  const stat = await tauriFs.statPath(path);
  if (stat.is_dir) throw new Error(`Not a file: ${path}`);
  if (stat.size <= SMALL_FILE_FAST_PATH_BYTES) {
    const text = await tauriFs.readFile(path);
    opts.signal.throwIfAborted();
    return { text, totalSize: stat.size };
  }
  const parts: string[] = [];
  let offset = 0;
  for (;;) {
    opts.signal.throwIfAborted();
    const chunk = await tauriFs.readFileChunk(path, offset, LOAD_CHUNK_BYTES);
    if (chunk.is_binary) throw new Error('BINARY_FILE');
    parts.push(chunk.data);
    offset += LOAD_CHUNK_BYTES;
    const loaded = Math.min(offset, chunk.total_size);
    opts.onProgress?.(loaded, chunk.total_size);
    if (chunk.finished || offset >= chunk.total_size) {
      opts.signal.throwIfAborted();
      return { text: parts.join(''), totalSize: chunk.total_size };
    }
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}
