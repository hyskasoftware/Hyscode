import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from './file-store';
import { useGitStore } from './git-store';
import type { GitFile } from './git-store';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReviewSeverity = 'p0' | 'p1' | 'p2';
export type ReviewSource = 'working' | 'branch';
export type ReviewStatus = 'idle' | 'loading' | 'reviewing' | 'done' | 'error';

export interface ReviewComment {
  id: string;
  filePath: string;
  line: number;
  endLine?: number;
  severity: ReviewSeverity;
  category: string;
  message: string;
  suggestion?: string;
  resolved: boolean;
}

export interface ReviewFileEntry {
  path: string;
  status: string;
  commentCount: number;
  reviewed: boolean;
}

export interface ReviewSummary {
  totalFiles: number;
  reviewedFiles: number;
  totalComments: number;
  bySeverity: Record<ReviewSeverity, number>;
  score: number | null;
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface ReviewState {
  // Source
  source: ReviewSource;
  targetBranch: string;

  // Status
  status: ReviewStatus;
  error: string | null;

  // Files under review
  files: ReviewFileEntry[];
  selectedFile: string | null;

  // Comments
  comments: ReviewComment[];

  // Summary
  summary: ReviewSummary;

  // Actions
  setSource: (source: ReviewSource) => void;
  setTargetBranch: (branch: string) => void;
  setSelectedFile: (path: string | null) => void;
  loadFiles: () => Promise<void>;
  setStatus: (status: ReviewStatus) => void;
  setError: (error: string | null) => void;

  // Comment actions
  addComment: (comment: ReviewComment) => void;
  addComments: (comments: ReviewComment[]) => void;
  resolveComment: (id: string) => void;
  unresolveComment: (id: string) => void;
  clearComments: () => void;

  // File review tracking
  markFileReviewed: (path: string) => void;
  unmarkFileReviewed: (path: string) => void;

  // Summary
  recalcSummary: () => void;

  // Reset
  reset: () => void;
}

function getRootPath(): string | null {
  return useFileStore.getState().rootPath;
}

const EMPTY_SUMMARY: ReviewSummary = {
  totalFiles: 0,
  reviewedFiles: 0,
  totalComments: 0,
  bySeverity: { p0: 0, p1: 0, p2: 0 },
  score: null,
};

export const useReviewStore = create<ReviewState>()(
  immer((set, get) => ({
    source: 'working',
    targetBranch: 'main',
    status: 'idle',
    error: null,
    files: [],
    selectedFile: null,
    comments: [],
    summary: { ...EMPTY_SUMMARY },

    setSource: (source) => set((s) => { s.source = source; }),
    setTargetBranch: (branch) => set((s) => { s.targetBranch = branch; }),
    setSelectedFile: (path) => set((s) => { s.selectedFile = path; }),
    setStatus: (status) => set((s) => { s.status = status; }),
    setError: (error) => set((s) => { s.error = error; }),

    loadFiles: async () => {
      const rootPath = getRootPath();
      if (!rootPath) return;

      set((s) => { s.status = 'loading'; s.error = null; });

      try {
        // Refresh git state first
        await useGitStore.getState().refresh();
        const gitState = useGitStore.getState();

        const source = get().source;
        let gitFiles: GitFile[];

        if (source === 'working') {
          // Combine staged + unstaged + untracked
          gitFiles = [...gitState.staged, ...gitState.unstaged, ...gitState.untracked];
        } else {
          // For branch diff we use staged + unstaged (TODO: proper branch compare)
          gitFiles = [...gitState.staged, ...gitState.unstaged, ...gitState.untracked];
        }

        // Deduplicate by path
        const seen = new Set<string>();
        const unique: GitFile[] = [];
        for (const f of gitFiles) {
          if (!seen.has(f.path)) {
            seen.add(f.path);
            unique.push(f);
          }
        }

        // Preserve reviewed flags and comment counts from any previously
        // restored snapshot (per-project persistence).
        const prevFiles = get().files;
        const prevComments = get().comments;

        const entries: ReviewFileEntry[] = unique.map((f) => {
          const prev = prevFiles.find((pf) => pf.path === f.path);
          const commentCount = prevComments.filter((c) => c.filePath === f.path).length;
          return {
            path: f.path,
            status: f.status,
            commentCount,
            reviewed: prev?.reviewed ?? false,
          };
        });

        set((s) => {
          s.files = entries;
          s.status = entries.length > 0 ? 'idle' : 'idle';
          s.selectedFile = entries[0]?.path ?? null;
        });

        get().recalcSummary();
      } catch (err: any) {
        set((s) => {
          s.status = 'error';
          s.error = err.message ?? String(err);
        });
      }
    },

    addComment: (comment) => {
      set((s) => {
        s.comments.push(comment);
        const file = s.files.find((f) => f.path === comment.filePath);
        if (file) file.commentCount++;
      });
      get().recalcSummary();
    },

    addComments: (comments) => {
      set((s) => {
        for (const c of comments) {
          s.comments.push(c);
          const file = s.files.find((f) => f.path === c.filePath);
          if (file) file.commentCount++;
        }
      });
      get().recalcSummary();
    },

    resolveComment: (id) => {
      set((s) => {
        const c = s.comments.find((c) => c.id === id);
        if (c) c.resolved = true;
      });
      get().recalcSummary();
    },

    unresolveComment: (id) => {
      set((s) => {
        const c = s.comments.find((c) => c.id === id);
        if (c) c.resolved = false;
      });
      get().recalcSummary();
    },

    clearComments: () => {
      set((s) => {
        s.comments = [];
        for (const f of s.files) f.commentCount = 0;
      });
      get().recalcSummary();
    },

    markFileReviewed: (path) => {
      set((s) => {
        const file = s.files.find((f) => f.path === path);
        if (file) file.reviewed = true;
      });
      get().recalcSummary();
    },

    unmarkFileReviewed: (path) => {
      set((s) => {
        const file = s.files.find((f) => f.path === path);
        if (file) file.reviewed = false;
      });
      get().recalcSummary();
    },

    recalcSummary: () => {
      const { files, comments } = get();
      const bySeverity: Record<ReviewSeverity, number> = { p0: 0, p1: 0, p2: 0 };
      for (const c of comments) {
        if (!c.resolved) bySeverity[c.severity]++;
      }

      const unresolvedCount = comments.filter((c) => !c.resolved).length;
      const totalFiles = files.length;
      const reviewedFiles = files.filter((f) => f.reviewed).length;

      // Score: 100 - (P0*30 + P1*10 + P2*2), clamped 0-100
      let score: number | null = null;
      if (comments.length > 0) {
        score = Math.max(0, Math.min(100, 100 - (bySeverity.p0 * 30 + bySeverity.p1 * 10 + bySeverity.p2 * 2)));
      }

      set((s) => {
        s.summary = {
          totalFiles,
          reviewedFiles,
          totalComments: unresolvedCount,
          bySeverity,
          score,
        };
      });
    },

    reset: () => {
      set((s) => {
        s.source = 'working';
        s.targetBranch = 'main';
        s.status = 'idle';
        s.error = null;
        s.files = [];
        s.selectedFile = null;
        s.comments = [];
        s.summary = { ...EMPTY_SUMMARY };
      });
    },
  })),
);
