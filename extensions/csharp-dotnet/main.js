// C# & .NET Extension — main.js
// Provides runtime commands for C# and .NET development

const DOTNET_TEMPLATES = [
  { label: 'Console App', value: 'console' },
  { label: 'Web API (ASP.NET)', value: 'webapi' },
  { label: 'Web App (Razor Pages)', value: 'webapp' },
  { label: 'MVC', value: 'mvc' },
  { label: 'Blazor Server', value: 'blazorserver' },
  { label: 'Blazor WebAssembly', value: 'blazorwasm' },
  { label: 'Class Library', value: 'classlib' },
  { label: 'Worker Service', value: 'worker' },
  { label: 'gRPC Service', value: 'grpc' },
  { label: 'xUnit Test Project', value: 'xunit' },
  { label: 'NUnit Test Project', value: 'nunit' },
  { label: 'MSTest Project', value: 'mstest' },
  { label: 'MAUI App', value: 'maui' },
  { label: 'WPF App', value: 'wpf' },
  { label: 'WinForms App', value: 'winforms' },
  { label: 'Minimal API', value: 'web' },
];

export function activate(context) {
  console.log('[csharp-dotnet] Extension activated');

  const api = context._api || globalThis.hyscode;
  if (!api) {
    console.warn('[csharp-dotnet] HysCode API not available');
    return;
  }

  if (!api.commands) return;

  // ── Helper: run dotnet CLI command ──────────────────────────────────────────
  async function runDotnet(args) {
    if (api.terminal && api.terminal.sendToActive) {
      await api.terminal.sendToActive(`dotnet ${args}`);
    }
  }

  // ── New .NET Project ────────────────────────────────────────────────────────
  api.commands.register('dotnet.newProject', async () => {
    const template = await api.window?.showQuickPick?.(
      DOTNET_TEMPLATES,
      { placeHolder: 'Select project template' }
    );
    if (!template) return;

    const name = await api.window?.showInputBox?.({
      prompt: 'Project name',
      placeHolder: 'MyProject',
    });
    if (!name) return;

    await runDotnet(`new ${template.value} -n ${name}`);
    console.log(`[csharp-dotnet] Created project: ${name} (${template.value})`);
  });

  // ── New Solution ────────────────────────────────────────────────────────────
  api.commands.register('dotnet.newSolution', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Solution name',
      placeHolder: 'MySolution',
    });
    if (!name) return;
    await runDotnet(`new sln -n ${name}`);
  });

  // ── Build ───────────────────────────────────────────────────────────────────
  api.commands.register('dotnet.build', async () => {
    console.log('[csharp-dotnet] Build');
    await runDotnet('build');
  });

  // ── Run ─────────────────────────────────────────────────────────────────────
  api.commands.register('dotnet.run', async () => {
    console.log('[csharp-dotnet] Run');
    await runDotnet('run');
  });

  // ── Test ────────────────────────────────────────────────────────────────────
  api.commands.register('dotnet.test', async () => {
    console.log('[csharp-dotnet] Test');
    await runDotnet('test');
  });

  // ── Watch (Hot Reload) ──────────────────────────────────────────────────────
  api.commands.register('dotnet.watch', async () => {
    console.log('[csharp-dotnet] Watch');
    await runDotnet('watch run');
  });

  // ── Clean ───────────────────────────────────────────────────────────────────
  api.commands.register('dotnet.clean', async () => {
    console.log('[csharp-dotnet] Clean');
    await runDotnet('clean');
  });

  // ── Restore ─────────────────────────────────────────────────────────────────
  api.commands.register('dotnet.restore', async () => {
    console.log('[csharp-dotnet] Restore');
    await runDotnet('restore');
  });

  // ── Publish ─────────────────────────────────────────────────────────────────
  api.commands.register('dotnet.publish', async () => {
    const config = await api.window?.showQuickPick?.([
      { label: 'Release', value: 'Release' },
      { label: 'Debug', value: 'Debug' },
    ], { placeHolder: 'Select configuration' });
    if (!config) return;

    const selfContained = await api.window?.showQuickPick?.([
      { label: 'Framework-dependent', value: 'false' },
      { label: 'Self-contained', value: 'true' },
    ], { placeHolder: 'Deployment mode' });
    if (!selfContained) return;

    await runDotnet(`publish -c ${config.value} --self-contained ${selfContained.value}`);
  });

  // ── NuGet: Add Package ──────────────────────────────────────────────────────
  api.commands.register('nuget.add', async () => {
    const pkg = await api.window?.showInputBox?.({
      prompt: 'Package name',
      placeHolder: 'Newtonsoft.Json',
    });
    if (!pkg) return;

    const version = await api.window?.showInputBox?.({
      prompt: 'Version (leave empty for latest)',
      placeHolder: '',
    });

    const cmd = version
      ? `add package ${pkg} --version ${version}`
      : `add package ${pkg}`;
    await runDotnet(cmd);
  });

  // ── NuGet: Remove Package ───────────────────────────────────────────────────
  api.commands.register('nuget.remove', async () => {
    const pkg = await api.window?.showInputBox?.({
      prompt: 'Package name to remove',
      placeHolder: 'Newtonsoft.Json',
    });
    if (!pkg) return;
    await runDotnet(`remove package ${pkg}`);
  });

  // ── NuGet: List Packages ────────────────────────────────────────────────────
  api.commands.register('nuget.list', async () => {
    await runDotnet('list package');
  });

  // ── NuGet: Update Package ───────────────────────────────────────────────────
  api.commands.register('nuget.update', async () => {
    const pkg = await api.window?.showInputBox?.({
      prompt: 'Package name to update (leave empty for all)',
      placeHolder: '',
    });
    if (pkg) {
      await runDotnet(`add package ${pkg}`);
    } else {
      await runDotnet('restore');
    }
  });

  // ── NuGet: Search Packages ──────────────────────────────────────────────────
  api.commands.register('nuget.search', async () => {
    const query = await api.window?.showInputBox?.({
      prompt: 'Search NuGet packages',
      placeHolder: 'EntityFramework',
    });
    if (!query) return;
    await runDotnet(`package search ${query}`);
  });

  // ── Add Project Reference ───────────────────────────────────────────────────
  api.commands.register('dotnet.addReference', async () => {
    const ref = await api.window?.showInputBox?.({
      prompt: 'Path to project reference (.csproj)',
      placeHolder: '../OtherProject/OtherProject.csproj',
    });
    if (!ref) return;
    await runDotnet(`add reference ${ref}`);
  });

  // ── Add Project to Solution ─────────────────────────────────────────────────
  api.commands.register('dotnet.addToSolution', async () => {
    const project = await api.window?.showInputBox?.({
      prompt: 'Path to project (.csproj)',
      placeHolder: 'src/MyProject/MyProject.csproj',
    });
    if (!project) return;
    await runDotnet(`sln add ${project}`);
  });

  // ── New C# Class ────────────────────────────────────────────────────────────
  api.commands.register('dotnet.newClass', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Class name',
      placeHolder: 'MyClass',
    });
    if (!name) return;

    const ns = await api.window?.showInputBox?.({
      prompt: 'Namespace',
      placeHolder: 'MyApp',
    });

    const content = `namespace ${ns || 'MyApp'};

public class ${name}
{
    public ${name}()
    {
    }
}
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}.cs`, content);
    }
  });

  // ── New C# Interface ───────────────────────────────────────────────────────
  api.commands.register('dotnet.newInterface', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Interface name (without I prefix)',
      placeHolder: 'MyService',
    });
    if (!name) return;

    const ns = await api.window?.showInputBox?.({
      prompt: 'Namespace',
      placeHolder: 'MyApp',
    });

    const content = `namespace ${ns || 'MyApp'};

public interface I${name}
{
}
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`I${name}.cs`, content);
    }
  });

  // ── New C# Record ──────────────────────────────────────────────────────────
  api.commands.register('dotnet.newRecord', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Record name',
      placeHolder: 'MyRecord',
    });
    if (!name) return;

    const ns = await api.window?.showInputBox?.({
      prompt: 'Namespace',
      placeHolder: 'MyApp',
    });

    const content = `namespace ${ns || 'MyApp'};

