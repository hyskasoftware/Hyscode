import { invoke } from '@tauri-apps/api/core';

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

export interface FileStat {
  path: string;
  is_dir: boolean;
  is_file: boolean;
  size: number;
  modified: number | null;
}

export interface SearchResult {
  path: string;
  line_number: number;
  line_content: string;
}

export const tauriFs = {
  readFile: (path: string) => invoke<string>('read_file', { path }),
  writeFile: (path: string, content: string) => invoke<void>('write_file', { path, content }),
  createFile: (path: string, content?: string) => invoke<void>('create_file', { path, content }),
  deletePath: (path: string) => invoke<void>('delete_path', { path }),
  listDir: (path: string, showHidden?: boolean) =>
    invoke<FileEntry[]>('list_dir', { path, showHidden: showHidden ?? false }),
  statPath: (path: string) => invoke<FileStat>('stat_path', { path }),
  searchFiles: (root: string, query: string, maxResults?: number) =>
    invoke<SearchResult[]>('search_files', { root, query, maxResults }),
  watch: (path: string) => invoke<void>('fs_watch', { path }),
  unwatch: (path: string) => invoke<void>('fs_unwatch', { path }),
  copyPath: (from: string, to: string) => invoke<void>('copy_path', { from, to }),
  renamePath: (from: string, to: string) => invoke<void>('rename_path', { from, to }),
};
