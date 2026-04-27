// Lua Support Extension — main.js
// Provides runtime commands for Lua development

const LOVE_TEMPLATES = {
  main: `function love.load()
  -- Load resources here
end

function love.update(dt)
  -- Update game state
end

function love.draw()
  -- Draw the game
  love.graphics.print("Hello, LÖVE!", 400, 300)
end

function love.keypressed(key)
  if key == "escape" then
    love.event.quit()
  end
end
`,
  conf: `function love.conf(t)
  t.identity = nil
  t.appendidentity = false
  t.version = "11.4"
  t.console = false
  t.accelerometerjoystick = true
  t.externalstorage = false
  t.gammacorrect = false

  t.audio.mic = false
  t.audio.mixwithsystem = true

  t.window.title = "Untitled"
  t.window.icon = nil
  t.window.width = 800
  t.window.height = 600
  t.window.borderless = false
  t.window.resizable = false
  t.window.minwidth = 1
  t.window.minheight = 1
  t.window.fullscreen = false
  t.window.fullscreentype = "desktop"
  t.window.vsync = 1
  t.window.msaa = 0
  t.window.depth = nil
  t.window.stencil = nil
  t.window.display = 1
  t.window.highdpi = false
  t.window.usedpiscale = true
  t.window.x = nil
  t.window.y = nil

  t.modules.audio = true
  t.modules.data = true
  t.modules.event = true
  t.modules.font = true
  t.modules.graphics = true
  t.modules.image = true
  t.modules.joystick = true
  t.modules.keyboard = true
  t.modules.math = true
  t.modules.mouse = true
  t.modules.physics = true
  t.modules.sound = true
  t.modules.system = true
  t.modules.thread = true
  t.modules.timer = true
  t.modules.touch = true
  t.modules.video = true
  t.modules.window = true
end
`,
};

