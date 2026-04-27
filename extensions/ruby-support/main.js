// Ruby & Rails Support Extension — main.js
// Provides runtime commands for Ruby, Rails, Bundler, RSpec and RuboCop

'use strict';

/** @type {import('../extension-api/src').HysCodeAPI | null} */
let api = null;

/** @type {Array<() => void>} */
let disposables = [];

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executa um comando no terminal ativo.
 * @param {string} cmd
 */
function run(cmd) {
  api.terminal.sendToActive(cmd);
}

/**
 * Registra um comando e adiciona à lista de disposables.
 * @param {string} id
 * @param {() => void | Promise<void>} handler
 */
function register(id, handler) {
  const d = api.commands.register(id, handler);
  disposables.push(d);
}

/**
 * Verifica se há um Gemfile no workspace.
 */
function hasGemfile() {
  // Fallback: assume que se estamos em um projeto Ruby há Gemfile
  return true;
}

/**
 * Retorna o prefixo bundle exec se necessário.
 */
function bundlePrefix() {
  return hasGemfile() ? 'bundle exec ' : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Activate
// ─────────────────────────────────────────────────────────────────────────────

export function activate(context) {
  api = context._api || globalThis.hyscode;
  if (!api) {
    console.warn('[ruby-support] HysCode API not available');
    return;
  }

  console.log('[ruby-support] Extension activated');

  // ═══════════════════════════════════════════════════════════════════════════
  // Ruby Core Commands
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Run ────────────────────────────────────────────────────────────────────
  register('ruby.run', () => {
    run('ruby ' + (api.editor?.getActiveFile?.() || '.'));
  });

  // ── Test (Minitest / RSpec auto-detect) ──────────────────────────────────
  register('ruby.test', () => {
    const file = api.editor?.getActiveFile?.();
    if (file && file.includes('_spec.rb')) {
      run(bundlePrefix() + 'rspec');
    } else if (file && file.includes('_test.rb')) {
      run('ruby -Itest ' + file);
    } else {
      run(bundlePrefix() + 'rspec');
    }
  });

  register('ruby.testFile', () => {
    const file = api.editor?.getActiveFile?.();
    if (!file) {
      api.window?.showErrorMessage?.('No active Ruby file');
      return;
    }
    if (file.includes('_spec.rb')) {
      run(bundlePrefix() + 'rspec ' + file);
    } else if (file.includes('_test.rb')) {
      run('ruby -Itest ' + file);
    } else {
      run('ruby ' + file);
    }
  });

  // ── Bundler ────────────────────────────────────────────────────────────────
  register('ruby.bundleInstall', () => {
    run('bundle install');
  });

  register('ruby.bundleUpdate', () => {
    run('bundle update');
  });

  register('ruby.bundleAdd', async () => {
    const gem = await api.window?.showInputBox?.({
      prompt: 'Gem name to add',
      placeholder: 'nokogiri',
    });
    if (!gem) return;
    run('bundle add ' + gem);
  });

  // ── RuboCop ────────────────────────────────────────────────────────────────
  register('ruby.rubocop', () => {
    run(bundlePrefix() + 'rubocop');
  });

  register('ruby.rubocopFix', () => {
    run(bundlePrefix() + 'rubocop -A');
  });

  register('ruby.fmt', () => {
    const file = api.editor?.getActiveFile?.();
    if (file) {
      run(bundlePrefix() + 'rubocop -A ' + file);
    } else {
      run(bundlePrefix() + 'rubocop -A');
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Rails Commands
  // ═══════════════════════════════════════════════════════════════════════════

  register('rails.new', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Rails app name',
      placeholder: 'my_app',
    });
    if (!name) return;

    const type = await api.window?.showQuickPick?.([
      { label: 'Full Rails (default)', value: '' },
      { label: 'API only', value: '--api' },
      { label: 'Minimal', value: '--minimal' },
      { label: 'Skip tests (use RSpec later)', value: '--skip-test' },
    ], { placeHolder: 'Rails app type' });

    const flags = type?.value || '';
    run(`rails new ${name} ${flags}`.trim());
  });

  register('rails.server', () => {
    run(bundlePrefix() + 'rails server');
  });

  register('rails.console', () => {
    run(bundlePrefix() + 'rails console');
  });

  register('rails.generate', async () => {
    const type = await api.window?.showQuickPick?.([
      { label: 'Controller', value: 'controller' },
      { label: 'Model', value: 'model' },
      { label: 'Migration', value: 'migration' },
      { label: 'Scaffold', value: 'scaffold' },
      { label: 'Job', value: 'job' },
      { label: 'Mailer', value: 'mailer' },
      { label: 'Channel', value: 'channel' },
      { label: 'System Test', value: 'system_test' },
    ], { placeHolder: 'Generate what?' });

    if (!type) return;

    const name = await api.window?.showInputBox?.({
      prompt: `${type.label} name`,
      placeholder: type.value === 'migration' ? 'AddColumnToUsers' : 'Post',
    });
    if (!name) return;

    if (type.value === 'model' || type.value === 'scaffold') {
      const fields = await api.window?.showInputBox?.({
        prompt: 'Fields (name:string email:string body:text)',
        placeholder: 'title:string body:text user:references',
      });
      run(`${bundlePrefix()}rails generate ${type.value} ${name} ${fields || ''}`.trim());
    } else {
      run(`${bundlePrefix()}rails generate ${type.value} ${name}`);
    }
  });

  register('rails.migrate', () => {
    run(bundlePrefix() + 'rails db:migrate');
  });

  register('rails.rollback', () => {
    run(bundlePrefix() + 'rails db:rollback');
  });

  register('rails.routes', () => {
    run(bundlePrefix() + 'rails routes');
  });

  register('rails.dbSeed', () => {
    run(bundlePrefix() + 'rails db:seed');
  });

  register('rails.rspec', () => {
    run(bundlePrefix() + 'rspec');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // New File Templates
  // ═══════════════════════════════════════════════════════════════════════════

  register('ruby.newProject', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Project name',
      placeholder: 'my_ruby_project',
    });
    if (!name) return;

    const type = await api.window?.showQuickPick?.([
      { label: 'Plain Ruby', value: 'plain' },
      { label: 'Gem', value: 'gem' },
      { label: 'Roda', value: 'roda' },
      { label: 'Sinatra', value: 'sinatra' },
      { label: 'CLI Tool', value: 'cli' },
    ], { placeHolder: 'Project type' });

    if (!type) return;

    const files = generateRubyProject(name, type.value);
    for (const [path, content] of files) {
      await api.workspace?.createFile?.(path, content);
    }
  });

  register('ruby.newClass', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Class name',
      placeholder: 'MyClass',
    });
    if (!name) return;

    const content = `# frozen_string_literal: true

class ${name}
  def initialize
    # initialize
  end
end
`;
    await api.workspace?.createFile?.(`${name.toLowerCase()}.rb`, content);
  });

  register('ruby.newModule', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Module name',
      placeholder: 'MyModule',
    });
    if (!name) return;

    const content = `# frozen_string_literal: true

module ${name}
  # module body
end
`;
    await api.workspace?.createFile?.(`${name.toLowerCase()}.rb`, content);
  });

  register('ruby.newGem', async () => {
    const name = await api.window?.showInputBox?.({
      prompt: 'Gem name',
      placeholder: 'my_gem',
    });
    if (!name) return;

    const files = generateGemStructure(name);
    for (const [path, content] of files) {
      await api.workspace?.createFile?.(path, content);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Editor Commands
  // ═══════════════════════════════════════════════════════════════════════════

  register('rails.wrapBeginRescue', async () => {
    if (!api.editor) return;
    const selection = api.editor.getSelection?.();
    if (!selection) return;
    const text = selection.text || '';
    const indented = text.split('\n').map(l => '    ' + l).join('\n');
    api.editor.replaceSelection?.(
      `begin\n${indented}\n  rescue StandardError => e\n    # handle error: #{e.message}\nend`
    );
  });

  register('rails.generateGetterSetter', async () => {
    if (!api.editor) return;
    const selection = api.editor.getSelection?.();
    const fields = (selection?.text || '')
      .split(/,\s*/)
      .map(f => f.trim())
      .filter(Boolean);

    if (fields.length === 0) {
      api.window?.showErrorMessage?.('Select comma-separated field names');
      return;
    }

    const accessors = fields.map(f => `  attr_accessor :${f}`).join('\n');
    const assignments = fields.map(f => `    @${f} = ${f}`).join('\n');
    const params = fields.join(', ');

    const code = `${accessors}

  def initialize(${params})
${assignments}
  end`;

    api.editor.insertAtCursor?.(code);
  });

  console.log('[ruby-support] Commands registered');

  // ═══════════════════════════════════════════════════════════════════════════
  // Settings Tab
  // ═══════════════════════════════════════════════════════════════════════════

  if (api.settings?.updateTabContent) {
    api.settings.updateTabContent('ruby-support.settings', {
      sections: [
        {
          title: 'Executables',
          items: [
            { type: 'text', key: 'rubyPath', label: 'Ruby Path', description: 'Path to ruby executable', placeholder: 'ruby', defaultValue: 'ruby' },
            { type: 'text', key: 'bundlePath', label: 'Bundle Path', description: 'Path to bundle executable', placeholder: 'bundle', defaultValue: 'bundle' },
            { type: 'text', key: 'railsPath', label: 'Rails Path', description: 'Path to rails executable', placeholder: 'rails', defaultValue: 'rails' },
            { type: 'text', key: 'rspecPath', label: 'RSpec Path', description: 'Path to rspec executable', placeholder: 'rspec', defaultValue: 'rspec' },
            { type: 'text', key: 'rubocopPath', label: 'RuboCop Path', description: 'Path to rubocop executable', placeholder: 'rubocop', defaultValue: 'rubocop' },
            { type: 'text', key: 'rakePath', label: 'Rake Path', description: 'Path to rake executable', placeholder: 'rake', defaultValue: 'rake' },
          ],
        },
        {
          title: 'Behavior',
          items: [
            { type: 'toggle', key: 'formatOnSave', label: 'Format on Save', description: 'Run RuboCop automatically on save', defaultValue: true },
            { type: 'toggle', key: 'lintOnSave', label: 'Lint on Save', description: 'Run RuboCop lint on save', defaultValue: true },
            { type: 'toggle', key: 'useBundler', label: 'Use Bundler', description: "Prefix commands with 'bundle exec' when Gemfile exists", defaultValue: true },
          ],
        },
        {
          title: 'Features',
          items: [
            { type: 'toggle', key: 'rspecEnabled', label: 'RSpec Support', description: 'Enable RSpec snippets and commands', defaultValue: true },
            { type: 'toggle', key: 'railsEnabled', label: 'Rails Support', description: 'Enable Rails snippets and commands', defaultValue: true },
          ],
        },
      ],
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deactivate
// ─────────────────────────────────────────────────────────────────────────────

export function deactivate() {
  console.log('[ruby-support] Extension deactivated');
  disposables.forEach(d => d?.());
  disposables = [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Generators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera arquivos para um projeto Ruby simples.
 * @param {string} name
 * @param {string} type
 * @returns {Array<[string, string]>}
 */
function generateRubyProject(name, type) {
  const files = [];

  switch (type) {
    case 'plain':
      files.push(
        [`${name}/lib/${name}.rb`, `# frozen_string_literal: true\n\nmodule ${toPascal(name)}\n  VERSION = '0.1.0'\n\n  # Your code here\nend\n`],
        [`${name}/Gemfile`, `source 'https://rubygems.org'\n\ngem 'rspec'\n`],
        [`${name}/README.md`, `# ${toPascal(name)}\n\nDescription here.\n\n## Usage\n\n\`\`\`ruby\nrequire '${name}'\n\`\`\`\n`]
      );
      break;

    case 'gem':
      files.push(
        [`${name}/lib/${name}.rb`, `require_relative '${name}/version'\n\nmodule ${toPascal(name)}\n  # Your code here\nend\n`],
        [`${name}/lib/${name}/version.rb`, `module ${toPascal(name)}\n  VERSION = '0.1.0'\nend\n`],
        [`${name}/${name}.gemspec`, `require_relative 'lib/${name}/version'\n\nGem::Specification.new do |spec|\n  spec.name = '${name}'\n  spec.version = ${toPascal(name)}::VERSION\n  spec.authors = ['Your Name']\n  spec.email = ['your@email.com']\n  spec.summary = 'Summary'\n  spec.description = 'Description'\n  spec.homepage = 'https://github.com/yourname/${name}'\n  spec.license = 'MIT'\n  spec.files = Dir['lib/**/*.rb']\n  spec.require_paths = ['lib']\nend\n`],
        [`${name}/Gemfile`, `source 'https://rubygems.org'\n\ngemspec\n`]
      );
      break;

    case 'roda':
      files.push(
        [`${name}/app.rb`, `require 'roda'\n\nclass App < Roda\n  route do |r|\n    r.root do\n      'Hello, Roda!'\n    end\n\n    r.on 'api' do\n      r.get 'health' do\n        { status: 'ok' }.to_json\n      end\n    end\n  end\nend\n`],
        [`${name}/Gemfile`, `source 'https://rubygems.org'\n\ngem 'roda'\ngem 'puma'\n`],
        [`${name}/config.ru`, `require './app'\n\nrun App.freeze.app\n`]
      );
      break;

    case 'sinatra':
      files.push(
        [`${name}/app.rb`, `require 'sinatra'\n\nget '/' do\n  'Hello, Sinatra!'\nend\n\nget '/api/:name' do\n  { message: \"Hello, #{params[:name]}!\" }.to_json\nend\n`],
        [`${name}/Gemfile`, `source 'https://rubygems.org'\n\ngem 'sinatra'\ngem 'puma'\ngem 'json'\n`],
        [`${name}/config.ru`, `require './app'\n\nrun Sinatra::Application\n`]
      );
      break;

    case 'cli':
      files.push(
        [`${name}/bin/${name}`, `#!/usr/bin/env ruby\n# frozen_string_literal: true\n\nrequire_relative '../lib/${name}'\n\nputs ${toPascal(name)}.run(ARGV)\n`],
        [`${name}/lib/${name}.rb`, `module ${toPascal(name)}\n  def self.run(args)\n    'Hello from CLI!'\n  end\nend\n`],
        [`${name}/Gemfile`, `source 'https://rubygems.org'\n\ngem 'thor'\n`],
        [`${name}/README.md`, `# ${toPascal(name)} CLI\n\nUsage:\n\n\`\`\`bash\nbin/${name} --help\n\`\`\`\n`]
      );
      break;
  }

  return files;
}

/**
 * Gera estrutura de gem completa.
 * @param {string} name
 * @returns {Array<[string, string]>}
 */
function generateGemStructure(name) {
  const pascal = toPascal(name);
  return [
    [`${name}/lib/${name}.rb`, `require_relative '${name}/version'\n\nmodule ${pascal}\n  class Error < StandardError; end\n\n  # Your code here\nend\n`],
    [`${name}/lib/${name}/version.rb`, `module ${pascal}\n  VERSION = '0.1.0'\nend\n`],
    [`${name}/${name}.gemspec`, `require_relative 'lib/${name}/version'\n\nGem::Specification.new do |spec|\n  spec.name = '${name}'\n  spec.version = ${pascal}::VERSION\n  spec.authors = ['Your Name']\n  spec.email = ['your@email.com']\n  spec.summary = 'Short summary'\n  spec.description = 'Longer description'\n  spec.homepage = 'https://github.com/yourname/${name}'\n  spec.license = 'MIT'\n  spec.required_ruby_version = '>= 3.0.0'\n  spec.files = Dir['lib/**/*.rb']\n  spec.bindir = 'exe'\n  spec.executables = spec.files.grep(%r{^exe/}) { |f| File.basename(f) }\n  spec.require_paths = ['lib']\nend\n`],
    [`${name}/Gemfile`, `source 'https://rubygems.org'\n\ngemspec\n\ngem 'rake'\ngem 'rspec'\n`],
    [`${name}/Rakefile`, `require 'bundler/gem_tasks'\n\ntask default: :spec\n`],
    [`${name}/README.md`, `# ${pascal}\n\nWelcome to your new gem!\n\n## Installation\n\nAdd this line to your application's Gemfile:\n\n\`\`\`ruby\ngem '${name}'\n\`\`\`\n\nAnd then execute:\n\n    bundle install\n\nOr install it yourself as:\n\n    gem install ${name}\n\n## Usage\n\n\`\`\`ruby\nrequire '${name}'\n\`\`\`\n\n## Development\n\nAfter checking out the repo, run \`bundle install\` to install dependencies.\n`],
    [`${name}/.gitignore`, `/.bundle/\n/pkg/\n/spec/reports/\n/tmp/\n`],
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte snake_case para PascalCase.
 * @param {string} str
 * @returns {string}
 */
function toPascal(str) {
  return str
    .split(/[_-]/)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}
