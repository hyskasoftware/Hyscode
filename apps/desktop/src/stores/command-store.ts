/**
 * Command Store
 *
 * Central command registry for the IDE. Holds both built-in commands and
 * extension-registered commands. Provides execute, lookup, and change
 * notification so the Command Palette can render a searchable list.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ── Types ────────────────────────────────────────────────────────────────────

type CommandHandler = (...args: unknown[]) => unknown;

export interface RegisteredCommand {
  id: string;
  title: string;
  category?: string;
  handler: CommandHandler;
  /** Which extension registered it (undefined = built-in) */
  extensionName?: string;
  /** Keybinding label for display, e.g. "Ctrl+Shift+P" */
  keybindingLabel?: string;
}

interface CommandState {
  commands: Record<string, RegisteredCommand>;

  /**
   * Register a command. Returns a dispose function.
   */
  registerCommand: (
    id: string,
    handler: CommandHandler,
    meta?: { title?: string; category?: string; extensionName?: string },
  ) => () => void;

  /**
   * Unregister a command by id.
   */
  unregisterCommand: (id: string) => void;

  /**
   * Execute a command by id.
   */
  executeCommand: (id: string, ...args: unknown[]) => Promise<unknown>;

  /**
   * Check if a command is registered.
   */
  hasCommand: (id: string) => boolean;

  /**
   * Get all registered commands as a flat list.
   */
  getAllCommands: () => RegisteredCommand[];

  /**
   * Set keybinding label on a command (for display in palette).
   */
  setKeybindingLabel: (commandId: string, label: string) => void;

  /**
   * Remove all commands from a specific extension.
   */
  removeExtensionCommands: (extensionName: string) => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useCommandStore = create<CommandState>()(
  immer((set, get) => ({
    commands: {},

    registerCommand: (id, handler, meta) => {
      set((s) => {
        s.commands[id] = {
          id,
          title: meta?.title ?? id,
          category: meta?.category,
          handler,
          extensionName: meta?.extensionName,
        };
      });
      return () => {
        set((s) => {
          delete s.commands[id];
        });
      };
    },

    unregisterCommand: (id) => {
      set((s) => {
        delete s.commands[id];
      });
    },

    executeCommand: async (id, ...args) => {
      const cmd = get().commands[id];
      if (!cmd) {
        console.warn(`[CommandStore] Command "${id}" not found.`);
        return undefined;
      }
      try {
        return await cmd.handler(...args);
      } catch (err) {
        console.error(`[CommandStore] Error executing "${id}":`, err);
        throw err;
      }
    },

    hasCommand: (id) => {
      return id in get().commands;
    },

    getAllCommands: () => {
      return Object.values(get().commands);
    },

    setKeybindingLabel: (commandId, label) => {
      set((s) => {
        if (s.commands[commandId]) {
          s.commands[commandId].keybindingLabel = label;
        }
      });
    },

    removeExtensionCommands: (extensionName) => {
      set((s) => {
        for (const id of Object.keys(s.commands)) {
          if (s.commands[id].extensionName === extensionName) {
            delete s.commands[id];
          }
        }
      });
    },
  })),
);
