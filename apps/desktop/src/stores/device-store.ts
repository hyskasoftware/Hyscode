import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from './settings-store';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeviceInfo {
  id: string;
  name: string;
  /** "android" | "ios" | "web" | "linux" | "macos" | "windows" */
  platform: string;
  emulator: boolean;
  available: boolean;
  category: string;
}

export interface EmulatorInfo {
  id: string;
  name: string;
  platform: string;
}

// ── State ────────────────────────────────────────────────────────────────────

interface DeviceState {
  devices: DeviceInfo[];
  emulators: EmulatorInfo[];
  selectedDeviceId: string | null;
  isRefreshing: boolean;
  runningPtyIds: Record<string, string>;
  flutterAvailable: boolean | null;

  // Actions
  refreshDevices: () => Promise<void>;
  selectDevice: (id: string | null) => void;
  startEmulator: (emulatorId: string) => Promise<void>;
  runOnDevice: (deviceId: string, projectPath: string, platform: string) => Promise<string>;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useDeviceStore = create<DeviceState>()(
  immer((set, get) => ({
    devices: [],
    emulators: [],
    selectedDeviceId: null,
    isRefreshing: false,
    runningPtyIds: {},
    flutterAvailable: null,

    refreshDevices: async () => {
      set((s) => { s.isRefreshing = true; });

      const flutterSdkPath = useSettingsStore.getState().flutterSdkPath || undefined;

      try {
        const [devices, emulators] = await Promise.all([
          invoke<DeviceInfo[]>('list_devices', { flutterSdkPath }).catch((e: unknown) => {
            const err = String(e);
            if (err === 'flutter_not_found' || err.includes('flutter_not_found')) {
              set((s) => { s.flutterAvailable = false; });
            }
            return [] as DeviceInfo[];
          }),
          invoke<EmulatorInfo[]>('list_emulators', { flutterSdkPath }).catch(() => [] as EmulatorInfo[]),
        ]);

        set((s) => {
          s.devices = devices;
          s.emulators = emulators;
          s.isRefreshing = false;
          if (devices.length > 0) s.flutterAvailable = true;
          // Auto-select first available device if none selected
          if (!s.selectedDeviceId && devices.length > 0) {
            const available = devices.find((d) => d.available);
            if (available) s.selectedDeviceId = available.id;
          }
        });
      } catch {
        set((s) => { s.isRefreshing = false; });
      }
    },

    selectDevice: (id) => {
      set((s) => { s.selectedDeviceId = id; });
    },

    startEmulator: async (emulatorId) => {
      const flutterSdkPath = useSettingsStore.getState().flutterSdkPath || undefined;
      await invoke('start_emulator', { emulatorId, flutterSdkPath });
      // Wait a moment then refresh to see the device
      setTimeout(() => get().refreshDevices(), 5000);
    },

    runOnDevice: async (deviceId, projectPath, platform) => {
      const flutterSdkPath = useSettingsStore.getState().flutterSdkPath || undefined;
      const ptyId = await invoke<string>('run_on_device', {
        deviceId,
        projectPath,
        platform,
        flutterSdkPath,
      });
      set((s) => { s.runningPtyIds[deviceId] = ptyId; });
      return ptyId;
    },
  })),
);