export function activate(context) {
  console.log('[lua-support] Extension activated');

  const api = context._api || globalThis.hyscode;
  if (!api) {
    console.warn('[lua-support] HysCode API not available');
    return;
  }

  if (api.commands) {
    // ── Run Lua Script ────────────────────────────────────────────────────────
    api.commands.register('lua.run', async () => {
      const editor = api.editor;
      if (!editor) return;
      const filePath = editor.getCurrentFile?.();
      if (!filePath || !filePath.endsWith('.lua')) {
        api.window?.showMessage?.('Please open a .lua file first', 'warning');
        return;
      }
      try {
        const result = await api.terminal?.execute?.(`lua "${filePath}"`);
        if (result) {
          api.window?.showMessage?.('Lua script executed', 'info');
        }
      } catch {
        api.window?.showMessage?.('Failed to run Lua script', 'error');
      }
    });

    // ── Run with LuaJIT ───────────────────────────────────────────────────────
    api.commands.register('lua.runJit', async () => {
      const editor = api.editor;
      if (!editor) return;
      const filePath = editor.getCurrentFile?.();
      if (!filePath || !filePath.endsWith('.lua')) {
        api.window?.showMessage?.('Please open a .lua file first', 'warning');
        return;
      }
      try {
        const result = await api.terminal?.execute?.(`luajit "${filePath}"`);
        if (result) {
          api.window?.showMessage?.('LuaJIT script executed', 'info');
        }
      } catch {
        api.window?.showMessage?.('Failed to run with LuaJIT', 'error');
      }
    });

    // ── Check Lua Syntax ──────────────────────────────────────────────────────
    api.commands.register('lua.check', async () => {
      const editor = api.editor;
      if (!editor) return;
      const filePath = editor.getCurrentFile?.();
      if (!filePath || !filePath.endsWith('.lua')) {
        api.window?.showMessage?.('Please open a .lua file first', 'warning');
        return;
      }
      try {
        const result = await api.terminal?.execute?.(`luac -p "${filePath}"`);
        if (result) {
          api.window?.showMessage?.('Syntax OK', 'info');
        }
      } catch {
        api.window?.showMessage?.('Syntax check failed', 'error');
      }
    });

    // ── New Lua File ──────────────────────────────────────────────────────────
    api.commands.register('lua.newFile', async () => {
      const name = await api.window?.showInputBox?.({
        prompt: 'File name',
        placeHolder: 'script.lua',
      });
      if (!name) return;
      const fileName = name.endsWith('.lua') ? name : `${name}.lua`;
      const content = `-- ${fileName}
-- Created on ${new Date().toISOString().split('T')[0]}

`;
      if (api.workspace && api.workspace.createFile) {
        await api.workspace.createFile(fileName, content);
      }
    });

    // ── New Lua Module ────────────────────────────────────────────────────────
    api.commands.register('lua.newModule', async () => {
      const name = await api.window?.showInputBox?.({
        prompt: 'Module name',
        placeHolder: 'my_module',
      });
      if (!name) return;
      const fileName = `${name}.lua`;
      const moduleName = name.replace(/\./g, '_');
      const content = `local ${moduleName} = {}

function ${moduleName}.init()
  -- initialize module
end

return ${moduleName}
`;
      if (api.workspace && api.workspace.createFile) {
        await api.workspace.createFile(fileName, content);
      }
    });

    // ── New Lua Class (OOP) ───────────────────────────────────────────────────
    api.commands.register('lua.newClass', async () => {
      const name = await api.window?.showInputBox?.({
        prompt: 'Class name',
        placeHolder: 'MyClass',
      });
      if (!name) return;
      const fileName = `${name:lower()}.lua`;
      const content = `local ${name} = {}
${name}.__index = ${name}

function ${name}.new(...)
  local self = setmetatable({}, ${name})
  self:_init(...)
  return self
end

function ${name}:_init(...)
  -- constructor
end

return ${name}
`;
      if (api.workspace && api.workspace.createFile) {
        await api.workspace.createFile(fileName, content);
      }
    });

    // ── New LÖVE Project ──────────────────────────────────────────────────────
    api.commands.register('lua.newLoveProject', async () => {
      const name = await api.window?.showInputBox?.({
        prompt: 'Project name',
        placeHolder: 'my-love-game',
      });
      if (!name) return;

      if (api.workspace && api.workspace.createFolder) {
        await api.workspace.createFolder(name);
        await api.workspace.createFile(`${name}/main.lua`, LOVE_TEMPLATES.main);
        await api.workspace.createFile(`${name}/conf.lua`, LOVE_TEMPLATES.conf);
        api.window?.showMessage?.(`LÖVE project "${name}" created!`, 'info');
      }
    });

    // ── Init LuaRocks Project ─────────────────────────────────────────────────
    api.commands.register('lua.initLuarocks', async () => {
      const name = await api.window?.showInputBox?.({
        prompt: 'Package name',
        placeHolder: 'my-package',
      });
      if (!name) return;

      const version = await api.window?.showInputBox?.({
        prompt: 'Version',
        placeHolder: '1.0.0',
      }) || '1.0.0';

      const rockspecContent = `package = "${name}"
version = "${version}-1"
source = {
   url = "...",
}
description = {
   summary = "A Lua package",
   detailed = "",
   homepage = "",
   license = "MIT"
}
dependencies = {
   "lua >= 5.1"
}
build = {
   type = "builtin",
   modules = {
      ["${name}"] = "src/${name}.lua"
   }
}
`;
      if (api.workspace && api.workspace.createFile) {
        await api.workspace.createFile(`${name}-${version}-1.rockspec`, rockspecContent);
        await api.workspace.createFolder('src');
        api.window?.showMessage?.('LuaRocks project initialized', 'info');
      }
    });

    // ── Add LuaRocks Dependency ───────────────────────────────────────────────
    api.commands.register('lua.addDependency', async () => {
      const dep = await api.window?.showInputBox?.({
        prompt: 'Package name',
        placeHolder: 'luasocket',
      });
      if (!dep) return;
      try {
        await api.terminal?.execute?.(`luarocks install ${dep}`);
        api.window?.showMessage?.(`Installed ${dep}`, 'info');
      } catch {
        api.window?.showMessage?.(`Failed to install ${dep}`, 'error');
      }
    });

    // ── Format with StyLua ────────────────────────────────────────────────────
    api.commands.register('lua.fmt', async () => {
      const editor = api.editor;
      if (!editor) return;
      const filePath = editor.getCurrentFile?.();
      if (!filePath || !filePath.endsWith('.lua')) {
        api.window?.showMessage?.('Please open a .lua file first', 'warning');
        return;
      }
      try {
        await api.terminal?.execute?.(`stylua "${filePath}"`);
        api.window?.showMessage?.('Formatted with StyLua', 'info');
      } catch {
        api.window?.showMessage?.('StyLua not found or formatting failed', 'error');
      }
    });

    // ── Lint with luacheck ────────────────────────────────────────────────────
    api.commands.register('lua.lint', async () => {
      const editor = api.editor;
      if (!editor) return;
      const filePath = editor.getCurrentFile?.();
      if (!filePath || !filePath.endsWith('.lua')) {
        api.window?.showMessage?.('Please open a .lua file first', 'warning');
        return;
      }
      try {
        await api.terminal?.execute?.(`luacheck "${filePath}"`);
      } catch {
        api.window?.showMessage?.('luacheck not found or linting failed', 'error');
      }
    });

    // ── Run Tests (busted) ────────────────────────────────────────────────────
    api.commands.register('lua.test', async () => {
      try {
        await api.terminal?.execute?.('busted');
      } catch {
        api.window?.showMessage?.('busted not found or tests failed', 'error');
      }
    });
  }

  console.log('[lua-support] Commands registered');

  // Settings tab
  if (api && api.settings?.updateTabContent) {
    api.settings.updateTabContent('lua-support.settings', {
      sections: [
        {
          title: 'Interpreter',
          items: [
            { type: 'text', key: 'lua.executablePath', label: 'Lua Executable', description: 'Path to lua binary', defaultValue: 'lua' },
            { type: 'text', key: 'lua.luajitPath', label: 'LuaJIT Executable', description: 'Path to luajit binary', defaultValue: 'luajit' },
          ],
        },
        {
          title: 'Tools',
          items: [
            { type: 'text', key: 'lua.luarocksPath', label: 'LuaRocks', description: 'Path to luarocks', defaultValue: 'luarocks' },
            { type: 'text', key: 'lua.styluaPath', label: 'StyLua', description: 'Path to stylua formatter', defaultValue: 'stylua' },
            { type: 'text', key: 'lua.luacheckPath', label: 'Luacheck', description: 'Path to luacheck linter', defaultValue: 'luacheck' },
            { type: 'text', key: 'lua.lovePath', label: 'LÖVE', description: 'Path to love executable', defaultValue: 'love' },
          ],
        },
        {
          title: 'Editor',
          items: [
            { type: 'toggle', key: 'lua.formatOnSave', label: 'Format on Save', description: 'Auto-format with StyLua on save', defaultValue: false },
            { type: 'toggle', key: 'lua.lintOnSave', label: 'Lint on Save', description: 'Auto-lint with luacheck on save', defaultValue: false },
            { type: 'toggle', key: 'lua.snippets.enabled', label: 'Enable Snippets', description: 'Enable Lua code snippets', defaultValue: true },
          ],
        },
      ],
    });
  }
}

export function deactivate() {
  console.log('[lua-support] Extension deactivated');
}
