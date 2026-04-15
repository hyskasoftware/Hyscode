# HysCode Extension Development Guide

## Quick Start

An extension is a folder (or `.zip` file) containing at minimum an `extension.json` manifest.

### Minimal Extension Structure

```
my-extension/
  extension.json      # Required: manifest
  main.js             # Optional: code entry point
  themes/             # Optional: theme JSON files
  snippets/           # Optional: snippet files
  README.md           # Optional: documentation
```

### extension.json (Manifest)

```json
{
  "name": "my-extension",
  "displayName": "My Extension",
  "version": "1.0.0",
  "description": "A sample HysCode extension",
  "publisher": "your-name",
  "engines": { "hyscode": ">=0.1.0" },
  "categories": ["Themes", "Languages", "Snippets"],
  "icon": "icon.png",
  "main": "main.js",
  "activationEvents": ["onStartup"],
  "contributes": {
    "commands": [
      {
        "id": "my-extension.helloWorld",
        "title": "Hello World",
        "category": "My Extension"
      }
    ],
    "keybindings": [
      {
        "command": "my-extension.helloWorld",
        "key": "ctrl+shift+h"
      }
    ],
    "themes": [
      {
        "id": "my-dark-theme",
        "label": "My Dark Theme",
        "uiTheme": "hyscode-dark",
        "path": "themes/dark.json"
      }
    ],
    "languages": [
      {
        "id": "mylang",
        "aliases": ["My Language"],
        "extensions": [".ml"],
        "configuration": "language-configuration.json"
      }
    ],
    "statusBarItems": [
      {
        "id": "my-extension.status",
        "text": "My Ext",
        "tooltip": "My Extension Status",
        "alignment": "right",
        "priority": 100
      }
    ],
    "configuration": {
      "title": "My Extension",
      "properties": {
        "myExtension.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable My Extension"
        }
      }
    },
    "snippets": [
      {
        "language": "javascript",
        "path": "snippets/javascript.json"
      }
    ],
    "menus": {
      "editor/context": [
        { "command": "my-extension.helloWorld", "group": "navigation" }
      ],
      "commandPalette": [
        { "command": "my-extension.helloWorld" }
      ]
    }
  }
}
```

## Extension Code (main.js)

If your extension has a `main` entry, it must export `activate()` and optionally `deactivate()`:

```javascript
// main.js
export function activate(context) {
  // context.extensionName - the name from manifest
  // context.extensionPath - path to extension folder
  // context.subscriptions  - disposables array (cleaned up on deactivate)
  // context.globalState    - persistent key-value store
  // context.workspaceState - workspace-scoped key-value store

  console.log(`${context.extensionName} is now active!`);

  // Register a command
  // The HysCode API is available through the context
}

export function deactivate() {
  // Cleanup logic
  console.log('Extension deactivated');
}
```

### HysCode API

Extensions receive access to these APIs:

| API | Description |
|-----|-------------|
| `workspace` | File operations (read, write, list), event hooks |
| `commands` | Register/execute commands |
| `window` | Show messages, create status bar items, register views |
| `editor` | Open files, get selection, insert text, add decorations |
| `settings` | Read/write configuration values |
| `git` | Branch info, status, diff |
| `themes` | Register themes programmatically |
| `languages` | Register languages and language servers |
| `notifications` | Show info/warning/error/progress notifications |
| `extensions` | Query other installed extensions |

## Installation Methods

### From Folder
1. Open Extensions panel (sidebar)
2. Click the folder icon
3. Select the extension folder containing `extension.json`

### From .zip File
1. Open Extensions panel (sidebar)
2. Click the archive icon (.zip)
3. Select the `.zip` file

The zip can contain:
- Files at root level with `extension.json` at the top
- A single folder containing `extension.json`

### Packaging as .zip

```bash
# From your extension directory:
cd my-extension
zip -r ../my-extension-1.0.0.zip .

# Or from parent directory:
zip -r my-extension-1.0.0.zip my-extension/
```

## Contribution Points Reference

### themes
Color themes for the editor and UI.

### languages
Language grammars, configurations, and file associations.

### languageServers
LSP server configurations for language support.

### commands
Commands that appear in the command palette.

### keybindings
Keyboard shortcuts bound to commands.

### views
Custom sidebar views.

### statusBarItems
Items displayed in the status bar.

### configuration
Extension settings with types, defaults, and descriptions.

### snippets
Code snippets for specific languages.

### menus
Context menu and command palette menu items.

### iconThemes
File icon themes for the explorer.

## Theme Extension Example

A theme-only extension needs no `main.js`:

```json
{
  "name": "midnight-blue",
  "displayName": "Midnight Blue Theme",
  "version": "1.0.0",
  "description": "A deep blue dark theme",
  "publisher": "your-name",
  "engines": { "hyscode": ">=0.1.0" },
  "categories": ["Themes"],
  "contributes": {
    "themes": [
      {
        "id": "midnight-blue",
        "label": "Midnight Blue",
        "uiTheme": "hyscode-dark",
        "path": "themes/midnight-blue.json"
      }
    ]
  }
}
```

## Best Practices

1. **Name your extension** with a unique prefix (e.g., `publisher.extension-name`)
2. **Use categories** to help users find your extension
3. **Always provide a description** and display name
4. **Use activation events** to defer loading — avoid `onStartup` if possible
5. **Clean up in deactivate()** — dispose of listeners, timers, etc.
6. **Test your .zip** — ensure `extension.json` is at root or one level deep
7. **Validate manifest** — all required fields must be present
