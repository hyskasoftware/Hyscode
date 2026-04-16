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
  /** "flutter" | "adb" */
  source: string;
}

export interface EmulatorInfo {
  id: string;
  name: string;
  platform: string;
  /** "flutter" | "avd" */
  source: string;
}

export interface SdkPaths {
  flutterBin: string | null;
  flutterSource: string | null;
  flutterVersion: string | null;
  adbBin: string | null;
  adbSource: string | null;
  adbVersion: string | null;
  androidSdkRoot: string | null;
}

// ── State ────────────────────────────────────────────────────────────────────

interface DeviceState {
  devices: DeviceInfo[];
  emulators: EmulatorInfo[];
  selectedDeviceId: string | null;
  isRefreshing: boolean;
  runningPtyIds: Record<string, string>;
  flutterAvailable: boolean | null;
  detectedSdkPaths: SdkPaths | null;

  // Actions
  refreshDevices: () => Promise<void>;
  selectDevice: (id: string | null) => void;
  startEmulator: (emulatorId: string) => Promise<void>;
  runOnDevice: (deviceId: string, projectPath: string, platform: string) => Promise<string>;
  checkSdkPaths: () => Promise<SdkPaths>;
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
    detectedSdkPaths: null,

    refreshDevices: async () => {
      set((s) => { s.isRefreshing = true; });

      const settings = useSettingsStore.getState();
      const flutterSdkPath = settings.flutterSdkPath || undefined;
      const androidSdkPath = settings.androidSdkPath || undefined;

      try {
        const [devices, emulators] = await Promise.all([
          invoke<DeviceInfo[]>('list_devices', { flutterSdkPath, androidSdkPath }).catch((e: unknown) => {
            const err = String(e);
            if (err === 'flutter_not_found' || err.includes('flutter_not_found')) {
              set((s) => { s.flutterAvailable = false; });
            }
            return [] as DeviceInfo[];
          }),
          invoke<EmulatorInfo[]>('list_emulators', { flutterSdkPath, androidSdkPath }).catch(() => [] as EmulatorInfo[]),
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
      const settings = useSettingsStore.getState();
      const flutterSdkPath = settings.flutterSdkPath || undefined;
      const androidSdkPath = settings.androidSdkPath || undefined;
      await invoke('start_emulator', { emulatorId, flutterSdkPath, androidSdkPath });
      // Wait a moment then refresh to see the device
      setTimeout(() => get().refreshDevices(), 5000);
    },

    runOnDevice: async (deviceId, projectPath, platform) => {
      const settings = useSettingsStore.getState();
      const flutterSdkPath = settings.flutterSdkPath || undefined;
      const androidSdkPath = settings.androidSdkPath || undefined;
      const ptyId = await invoke<string>('run_on_device', {
        deviceId,
        projectPath,
        platform,
        flutterSdkPath,
        androidSdkPath,
      });
      set((s) => { s.runningPtyIds[deviceId] = ptyId; });
      return ptyId;
    },

    checkSdkPaths: async () => {
      const settings = useSettingsStore.getState();
      const flutterSdkPath = settings.flutterSdkPath || undefined;
      const androidSdkPath = settings.androidSdkPath || undefined;
      const paths = await invoke<SdkPaths>('check_sdk_paths', { flutterSdkPath, androidSdkPath });
      set((s) => { s.detectedSdkPaths = paths; });
      return paths;
    },
  })),
);
