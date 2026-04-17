/**
 * todo-tree — Extensão Todo Tree para HysCode
 * Escaneia workspace buscando TODO/FIXME/BUG/HACK e exibe em árvore navegável
 */

'use strict';

/** @type {import('../extension-api/src').HysCodeAPI | null} */
let api = null;

/** @type {Array<() => void>} */
let disposables = [];

/** @type {Array<TodoItem>} */
let allResults = [];

/** @type {number} */
let currentIndex = -1;

/** @type {string|null} */
let activeFilter = null;

/** @type {boolean} */
let highlightsEnabled = true;

/**
 * @typedef {{ tag: string, text: string, file: string, line: number, col: number }} TodoItem
 */

function register(id, handler) {
  const d = api.commands.register(id, handler);
  disposables.push(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Activate
// ─────────────────────────────────────────────────────────────────────────────

export function activate(context) {
  api = context._api || globalThis.hyscode;

  highlightsEnabled = getSetting('todoTree.highlightEnabled', true);

  // ── Refresh / scan ────────────────────────────────────────────────────────

  register('todoTree.refresh', async () => {
    const progress = api.notifications?.progress?.('Scanning TODOs...');
    try {
      allResults = await scanWorkspace();
      currentIndex = -1;
      updateStatusBar();
      updateTreeView();
      api.notifications?.info?.(`Found ${allResults.length} TODO items`);
    } finally {
      progress?.done?.();
    }
  });

  // ── Add tag ───────────────────────────────────────────────────────────────

  register('todoTree.addTag', async () => {
    const tag = await api.window.showInputBox({
      prompt: 'Nome da nova tag (ex: REVIEW, DEPRECATED)',
      placeholder: 'REVIEW',
    });
    if (!tag) return;

    const tags = getSetting('todoTree.tags', defaultTags());
    if (!tags.includes(tag.toUpperCase())) {
      tags.push(tag.toUpperCase());
      api.settings?.set?.('todoTree.tags', tags);
      api.notifications?.info?.(`Tag "${tag.toUpperCase()}" adicionada`);
    }
  });

  // ── Remove tag ────────────────────────────────────────────────────────────

  register('todoTree.removeTag', async () => {
    const tags = getSetting('todoTree.tags', defaultTags());
    const choice = await api.window.showQuickPick(
      tags.map(t => ({ label: t })),
      { placeholder: 'Selecionar tag para remover' },
    );
    if (!choice) return;

    const updated = tags.filter(t => t !== choice.label);
    api.settings?.set?.('todoTree.tags', updated);
    api.notifications?.info?.(`Tag "${choice.label}" removida`);
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  register('todoTree.goToNext', () => {
    const items = filteredResults();
    if (items.length === 0) {
      api.notifications?.warning?.('Nenhum TODO encontrado. Execute Refresh primeiro.');
      return;
    }
    currentIndex = (currentIndex + 1) % items.length;
    goToItem(items[currentIndex]);
  });

  register('todoTree.goToPrevious', () => {
    const items = filteredResults();
    if (items.length === 0) {
      api.notifications?.warning?.('Nenhum TODO encontrado. Execute Refresh primeiro.');
      return;
    }
    currentIndex = (currentIndex - 1 + items.length) % items.length;
    goToItem(items[currentIndex]);
  });

  // ── Export ────────────────────────────────────────────────────────────────

  register('todoTree.exportTree', async () => {
    if (allResults.length === 0) {
      api.notifications?.warning?.('Nenhum TODO encontrado. Execute Refresh primeiro.');
      return;
    }

    const groupBy = getSetting('todoTree.groupBy', 'tag');
    const md = exportAsMarkdown(allResults, groupBy);
    const filename = 'TODO_REPORT.md';

    await api.workspace.createFile(filename, md);
    await api.editor?.openFile?.(filename);
    api.notifications?.info?.(`Relatório exportado: ${filename}`);
  });

  // ── Scope ─────────────────────────────────────────────────────────────────

  register('todoTree.switchScope', async () => {
    const choice = await api.window.showQuickPick([
      { label: 'Workspace', description: 'workspace' },
      { label: 'Open Files', description: 'openFiles' },
      { label: 'Current File', description: 'currentFile' },
    ], { placeholder: 'Escopo de varredura' });
    if (!choice) return;

    api.settings?.set?.('todoTree.scanMode', choice.description);
    api.notifications?.info?.(`Escopo: ${choice.label}`);
  });

  // ── Filters ───────────────────────────────────────────────────────────────

  register('todoTree.filterByTag', async () => {
    const tags = getSetting('todoTree.tags', defaultTags());
    const choice = await api.window.showQuickPick(
      [{ label: 'All' }, ...tags.map(t => ({ label: t }))],
      { placeholder: 'Filtrar por tag' },
    );
    if (!choice) return;

    activeFilter = choice.label === 'All' ? null : choice.label;
    updateTreeView();
    api.notifications?.info?.(activeFilter ? `Filtro: ${activeFilter}` : 'Filtro removido');
  });

  register('todoTree.clearFilter', () => {
    activeFilter = null;
    updateTreeView();
    api.notifications?.info?.('Filtro limpo');
  });

  // ── Toggle highlights ─────────────────────────────────────────────────────

  register('todoTree.toggleHighlights', () => {
    highlightsEnabled = !highlightsEnabled;
    api.notifications?.info?.(highlightsEnabled ? 'Highlights ativados' : 'Highlights desativados');
  });

  // ── Show counts ───────────────────────────────────────────────────────────

  register('todoTree.showCounts', () => {
    if (allResults.length === 0) {
      api.notifications?.info?.('Nenhum TODO encontrado. Execute Refresh.');
      return;
    }

    const counts = {};
    for (const item of allResults) {
      counts[item.tag] = (counts[item.tag] || 0) + 1;
    }

    const lines = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => `${tag}: ${count}`)
      .join('  |  ');

    api.notifications?.info?.(`Total: ${allResults.length} — ${lines}`);
  });

  // ── Status bar ────────────────────────────────────────────────────────────

  try {
    const statusBar = api.window.createStatusBarItem({
      id: 'todoTree.statusBar',
      text: '$(checklist) TODOs: —',
      tooltip: 'Todo Tree — Ctrl+Shift+T para refresh',
      command: 'todoTree.refresh',
      alignment: 'right',
      priority: 30,
    });
    disposables.push(statusBar);
  } catch {
    // ignore
  }

  // Auto-scan on activation
  setTimeout(() => {
    api.commands?.execute?.('todoTree.refresh');
  }, 2000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Deactivate
// ─────────────────────────────────────────────────────────────────────────────

export function deactivate() {
  disposables.forEach(d => {
    if (typeof d === 'function') d();
    else if (d && typeof d.dispose === 'function') d.dispose();
  });
  disposables = [];
  allResults = [];
  currentIndex = -1;
  activeFilter = null;
  api = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core scanning
// ─────────────────────────────────────────────────────────────────────────────

async function scanWorkspace() {
  const tags = getSetting('todoTree.tags', defaultTags());
  const excludeGlobs = getSetting('todoTree.excludeGlobs', defaultExcludes());
  const maxResults = getSetting('todoTree.maxResults', 5000);

  if (tags.length === 0) return [];

  const tagPattern = tags.map(t => escapeRegex(t)).join('|');
  const regex = new RegExp(`(?:^|[^a-zA-Z])(${tagPattern})[:\\s](.*)`, 'i');

  const results = [];

  try {
    const files = await listAllFiles(excludeGlobs);

    for (const file of files) {
      if (results.length >= maxResults) break;

      try {
        const content = await api.workspace.readFile(file);
        if (!content) continue;

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const match = regex.exec(lines[i]);
          if (match) {
            results.push({
              tag: match[1].toUpperCase(),
              text: match[2].trim(),
              file,
              line: i + 1,
              col: match.index,
            });

            if (results.length >= maxResults) break;
          }
        }
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // fallback: no workspace listing available
  }

  return results;
}

async function listAllFiles(excludeGlobs) {
  const files = [];

  async function walk(dir) {
    try {
      const entries = await api.workspace.listDir(dir);
      if (!entries) return;

      for (const entry of entries) {
        const path = dir ? `${dir}/${entry.name || entry}` : (entry.name || entry);
        const name = entry.name || entry;

        if (shouldExclude(path, excludeGlobs)) continue;

        if (entry.isDirectory || (typeof entry === 'string' && name.endsWith('/'))) {
          await walk(path.replace(/\/$/, ''));
        } else {
          if (isTextFile(name)) {
            files.push(path);
          }
        }
      }
    } catch {
      // skip inaccessible directories
    }
  }

  await walk('');
  return files;
}

function isTextFile(name) {
  const exts = [
    '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
    '.py', '.rs', '.go', '.java', '.kt', '.scala',
    '.c', '.cpp', '.h', '.hpp', '.cs',
    '.rb', '.php', '.swift', '.dart',
    '.html', '.css', '.scss', '.less', '.sass',
    '.yaml', '.yml', '.json', '.toml', '.ini', '.cfg',
    '.md', '.txt', '.rst',
    '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
    '.sql', '.graphql', '.gql',
    '.vue', '.svelte', '.astro',
    '.xml', '.svg',
    '.env', '.gitignore', '.dockerignore',
    '.prisma', '.proto',
  ];
  return exts.some(ext => name.endsWith(ext));
}

function shouldExclude(path, excludeGlobs) {
  const normalised = path.replace(/\\/g, '/');
  const excludeSegments = [
    'node_modules', 'dist', 'build', '.git', 'target',
    '__pycache__', 'vendor', '.next', '.nuxt', 'coverage',
    '.turbo', '.cache',
  ];
  return excludeSegments.some(seg => normalised.includes(`/${seg}/`) || normalised.startsWith(`${seg}/`));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function defaultTags() {
  return ['TODO', 'FIXME', 'BUG', 'HACK', 'XXX', 'NOTE', 'WARN', 'PERF'];
}

function defaultExcludes() {
  return ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/target/**', '**/__pycache__/**', '**/vendor/**'];
}

function filteredResults() {
  if (!activeFilter) return allResults;
  return allResults.filter(r => r.tag === activeFilter);
}

function goToItem(item) {
  if (!item) return;
  api.editor?.openFile?.(item.file);
  api.editor?.goToLine?.(item.line);
  api.notifications?.info?.(`[${item.tag}] ${item.file}:${item.line} — ${item.text.slice(0, 60)}`);
}

function updateStatusBar() {
  try {
    const mode = getSetting('todoTree.statusBar', 'total');
    let text = `$(checklist) TODOs: ${allResults.length}`;

    if (mode === 'perTag') {
      const counts = {};
      for (const item of allResults) {
        counts[item.tag] = (counts[item.tag] || 0) + 1;
      }
      const parts = Object.entries(counts).slice(0, 4).map(([t, c]) => `${t}:${c}`);
      text = `$(checklist) ${parts.join(' ')}`;
    } else if (mode === 'topThree') {
      const counts = {};
      for (const item of allResults) {
        counts[item.tag] = (counts[item.tag] || 0) + 1;
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
      text = `$(checklist) ${top.map(([t, c]) => `${t}:${c}`).join(' ')}`;
    }

    api.window.createStatusBarItem?.({
      id: 'todoTree.statusBar',
      text,
      tooltip: `Todo Tree — ${allResults.length} items`,
      command: 'todoTree.refresh',
      alignment: 'right',
      priority: 30,
    });
  } catch {
    // ignore
  }
}

function updateTreeView() {
  const items = filteredResults();
  const groupBy = getSetting('todoTree.groupBy', 'tag');

  try {
    if (!api.views?.updateTreeView) return;

    if (groupBy === 'tag') {
      const groups = {};
      for (const item of items) {
        if (!groups[item.tag]) groups[item.tag] = [];
        groups[item.tag].push(item);
      }

      const tree = Object.entries(groups).map(([tag, tagItems]) => ({
        label: `${tag} (${tagItems.length})`,
        children: tagItems.map(i => ({
          label: `${i.file}:${i.line}`,
          description: i.text.slice(0, 80),
          command: { command: 'todoTree.goToNext' },
        })),
      }));

      api.views.updateTreeView('todoTree.panel', tree);
    } else if (groupBy === 'file') {
      const groups = {};
      for (const item of items) {
        if (!groups[item.file]) groups[item.file] = [];
        groups[item.file].push(item);
      }

      const tree = Object.entries(groups).map(([file, fileItems]) => ({
        label: `${file} (${fileItems.length})`,
        children: fileItems.map(i => ({
          label: `L${i.line} [${i.tag}]`,
          description: i.text.slice(0, 80),
        })),
      }));

      api.views.updateTreeView('todoTree.panel', tree);
    } else {
      const tree = items.map(i => ({
        label: `[${i.tag}] ${i.file}:${i.line}`,
        description: i.text.slice(0, 80),
      }));

      api.views.updateTreeView('todoTree.panel', tree);
    }
  } catch {
    // tree view API may not be available
  }
}

function exportAsMarkdown(items, groupBy) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let md = `# TODO Report\n\nGenerated: ${now}\nTotal: ${items.length}\n\n`;

  if (groupBy === 'tag') {
    const groups = {};
    for (const item of items) {
      if (!groups[item.tag]) groups[item.tag] = [];
      groups[item.tag].push(item);
    }

    for (const [tag, tagItems] of Object.entries(groups).sort()) {
      md += `## ${tag} (${tagItems.length})\n\n`;
      for (const i of tagItems) {
        md += `- **${i.file}:${i.line}** — ${i.text}\n`;
      }
      md += '\n';
    }
  } else {
    const groups = {};
    for (const item of items) {
      if (!groups[item.file]) groups[item.file] = [];
      groups[item.file].push(item);
    }

    for (const [file, fileItems] of Object.entries(groups).sort()) {
      md += `## ${file}\n\n`;
      for (const i of fileItems) {
        md += `- **L${i.line}** [${i.tag}] ${i.text}\n`;
      }
      md += '\n';
    }
  }

  return md;
}

function getSetting(key, defaultValue) {
  try {
    const val = api.settings?.get?.(key);
    return val !== undefined && val !== null ? val : defaultValue;
  } catch {
    return defaultValue;
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
