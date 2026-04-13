import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ViewerType } from '../lib/utils';

export interface Tab {
  id: string;
  filePath: string;
  fileName: string;
  language: string;
  isDirty: boolean;
  isPinned: boolean;
  isPreview: boolean;
  type: 'file' | 'diff';
  viewerType: ViewerType;
  markdownMode?: 'preview' | 'code';
  diffProps?: {
    filePath: string;
    staged: boolean;
  };
}

interface EditorState {
  tabs: Tab[];
  activeTabId: string | null;
  openTab: (tab: Omit<Tab, 'isDirty' | 'isPinned' | 'isPreview' | 'type' | 'diffProps' | 'viewerType' | 'markdownMode'> & { type?: Tab['type']; diffProps?: Tab['diffProps']; viewerType?: ViewerType; markdownMode?: Tab['markdownMode'] }) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  markDirty: (id: string, dirty: boolean) => void;
  pinTab: (id: string) => void;
  setMarkdownMode: (id: string, mode: 'preview' | 'code') => void;
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    tabs: [],
    activeTabId: null,

    openTab: (tab) =>
      set((state) => {
        const existing = state.tabs.find((t) => t.id === tab.id);
        if (existing) {
          state.activeTabId = existing.id;
          return;
        }

        // Replace preview tab if exists
        const previewIdx = state.tabs.findIndex((t) => t.isPreview);
        const newTab: Tab = {
          ...tab,
          type: tab.type ?? 'file',
          viewerType: tab.viewerType ?? 'code',
          isDirty: false,
          isPinned: false,
          isPreview: false,
        };

        if (previewIdx >= 0) {
          state.tabs[previewIdx] = newTab;
        } else {
          state.tabs.push(newTab);
        }
        state.activeTabId = tab.id;
      }),

    closeTab: (id) =>
      set((state) => {
        const idx = state.tabs.findIndex((t) => t.id === id);
        if (idx < 0) return;
        state.tabs.splice(idx, 1);
        if (state.activeTabId === id) {
          state.activeTabId = state.tabs[Math.min(idx, state.tabs.length - 1)]?.id ?? null;
        }
      }),

    setActiveTab: (id) =>
      set((state) => {
        state.activeTabId = id;
      }),

    markDirty: (id, dirty) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === id);
        if (tab) tab.isDirty = dirty;
      }),

    pinTab: (id) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === id);
        if (tab) {
          tab.isPinned = true;
          tab.isPreview = false;
        }
      }),

    setMarkdownMode: (id, mode) =>
      set((state) => {
        const tab = state.tabs.find((t) => t.id === id);
        if (tab) tab.markdownMode = mode;
      }),
  })),
);
