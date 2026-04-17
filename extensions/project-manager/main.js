/**
 * project-manager — Extensão Project Manager para HysCode
 * Salvar, organizar, alternar projetos com tags e auto-detecção de repos
 */

'use strict';

/** @type {import('../extension-api/src').HysCodeAPI | null} */
let api = null;

/** @type {Array<() => void>} */
let disposables = [];

/** @type {ProjectEntry[]} */
let projects = [];

/**
 * @typedef {{ name: string, path: string, tags: string[], lastOpened?: string }} ProjectEntry
 */

const PROJECTS_FILE = 'projects.json';

function register(id, handler) {
  const d = api.commands.register(id, handler);
  disposables.push(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Activate
// ─────────────────────────────────────────────────────────────────────────────

export function activate(context) {
  api = context._api || globalThis.hyscode;

  // Load stored projects
  loadProjects();

  // ── Save project ──────────────────────────────────────────────────────────

  register('projectManager.saveProject', async () => {
    const currentPath = getCurrentProjectPath();
    const defaultName = currentPath
      ? currentPath.split(/[/\\]/).filter(Boolean).pop()
      : '';

    const name = await api.window.showInputBox({
      prompt: 'Nome do projeto',
      placeholder: defaultName || 'My Project',
      value: defaultName,
    });
    if (!name) return;

    let path = currentPath;
    if (!path) {
      path = await api.window.showInputBox({
        prompt: 'Caminho do projeto',
        placeholder: '/home/user/projects/my-project',
      });
      if (!path) return;
    }

    // Ask for tags
    const tagsInput = await api.window.showInputBox({
      prompt: 'Tags (separadas por vírgula, ou vazio)',
      placeholder: 'web, react, personal',
    });
    const tags = tagsInput
      ? tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    // Check if project already exists
    const existing = projects.findIndex(p => p.path === path);
    if (existing >= 0) {
      projects[existing].name = name;
      projects[existing].tags = tags;
      projects[existing].lastOpened = new Date().toISOString();
    } else {
      projects.push({ name, path, tags, lastOpened: new Date().toISOString() });
    }

    await saveProjects();
    updateTreeView();
    updateStatusBar(name);
    api.notifications?.info?.(`Projeto "${name}" salvo!`);
  });

  // ── Edit projects ─────────────────────────────────────────────────────────

  register('projectManager.editProjects', async () => {
    const filePath = getProjectsFilePath();
    await api.editor?.openFile?.(filePath);
  });

  // ── List / open project ───────────────────────────────────────────────────

  register('projectManager.listProjects', async () => {
    const items = getProjectPickItems();
    if (items.length === 0) {
      api.notifications?.info?.('Nenhum projeto salvo. Use "Save Project" primeiro.');
      return;
    }

    const choice = await api.window.showQuickPick(items, {
      placeholder: 'Selecionar projeto para abrir',
    });
    if (!choice) return;

    const project = projects.find(p => p.path === choice.description);
    if (project) {
      project.lastOpened = new Date().toISOString();
      await saveProjects();
      openProject(project.path, false);
    }
  });

  // ── Open in new window ────────────────────────────────────────────────────

  register('projectManager.listProjectsNewWindow', async () => {
    const items = getProjectPickItems();
    if (items.length === 0) {
      api.notifications?.info?.('Nenhum projeto salvo.');
      return;
    }

    const choice = await api.window.showQuickPick(items, {
      placeholder: 'Abrir projeto em nova janela',
    });
    if (!choice) return;

    const project = projects.find(p => p.path === choice.description);
    if (project) {
      project.lastOpened = new Date().toISOString();
      await saveProjects();
      openProject(project.path, true);
    }
  });

  // ── Remove project ────────────────────────────────────────────────────────

  register('projectManager.removeProject', async () => {
    const items = projects.map(p => ({
      label: p.name,
      description: p.path,
    }));

    if (items.length === 0) {
      api.notifications?.info?.('Nenhum projeto salvo.');
      return;
    }

    const choice = await api.window.showQuickPick(items, {
      placeholder: 'Selecionar projeto para remover',
    });
    if (!choice) return;

    const confirm = await api.window.showInformationMessage(
      `Remover "${choice.label}" da lista?`,
      'Remover', 'Cancelar',
    );
    if (confirm !== 'Remover') return;

    projects = projects.filter(p => p.path !== choice.description);
    await saveProjects();
    updateTreeView();
    api.notifications?.info?.(`Projeto "${choice.label}" removido`);
  });

  // ── Filter by tag ─────────────────────────────────────────────────────────

  register('projectManager.filterByTag', async () => {
    const allTags = [...new Set(projects.flatMap(p => p.tags))].sort();
    if (allTags.length === 0) {
      api.notifications?.info?.('Nenhuma tag encontrada.');
      return;
    }

    const choice = await api.window.showQuickPick(
      [{ label: 'All' }, ...allTags.map(t => ({ label: t }))],
      { placeholder: 'Filtrar projetos por tag' },
    );
    if (!choice) return;

    const filtered = choice.label === 'All'
      ? projects
      : projects.filter(p => p.tags.includes(choice.label));

    const items = filtered.map(p => ({
      label: p.name,
      description: p.path,
      detail: p.tags.length ? `Tags: ${p.tags.join(', ')}` : undefined,
    }));

    const selected = await api.window.showQuickPick(items, {
      placeholder: `Projetos com tag "${choice.label}"`,
    });
    if (!selected) return;

    const project = projects.find(p => p.path === selected.description);
    if (project) {
      project.lastOpened = new Date().toISOString();
      await saveProjects();
      openProject(project.path, false);
    }
  });

  // ── Add tag to project ────────────────────────────────────────────────────

  register('projectManager.addTag', async () => {
    const items = projects.map(p => ({
      label: p.name,
      description: p.path,
      detail: p.tags.length ? `Tags: ${p.tags.join(', ')}` : 'Sem tags',
    }));

    if (items.length === 0) {
      api.notifications?.info?.('Nenhum projeto salvo.');
      return;
    }

    const choice = await api.window.showQuickPick(items, {
      placeholder: 'Selecionar projeto',
    });
    if (!choice) return;

    const tag = await api.window.showInputBox({
      prompt: 'Tag para adicionar',
      placeholder: 'work',
    });
    if (!tag) return;

    const project = projects.find(p => p.path === choice.description);
    if (project && !project.tags.includes(tag)) {
      project.tags.push(tag);
      await saveProjects();
      updateTreeView();
      api.notifications?.info?.(`Tag "${tag}" adicionada a "${project.name}"`);
    }
  });

  // ── Refresh auto-detected ─────────────────────────────────────────────────

  register('projectManager.refreshDetected', async () => {
    const baseFolders = getSetting('projectManager.baseFolders', []);
    if (baseFolders.length === 0) {
      api.notifications?.warning?.('Configure projectManager.baseFolders para auto-detecção');
      return;
    }

    const progress = api.notifications?.progress?.('Detectando projetos...');
    try {
      const detected = await detectRepositories(baseFolders);
      let added = 0;

      for (const repo of detected) {
        if (!projects.some(p => p.path === repo.path)) {
          projects.push(repo);
          added++;
        }
      }

      await saveProjects();
      updateTreeView();
      api.notifications?.info?.(`${detected.length} repos encontrados, ${added} novos adicionados`);
    } finally {
      progress?.done?.();
    }
  });

  // ── Open projects.json ────────────────────────────────────────────────────

  register('projectManager.openProjectsFile', async () => {
    const filePath = getProjectsFilePath();
    try {
      await api.editor?.openFile?.(filePath);
    } catch {
      api.notifications?.warning?.('Arquivo projects.json não encontrado. Salve um projeto primeiro.');
    }
  });

  // ── Status bar ────────────────────────────────────────────────────────────

  if (getSetting('projectManager.showProjectInStatusBar', true)) {
    try {
      const currentPath = getCurrentProjectPath();
      const currentProject = projects.find(p => p.path === currentPath);
      const projectName = currentProject?.name || getFolderName() || '—';

      const statusBar = api.window.createStatusBarItem({
        id: 'projectManager.statusBar',
        text: `$(folder) ${projectName}`,
        tooltip: 'Project Manager — Alt+Shift+P para trocar',
        command: 'projectManager.listProjects',
        alignment: 'left',
        priority: 100,
      });
      disposables.push(statusBar);
    } catch {
      // ignore
    }
  }

  updateTreeView();
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
  projects = [];
  api = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

function getProjectsFilePath() {
  const custom = getSetting('projectManager.projectsLocation', '');
  if (custom) return custom.endsWith('.json') ? custom : `${custom}/${PROJECTS_FILE}`;
  return PROJECTS_FILE;
}

async function loadProjects() {
  try {
    const filePath = getProjectsFilePath();
    const content = await api.workspace.readFile(filePath);
    if (content) {
      const parsed = JSON.parse(content);
      projects = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    projects = [];
  }
}

async function saveProjects() {
  try {
    const filePath = getProjectsFilePath();
    const content = JSON.stringify(projects, null, 2);
    await api.workspace.writeFile(filePath, content);
  } catch {
    // storage may not be available
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-detection
// ─────────────────────────────────────────────────────────────────────────────

async function detectRepositories(baseFolders) {
  const maxDepth = getSetting('projectManager.maxDepthRecursion', 3);
  const ignoredFolders = getSetting('projectManager.ignoredFolders', [
    'node_modules', '.git', 'dist', 'build', '__pycache__', '.cache',
  ]);
  const detectGit = getSetting('projectManager.detectGit', true);
  const detectSvn = getSetting('projectManager.detectSvn', false);
  const detectMercurial = getSetting('projectManager.detectMercurial', false);

  const vcsMarkers = [];
  if (detectGit) vcsMarkers.push('.git');
  if (detectSvn) vcsMarkers.push('.svn');
  if (detectMercurial) vcsMarkers.push('.hg');

  if (vcsMarkers.length === 0) return [];

  const found = [];

  async function scan(dir, depth) {
    if (depth > maxDepth) return;

    try {
      const entries = await api.workspace.listDir(dir);
      if (!entries) return;

      const names = entries.map(e => (typeof e === 'string' ? e : e.name));

      // Check if current directory is a repo
      const isRepo = vcsMarkers.some(marker => names.includes(marker) || names.includes(marker + '/'));
      if (isRepo) {
        const name = dir.split(/[/\\]/).filter(Boolean).pop() || dir;
        found.push({ name, path: dir, tags: ['detected'], lastOpened: null });
        return; // Don't recurse into repos
      }

      // Recurse into subdirectories
      for (const entry of entries) {
        const entryName = typeof entry === 'string' ? entry : entry.name;
        const isDir = entry.isDirectory || (typeof entry === 'string' && entry.endsWith('/'));
        const cleanName = entryName.replace(/\/$/, '');

        if (isDir && !ignoredFolders.includes(cleanName) && !cleanName.startsWith('.')) {
          await scan(`${dir}/${cleanName}`, depth + 1);
        }
      }
    } catch {
      // skip inaccessible directories
    }
  }

  for (const base of baseFolders) {
    await scan(base, 0);
  }

  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function getProjectPickItems() {
  const sortBy = getSetting('projectManager.sortList', 'name');
  const removeCurrentFromList = getSetting('projectManager.removeCurrentFromList', false);
  const currentPath = getCurrentProjectPath();

  let sorted = [...projects];

  if (removeCurrentFromList && currentPath) {
    sorted = sorted.filter(p => p.path !== currentPath);
  }

  if (sortBy === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'recent') {
    sorted.sort((a, b) => {
      if (!a.lastOpened) return 1;
      if (!b.lastOpened) return -1;
      return b.lastOpened.localeCompare(a.lastOpened);
    });
  }

  return sorted.map(p => ({
    label: p.name,
    description: p.path,
    detail: p.tags.length ? `Tags: ${p.tags.join(', ')}` : undefined,
  }));
}

function updateTreeView() {
  try {
    if (!api.views?.updateTreeView) return;

    const groupBy = getSetting('projectManager.groupList', false);

    if (groupBy) {
      const tagMap = {};
      const untagged = [];

      for (const p of projects) {
        if (p.tags.length === 0) {
          untagged.push(p);
        } else {
          for (const tag of p.tags) {
            if (!tagMap[tag]) tagMap[tag] = [];
            tagMap[tag].push(p);
          }
        }
      }

      const tree = [
        ...Object.entries(tagMap).sort().map(([tag, items]) => ({
          label: `${tag} (${items.length})`,
          children: items.map(p => ({
            label: p.name,
            description: p.path,
          })),
        })),
        ...(untagged.length > 0 ? [{
          label: `Untagged (${untagged.length})`,
          children: untagged.map(p => ({
            label: p.name,
            description: p.path,
          })),
        }] : []),
      ];

      api.views.updateTreeView('projectManager.panel', tree);
    } else {
      const tree = projects.map(p => ({
        label: p.name,
        description: p.path,
        detail: p.tags.length ? p.tags.join(', ') : undefined,
      }));

      api.views.updateTreeView('projectManager.panel', tree);
    }
  } catch {
    // tree view API may not be available
  }
}

function updateStatusBar(projectName) {
  try {
    api.window.createStatusBarItem?.({
      id: 'projectManager.statusBar',
      text: `$(folder) ${projectName}`,
      tooltip: `Project Manager — ${projectName}`,
      command: 'projectManager.listProjects',
      alignment: 'left',
      priority: 100,
    });
  } catch {
    // ignore
  }
}

function openProject(projectPath, newWindow) {
  try {
    if (newWindow && api.workspace?.openFolder) {
      api.workspace.openFolder(projectPath, { newWindow: true });
    } else if (api.workspace?.openFolder) {
      api.workspace.openFolder(projectPath);
    } else {
      api.notifications?.info?.(`Abrir: ${projectPath}`);
    }
  } catch {
    api.notifications?.error?.(`Erro ao abrir projeto: ${projectPath}`);
  }
}

function getCurrentProjectPath() {
  try {
    return api.workspace?.rootPath || api.workspace?.getRootPath?.() || null;
  } catch {
    return null;
  }
}

function getFolderName() {
  const path = getCurrentProjectPath();
  if (!path) return null;
  return path.split(/[/\\]/).filter(Boolean).pop() || null;
}

function getSetting(key, defaultValue) {
  try {
    const val = api.settings?.get?.(key);
    return val !== undefined && val !== null ? val : defaultValue;
  } catch {
    return defaultValue;
  }
}
