import { create } from 'zustand';
import type { ViewContent, Disposable } from '@hyscode/extension-api';

// ── Event handler maps (outside store to avoid Zustand/immer issues) ─────────

const _searchHandlers: Record<string, Set<(query: string) => void>> = {};
const _visibilityHandlers: Record<string, Set<(visible: boolean) => void>> = {};

// ── State ────────────────────────────────────────────────────────────────────

interface ViewRegistryState {
  /** View content keyed by view ID. */
  contents: Record<string, ViewContent>;
  /** Badges keyed by view ID. */
  badges: Record<string, { count: number; tooltip?: string }>;
  /** Search query per view. */
  searchQueries: Record<string, string>;
  /** Internal version counter to force re-renders. */
  version: number;

  // ── Actions ──────────────────────────────────────────────────────────────
  updateView: (viewId: string, content: ViewContent) => void;
  setViewBadge: (viewId: string, badge: { count: number; tooltip?: string } | null) => void;
  setSearchQuery: (viewId: string, query: string) => void;
  onDidChangeSearch: (viewId: string, handler: (query: string) => void) => Disposable;
  onDidChangeVisibility: (viewId: string, handler: (visible: boolean) => void) => Disposable;
  notifyVisibility: (viewId: string, visible: boolean) => void;
  clearView: (viewId: string) => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useViewRegistryStore = create<ViewRegistryState>()((set) => ({
  contents: {},
  badges: {},
  searchQueries: {},
  version: 0,

  updateView: (viewId, content) => {
    console.log(`[ViewRegistry] updateView("${viewId}") type="${content?.type}" keys=${JSON.stringify(Object.keys(content ?? {}))}`);
    set((s) => {
      const next = {
        contents: { ...s.contents, [viewId]: content },
        badges: content.badge
          ? { ...s.badges, [viewId]: content.badge }
          : s.badges,
        version: s.version + 1,
      };
      console.log(`[ViewRegistry] state after set — contents keys:`, Object.keys(next.contents));
      return next;
    });
  },

  setViewBadge: (viewId, badge) => {
    set((s) => {
      const next = { ...s.badges };
      if (badge) {
        next[viewId] = badge;
      } else {
        delete next[viewId];
      }
      return { badges: next };
    });
  },

  setSearchQuery: (viewId, query) => {
    set((s) => ({ searchQueries: { ...s.searchQueries, [viewId]: query } }));
    // Notify handlers
    const handlers = _searchHandlers[viewId];
    if (handlers) {
      for (const handler of handlers) {
        try { handler(query); } catch (e) {
          console.warn(`[ViewRegistry] Search handler error for "${viewId}":`, e);
        }
      }
    }
  },

  onDidChangeSearch: (viewId, handler) => {
    if (!_searchHandlers[viewId]) _searchHandlers[viewId] = new Set();
    _searchHandlers[viewId].add(handler);
    return { dispose: () => { _searchHandlers[viewId]?.delete(handler); } };
  },

  onDidChangeVisibility: (viewId, handler) => {
    if (!_visibilityHandlers[viewId]) _visibilityHandlers[viewId] = new Set();
    _visibilityHandlers[viewId].add(handler);
    return { dispose: () => { _visibilityHandlers[viewId]?.delete(handler); } };
  },

  notifyVisibility: (viewId, visible) => {
    const handlers = _visibilityHandlers[viewId];
    if (handlers) {
      for (const handler of handlers) {
        try { handler(visible); } catch (e) {
          console.warn(`[ViewRegistry] Visibility handler error for "${viewId}":`, e);
        }
      }
    }
  },

  clearView: (viewId) => {
    set((s) => {
      const contents = { ...s.contents };
      const badges = { ...s.badges };
      const searchQueries = { ...s.searchQueries };
      delete contents[viewId];
      delete badges[viewId];
      delete searchQueries[viewId];
      return { contents, badges, searchQueries, version: s.version + 1 };
    });
  },
}));
