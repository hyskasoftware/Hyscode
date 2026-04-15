// Sample Extension - main.js
// This file demonstrates the extension activation lifecycle

export function activate(context) {
  console.log(`[${context.extensionName}] Extension activated!`);
  console.log(`[${context.extensionName}] Extension path: ${context.extensionPath}`);

  // You can store data in the global or workspace state
  const launchCount = context.globalState.get('launchCount', 0) + 1;
  context.globalState.update('launchCount', launchCount);

  console.log(`[${context.extensionName}] Launch count: ${launchCount}`);
}

export function deactivate() {
  console.log('[sample-extension] Extension deactivated. Goodbye!');
}
