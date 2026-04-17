import { create } from 'zustand';
import { tauriInvoke } from '../lib/tauri-invoke';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
}

export interface ImageInfo {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

// ── State ────────────────────────────────────────────────────────────────────

interface DockerState {
  isAvailable: boolean;
  containers: ContainerInfo[];
  images: ImageInfo[];
  loading: boolean;
  error: string | null;
  selectedContainerId: string | null;
  activeTab: 'containers' | 'images';
  logsCache: Record<string, string>;
  watchId: string | null;
  lastUpdated: number | null;

  // Actions
  checkAvailability: () => Promise<boolean>;
  refresh: () => Promise<void>;
  refreshContainers: () => Promise<void>;
  refreshImages: () => Promise<void>;
  startContainer: (id: string) => Promise<void>;
  stopContainer: (id: string) => Promise<void>;
  restartContainer: (id: string) => Promise<void>;
  removeContainer: (id: string, force?: boolean) => Promise<void>;
  removeImage: (id: string, force?: boolean) => Promise<void>;
  pullImage: (image: string) => Promise<void>;
  fetchLogs: (id: string, tail?: number) => Promise<string>;
  inspectContainer: (id: string) => Promise<string>;
  composeUp: (composePath: string, detach?: boolean) => Promise<string>;
  composeDown: (composePath: string) => Promise<string>;
  setSelectedContainer: (id: string | null) => void;
  setActiveTab: (tab: 'containers' | 'images') => void;
  startWatch: (intervalMs: number) => Promise<void>;
  stopWatch: () => Promise<void>;
}

// ── Unlisten handle (module-scoped so multiple store instances share it) ────

let _unlisten: UnlistenFn | null = null;

// ── Store ────────────────────────────────────────────────────────────────────

export const useDockerStore = create<DockerState>()((set, get) => ({
  isAvailable: false,
  containers: [],
  images: [],
  loading: false,
  error: null,
  selectedContainerId: null,
  activeTab: 'containers',
  logsCache: {},
  watchId: null,
  lastUpdated: null,

  checkAvailability: async () => {
    try {
      const available = await tauriInvoke('docker_is_available', {});
      set({ isAvailable: available });
      return available;
    } catch {
      set({ isAvailable: false });
      return false;
    }
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [containers, images] = await Promise.all([
        tauriInvoke('docker_list_containers', { all: true }),
        tauriInvoke('docker_list_images', {}),
      ]);
      set({ containers, images, loading: false, lastUpdated: Date.now() });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  refreshContainers: async () => {
    try {
      const containers = await tauriInvoke('docker_list_containers', { all: true });
      set({ containers, lastUpdated: Date.now() });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  refreshImages: async () => {
    try {
      const images = await tauriInvoke('docker_list_images', {});
      set({ images });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  startContainer: async (id) => {
    try {
      await tauriInvoke('docker_start_container', { id });
      await get().refreshContainers();
    } catch (err) {
      set({ error: String(err) });
    }
  },

  stopContainer: async (id) => {
    try {
      await tauriInvoke('docker_stop_container', { id });
      await get().refreshContainers();
    } catch (err) {
      set({ error: String(err) });
    }
  },

  restartContainer: async (id) => {
    try {
      await tauriInvoke('docker_restart_container', { id });
      await get().refreshContainers();
    } catch (err) {
      set({ error: String(err) });
    }
  },

  removeContainer: async (id, force) => {
    try {
      await tauriInvoke('docker_remove_container', { id, force });
      set((s) => ({
        containers: s.containers.filter((c) => c.id !== id),
        selectedContainerId: s.selectedContainerId === id ? null : s.selectedContainerId,
      }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  removeImage: async (id, force) => {
    try {
      await tauriInvoke('docker_remove_image', { id, force });
      set((s) => ({ images: s.images.filter((i) => i.id !== id) }));
    } catch (err) {
      set({ error: String(err) });
    }
  },

  pullImage: async (image) => {
    set({ loading: true });
    try {
      await tauriInvoke('docker_pull_image', { image });
      await get().refreshImages();
      set({ loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  fetchLogs: async (id, tail) => {
    try {
      const logs = await tauriInvoke('docker_container_logs', { id, tail });
      set((s) => ({ logsCache: { ...s.logsCache, [id]: logs } }));
      return logs;
    } catch (err) {
      set({ error: String(err) });
      return '';
    }
  },

  inspectContainer: async (id) => {
    try {
      return await tauriInvoke('docker_inspect_container', { id });
    } catch (err) {
      set({ error: String(err) });
      return '';
    }
  },

  composeUp: async (composePath, detach) => {
    try {
      const result = await tauriInvoke('docker_compose_up', { composePath, detach });
      await get().refreshContainers();
      return result;
    } catch (err) {
      set({ error: String(err) });
      return '';
    }
  },

  composeDown: async (composePath) => {
    try {
      const result = await tauriInvoke('docker_compose_down', { composePath });
      await get().refreshContainers();
      return result;
    } catch (err) {
      set({ error: String(err) });
      return '';
    }
  },

  setSelectedContainer: (id) => set({ selectedContainerId: id }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  startWatch: async (intervalMs) => {
    // Stop any existing watch first
    const existing = get().watchId;
    if (existing) {
      await get().stopWatch();
    }

    try {
      const watchId = await tauriInvoke('docker_watch_start', { intervalMs });

      _unlisten = await listen<{ containers: ContainerInfo[]; timestamp: number }>(
        'docker:containers-updated',
        (event) => {
          set({
            containers: event.payload.containers,
            lastUpdated: event.payload.timestamp * 1000,
          });
        },
      );

      set({ watchId });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  stopWatch: async () => {
    const { watchId } = get();
    if (watchId) {
      try {
        await tauriInvoke('docker_watch_stop', { watchId });
      } catch {
        // ignore — watch may already be stopped
      }
    }
    if (_unlisten) {
      _unlisten();
      _unlisten = null;
    }
    set({ watchId: null });
  },
}));
