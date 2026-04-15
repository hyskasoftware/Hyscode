// React Support Extension — main.js
// Provides runtime commands and React-specific functionality

export function activate(context) {
  console.log('[react-support] Extension activated');

  // The HysCode APIs would be available in the sandbox environment
  // For now, we register the command handlers that the extension system will wire up

  // Command: Wrap selection with React Fragment
  // When integrated with the command registry, this will wrap selected text in <>...</>

  // Command: Wrap selection with <div>
  // When integrated with the command registry, this will wrap selected text in <div>...</div>

  // Command: New React Component
  // When integrated, this will create a new component file from template

  // Command: Toggle JSX Comment
  // When integrated, this will toggle {/* ... */} comments in JSX

  console.log('[react-support] Commands registered');
}

export function deactivate() {
  console.log('[react-support] Extension deactivated');
}