public record ${name}(string Id);
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}.cs`, content);
    }
  });

  // ── New C# Enum ─────────────────────────────────────────────────────────────
  api.commands.register('dotnet.newEnum', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Enum name',
      placeHolder: 'Status',
    });
    if (!name) return;

    const ns = await api.window?.showInputBox?.({
      prompt: 'Namespace',
      placeHolder: 'MyApp',
    });

    const content = `namespace ${ns || 'MyApp'};

public enum ${name}
{
    None,
    Active,
    Inactive
}
`;
    if (api.workspace && api.workspace.createFile) {
      await api.workspace.createFile(`${name}.cs`, content);
    }
  });

  // ── Entity Framework: Add Migration ─────────────────────────────────────────
  api.commands.register('dotnet.efMigrationAdd', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Migration name',
      placeHolder: 'InitialCreate',
    });
    if (!name) return;
    await runDotnet(`ef migrations add ${name}`);
  });

  // ── Entity Framework: Update Database ───────────────────────────────────────
  api.commands.register('dotnet.efDatabaseUpdate', async () => {
    await runDotnet('ef database update');
  });

  // ── Entity Framework: List Migrations ───────────────────────────────────────
  api.commands.register('dotnet.efMigrationsList', async () => {
    await runDotnet('ef migrations list');
  });

  console.log('[csharp-dotnet] Commands registered');

  // Settings tab
  if (api && api.settings?.updateTabContent) {
    api.settings.updateTabContent('csharp-dotnet.settings', {
      sections: [
        {
          title: '.NET SDK',
          items: [
            { type: 'text', key: 'sdkPath', label: 'SDK Path', description: 'Path to .NET SDK (empty = use $PATH)', placeholder: '/usr/share/dotnet', defaultValue: '' },
            { type: 'text', key: 'defaultFramework', label: 'Default Framework', description: 'Target framework for new projects', placeholder: 'net9.0', defaultValue: 'net9.0' },
            { type: 'toggle', key: 'formatOnSave', label: 'Format on Save', description: 'Auto-format C# code on save', defaultValue: false },
          ],
        },
        {
          title: 'NuGet',
          items: [
            { type: 'text', key: 'nuget.defaultSource', label: 'Default Source', description: 'NuGet package source URL', placeholder: 'https://api.nuget.org/v3/index.json', defaultValue: 'https://api.nuget.org/v3/index.json' },
          ],
        },
      ],
    });
  }
}

export function deactivate() {
  console.log('[csharp-dotnet] Extension deactivated');
}
