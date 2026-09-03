import { beforeEach, describe, expect, it, vi } from 'vitest';

const { statPathMock, readFileMock, readFileChunkMock } = vi.hoisted(() => ({
  statPathMock: vi.fn(),
  readFileMock: vi.fn(),
  readFileChunkMock: vi.fn(),
}));

vi.mock('./tauri-fs', () => ({
  tauriFs: {
    statPath: statPathMock,
    readFile: readFileMock,
    readFileChunk: readFileChunkMock,
  },
}));

import {
  LOAD_CHUNK_BYTES,
  isCancelError,
  loadFileText,
} from './large-file-loader';

const statFile = (size: number) => ({
  path: '/big.txt',
  is_dir: false,
  is_file: true,
  size,
  modified: null,
});

const chunk = (data: string, totalSize: number, finished: boolean) => ({
  data,
  total_size: totalSize,
  is_binary: false,
  finished,
});

beforeEach(() => {
  statPathMock.mockReset();
  readFileMock.mockReset();
  readFileChunkMock.mockReset();
});

describe('loadFileText', () => {
  it('reads small files with a single readFile and no chunk calls', async () => {
    statPathMock.mockResolvedValue(statFile(100));
    readFileMock.mockResolvedValue('hello');
    const onProgress = vi.fn();

    const result = await loadFileText('/big.txt', {
      signal: new AbortController().signal,
      onProgress,
    });

    expect(result).toEqual({ text: 'hello', totalSize: 100 });
    expect(readFileMock).toHaveBeenCalledWith('/big.txt');
    expect(readFileChunkMock).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('loops chunks, joins exactly, and reports monotonic progress', async () => {
    const total = LOAD_CHUNK_BYTES * 2 + 100;
    statPathMock.mockResolvedValue(statFile(total));
    const first = 'a'.repeat(LOAD_CHUNK_BYTES);
    const second = 'b'.repeat(LOAD_CHUNK_BYTES);
    const third = 'c'.repeat(100);
    readFileChunkMock.mockImplementation(async (_path: string, offset: number) => {
      if (offset === 0) return chunk(first, total, false);
      if (offset === LOAD_CHUNK_BYTES) return chunk(second, total, false);
      return chunk(third, total, true);
    });
    const seen: Array<[number, number]> = [];

    const result = await loadFileText('/big.txt', {
      signal: new AbortController().signal,
      onProgress: (loaded, t) => seen.push([loaded, t]),
    });

    expect(result.text).toBe(first + second + third);
    expect(result.totalSize).toBe(total);
    expect(readFileMock).not.toHaveBeenCalled();
    expect(readFileChunkMock).toHaveBeenCalledTimes(3);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toEqual([total, total]);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]![0]).toBeGreaterThanOrEqual(seen[i - 1]![0]);
    }
  });

  it('aborts mid-loop without further invokes', async () => {
    const total = LOAD_CHUNK_BYTES * 3;
    statPathMock.mockResolvedValue(statFile(total));
    readFileChunkMock.mockResolvedValue(chunk('x'.repeat(1024), total, false));
    const controller = new AbortController();

    const promise = loadFileText('/big.txt', {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });

    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).not.toBeNull();
    expect(isCancelError(error)).toBe(true);
    expect(readFileChunkMock).toHaveBeenCalledTimes(1);
  });

  it('maps a binary chunk to a BINARY_FILE error', async () => {
    statPathMock.mockResolvedValue(statFile(LOAD_CHUNK_BYTES + 10));
    readFileChunkMock.mockResolvedValue({
      data: '',
      total_size: LOAD_CHUNK_BYTES + 10,
      is_binary: true,
      finished: true,
    });

    await expect(
      loadFileText('/big.txt', { signal: new AbortController().signal }),
    ).rejects.toThrow('BINARY_FILE');
  });

  it('rejects directories without reading', async () => {
    statPathMock.mockResolvedValue({
      path: '/dir',
      is_dir: true,
      is_file: false,
      size: 0,
      modified: null,
    });

    await expect(
      loadFileText('/dir', { signal: new AbortController().signal }),
    ).rejects.toThrow('Not a file');
    expect(readFileMock).not.toHaveBeenCalled();
    expect(readFileChunkMock).not.toHaveBeenCalled();
  });
});

describe('isCancelError', () => {
  it('detects abort errors and ignores ordinary failures', () => {
    expect(isCancelError(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isCancelError(new Error('BINARY_FILE'))).toBe(false);
    expect(isCancelError(null)).toBe(false);
  });
});
