/**
 * todo-tree — Extensão Todo Tree para HysCode
 * Escaneia workspace buscando TODO/FIXME/BUG/HACK e exibe em árvore navegável
 */

'use strict';

/** @type {import('../extension-api/src').HyscodeAPI | null} */
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

/** @type {string} */
let searchQuery = '';

/**
 * @typedef {{ tag: string, text: string, file: string, line: number, col: number }} TodoItem
 */

// ── Tag colours ──────────────────────────────────────────────────────────────

const TAG_COLORS = {
  TODO:  '#3b82f6', // blue
  FIXME: '#f59e0b', // amber
  BUG:   '#ef4444', // red
  HACK:  '#a855f7', // purple
  XXX:   '#ec4899', // pink
  NOTE:  '#22c55e', // green
  WARN:  '#f97316', // orange
  PERF:  '#06b6d4', // cyan
};

const TAG_ICONS = {
  TODO:  '$(check)',
  FIXME: '$(warning)',
  BUG:   '$(bug)',
  HACK:  '$(lightbulb)',
  XXX:   '$(warning)',
  NOTE:  '$(bookmark)',
  WARN:  '$(warning)',
  PERF:  '$(lightbulb)',
};

function register(id, handler) {
  const d = api.commands.register(id, handler);
  disposables.push(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Activate
// ─────────────────────────────────────────────────────────────────────────────

export function activate(context) {
  console.log('[TodoTree] activate() called, context._api=', !!context._api, 'globalThis.hyscode=', !!globalThis.hyscode);
  api = context._api || globalThis.hyscode;
  console.log('[TodoTree] api=', !!api, 'api.views=', !!(api && api.views), 'api.views.updateView=', !!(api && api.views && api.views.updateView));

  highlightsEnabled = getSetting('todoTree.highlightEnabled', true);

  // ── Refresh / scan ────────────────────────────────────────────────────────

  register('todoTree.refresh', async () => {
    showScanningView();
    const progress = api.notifications?.progress?.('Scanning TODOs...');
    try {
      allResults = await scanWorkspace();
      currentIndex = -1;
      updateStatusBar();
      renderView();
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

  // ── Navigate to specific item ─────────────────────────────────────────────

  register('todoTree.goToItem', (file, line) => {
    if (!file) return;
    api.editor?.openFile?.(file);
    if (line) api.editor?.goToLine?.(line);
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
    renderView();
    api.notifications?.info?.(activeFilter ? `Filtro: ${activeFilter}` : 'Filtro removido');
  });

  register('todoTree.clearFilter', () => {
    activeFilter = null;
    renderView();
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

  // ── Search listener ───────────────────────────────────────────────────────

  try {
    const d = api.views.onDidChangeSearch('todoTree.panel', (query) => {
      searchQuery = query;
      renderView();
    });
    disposables.push(d);
  } catch {
    // views API may not be available yet
  }

  // Show initial welcome state
  console.log('[TodoTree] About to call showWelcomeView()');
  showWelcomeView();
  console.log('[TodoTree] showWelcomeView() returned');

  // Auto-scan on activation
  setTimeout(() => {
    api.commands?.execute?.('todoTree.refresh');
  }, 2000);

  // Settings tab
  if (api.settings?.updateTabContent) {
    api.settings.updateTabContent('todo-tree.settings', {
      sections: [
        {
          title: 'Scanning',
          items: [
            { type: 'select', key: 'scanMode', label: 'Scan Mode', description: 'Scope of TODO scanning', defaultValue: 'workspace', options: [{ value: 'workspace', label: 'Workspace' }, { value: 'openFiles', label: 'Open Files' }, { value: 'currentFile', label: 'Current File' }] },
          ],
        },
        {
          title: 'Editor Highlights',
          items: [
            { type: 'toggle', key: 'highlightEnabled', label: 'Enable Highlights', description: 'Highlight TODO tags directly in the editor', defaultValue: true },
          ],
        },
      ],
    });
  }
}
  disposables.forEach(d => {
    if (typeof d === 'function') d();
    else if (d && typeof d.dispose === 'function') d.dispose();
  });
  disposables = [];
  allResults = [];
  currentIndex = -1;
  activeFilter = null;
  searchQuery = '';
  api = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// View Rendering
// ─────────────────────────────────────────────────────────────────────────────

function showWelcomeView() {
  console.log('[TodoTree] showWelcomeView() — api=', !!api, 'api.views=', !!(api && api.views));
  try {
    console.log('[TodoTree] calling api.views.updateView(todoTree.panel)...');
    api.views.updateView('todoTree.panel', {
      type: 'welcome',
      welcome: {
        icon: '$(check)',
        title: 'Todo Tree',
        description: 'Scan your workspace to find TODO, FIXME, BUG, HACK and other tags in your codebase.',
        actions: [
          { id: 'scan', label: 'Scan Workspace', icon: '$(refresh)', command: 'todoTree.refresh' },
        ],
      },
    });
    console.log('[TodoTree] api.views.updateView(todoTree.panel) SUCCESS');
  } catch (e) {
    console.error('[TodoTree] api.views.updateView FAILED:', e);
  }
}

function showScanningView() {
  try {
    api.views.updateView('todoTree.panel', {
      type: 'sections',
      sections: [
        {
          id: 'scanning',
          title: 'Scanning',
          collapsible: false,
          type: 'progress',
          progress: { label: 'Scanning workspace for TODO tags...' },
        },
      ],
    });
  } catch {
    // views API not ready
  }
}

function renderView() {
  try {
    const items = getVisibleItems();
    const groupBy = getSetting('todoTree.groupBy', 'tag');

    // ── Compute tag counts ──────────────────────────────────────────────────
    const tagCounts = {};
    for (const item of allResults) {
      tagCounts[item.tag] = (tagCounts[item.tag] || 0) + 1;
    }

    // ── Stats section ───────────────────────────────────────────────────────
    const stats = [
      { label: 'Total', value: allResults.length, icon: '$(check)', color: '#8b5cf6' },
    ];
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    for (const [tag, count] of topTags) {
      stats.push({
        label: tag,
        value: count,
        icon: TAG_ICONS[tag] || '$(check)',
        color: TAG_COLORS[tag] || '#8b5cf6',
      });
    }

    // ── Build grouped tree sections ─────────────────────────────────────────
    const treeSections = [];

    if (items.length === 0 && allResults.length > 0) {
      // Search / filter returned nothing
      treeSections.push({
        id: 'no-results',
        title: 'No Matches',
        collapsible: false,
        type: 'actions',
        actions: [
          { id: 'clear-filter', label: 'Clear Filter', icon: '$(filter)', command: 'todoTree.clearFilter' },
        ],
      });
    } else if (groupBy === 'tag') {
      const groups = {};
      for (const item of items) {
        if (!groups[item.tag]) groups[item.tag] = [];
        groups[item.tag].push(item);
      }

      for (const [tag, tagItems] of Object.entries(groups).sort()) {
        treeSections.push({
          id: `tag-${tag}`,
          title: tag,
          collapsible: true,
          collapsed: false,
          badge: String(tagItems.length),
          badgeColor: TAG_COLORS[tag] || '#8b5cf6',
          type: 'tree',
          items: tagItems.map(todoToViewItem),
        });
      }
    } else if (groupBy === 'file') {
      const groups = {};
      for (const item of items) {
        if (!groups[item.file]) groups[item.file] = [];
        groups[item.file].push(item);
      }

      for (const [file, fileItems] of Object.entries(groups).sort()) {
        const shortName = file.split('/').pop() || file;
        treeSections.push({
          id: `file-${file}`,
          title: shortName,
          collapsible: true,
          collapsed: false,
          badge: String(fileItems.length),
          type: 'tree',
          items: fileItems.map(todoToViewItem),
        });
      }
    } else {
      // flat list
      treeSections.push({
        id: 'flat',
        title: 'All Items',
        collapsible: true,
        collapsed: false,
        badge: String(items.length),
        type: 'tree',
        items: items.map(todoToViewItem),
      });
    }

    // ── Compose full view ───────────────────────────────────────────────────
    const viewContent = {
      type: 'sections',
      toolbar: [
        { id: 'refresh', label: 'Refresh', icon: '$(refresh)', tooltip: 'Scan workspace', command: 'todoTree.refresh' },
        { id: 'filter', label: 'Filter by Tag', icon: '$(filter)', tooltip: 'Filter by tag', command: 'todoTree.filterByTag' },
        { id: 'export', label: 'Export', icon: '$(export)', tooltip: 'Export as Markdown', command: 'todoTree.exportTree' },
      ],
      searchable: true,
      searchPlaceholder: 'Search TODOs...',
      badge: allResults.length > 0 ? { count: allResults.length, tooltip: `${allResults.length} TODO items found` } : undefined,
      sections: [
        {
          id: 'stats',
          title: 'Overview',
          collapsible: true,
          collapsed: false,
          type: 'stats',
          stats,
        },
        ...treeSections,
      ],
      footer: activeFilter
        ? { text: `Filtered: ${activeFilter} — click to clear`, command: 'todoTree.clearFilter' }
        : { text: `${allResults.length} items in ${Object.keys(tagCounts).length} tags` },
    };

    api.views.updateView('todoTree.panel', viewContent);
  } catch (e) {
    // views API may not be available
    console.warn('[TodoTree] Failed to render view:', e);
  }
}

function todoToViewItem(item) {
  const shortFile = item.file.split('/').pop() || item.file;
  return {
    id: `${item.file}:${item.line}:${item.tag}`,
    label: item.text.slice(0, 80) || `${item.tag} at line ${item.line}`,
    description: `${shortFile}:${item.line}`,
    icon: TAG_ICONS[item.tag] || '$(check)',
    iconColor: TAG_COLORS[item.tag] || '#8b5cf6',
    tooltip: `[${item.tag}] ${item.file}:${item.line}\n${item.text}`,
    command: 'todoTree.goToItem',
    commandArgs: [item.file, item.line],
    badge: item.tag,
    badgeColor: TAG_COLORS[item.tag] || '#8b5cf6',
    contextMenu: [
      { id: 'goto', label: 'Go to Location', icon: '$(file-text)', command: 'todoTree.goToItem', commandArgs: [item.file, item.line] },
      { id: 'copy', label: 'Copy Text', icon: '$(file)', command: 'todoTree.goToItem', commandArgs: [item.file, item.line] },
    ],
  };
}

function getVisibleItems() {
  let items = filteredResults();

  // Apply search query
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    items = items.filter(item =>
      item.text.toLowerCase().includes(q) ||
      item.file.toLowerCase().includes(q) ||
      item.tag.toLowerCase().includes(q)
    );
  }

  return items;
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
    // api.settings.get is async — if it returns a Promise, fall back to defaultValue
    if (val === undefined || val === null || (typeof val === 'object' && typeof val.then === 'function')) {
      return defaultValue;
    }
    return val;
  } catch {
    return defaultValue;
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
