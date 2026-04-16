// React Support Extension — main.js
// Provides runtime commands and React-specific functionality

export function activate(context) {
  console.log('[react-support] Extension activated');

  const api = context._api || globalThis.hyscode;
  if (!api) {
    console.warn('[react-support] HysCode API not available');
    return;
  }

  if (api.commands) {
    // ── Wrap Selection with React Fragment ─────────────────────────────────
    api.commands.register('react-support.wrapWithFragment', async () => {
      if (!api.editor) return;
      const selection = api.editor.getSelection?.();
      if (!selection) return;
      const text = selection.text || '';
      const indented = text.split('\n').map(l => '  ' + l).join('\n');
      api.editor.replaceSelection?.(`<>\n${indented}\n</>`);
    });

    // ── Wrap Selection with <div> ──────────────────────────────────────────
    api.commands.register('react-support.wrapWithDiv', async () => {
      if (!api.editor) return;
      const selection = api.editor.getSelection?.();
      if (!selection) return;
      const text = selection.text || '';
      const indented = text.split('\n').map(l => '  ' + l).join('\n');
      api.editor.replaceSelection?.(`<div>\n${indented}\n</div>`);
    });

    // ── New React Component ────────────────────────────────────────────────
    api.commands.register('react-support.newComponent', async () => {
      const name = await api.window?.showInputBox?.({
        prompt: 'Component name',
        placeHolder: 'MyComponent',
      });
      if (!name) return;

      const content = `interface ${name}Props {
  // props
}

export function ${name}({}: ${name}Props) {
  return (
    <div>
      ${name}
    </div>
  );
}
`;
      if (api.workspace && api.workspace.createFile) {
        await api.workspace.createFile(`${name}.tsx`, content);
      }
    });

    // ── Toggle JSX Comment ─────────────────────────────────────────────────
    api.commands.register('react-support.toggleJsxComment', async () => {
      if (!api.editor) return;
      const selection = api.editor.getSelection?.();
      if (!selection) return;
      const text = selection.text || '';
      const trimmed = text.trim();
      // If already wrapped in JSX comment, unwrap
      if (trimmed.startsWith('{/*') && trimmed.endsWith('*/}')) {
        const inner = trimmed.slice(3, -3).trim();
        api.editor.replaceSelection?.(inner);
      } else {
        api.editor.replaceSelection?.(`{/* ${text} */}`);
      }
    });
  }

  console.log('[react-support] Commands registered');
}

export function deactivate() {
  console.log('[react-support] Extension deactivated');
}
