# Guia Completo de Desenvolvimento de Extensões — HysCode

> Este guia cobre **tudo** que você precisa saber para criar, empacotar, instalar e publicar extensões para o HysCode IDE.

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura de uma Extensão](#estrutura-de-uma-extensão)
3. [Manifesto (extension.json)](#manifesto-extensionjson)
4. [Tipos de Extensão](#tipos-de-extensão)
5. [Contribution Points — Referência Completa](#contribution-points--referência-completa)
6. [Código da Extensão (main.js)](#código-da-extensão-mainjs)
7. [API do HysCode](#api-do-hyscode)
8. [Temas — Guia Detalhado](#temas--guia-detalhado)
9. [Linguagens — Guia Detalhado](#linguagens--guia-detalhado)
10. [Snippets — Guia Detalhado](#snippets--guia-detalhado)
11. [Instalação](#instalação)
12. [Empacotamento (.zip)](#empacotamento-zip)
13. [Ciclo de Vida](#ciclo-de-vida)
14. [Boas Práticas](#boas-práticas)
15. [Exemplos Completos](#exemplos-completos)
16. [Solução de Problemas](#solução-de-problemas)

---

## Visão Geral

Uma extensão HysCode é uma **pasta** (ou arquivo `.zip`) contendo no mínimo um arquivo `extension.json` (manifesto). Extensões podem:

- Adicionar **temas de cores** para o editor e toda a UI
- Registrar **linguagens** com associações de arquivo e configurações
- Fornecer **snippets** (trechos de código) para qualquer linguagem
- Registrar **comandos** acessíveis pela paleta de comandos
- Adicionar **atalhos de teclado** personalizados
- Contribuir **views** na sidebar
- Adicionar **itens na barra de status**
- Registrar **servidores de linguagem (LSP)** para IntelliSense
- Definir **menus de contexto** no editor e explorador
- Fornecer **temas de ícones** para arquivos
- Adicionar **configurações** personalizadas

### Onde ficam as extensões?

Todas as extensões são armazenadas em:
```
~/.hyscode/extensions/{nome-da-extensao}/
```

O estado (habilitado/desabilitado) é salvo em:
```
~/.hyscode/extension-state.json
```

---

## Estrutura de uma Extensão

```
minha-extensao/
├── extension.json          # OBRIGATÓRIO: manifesto da extensão
├── main.js                 # Opcional: ponto de entrada com código
├── themes/                 # Opcional: arquivos JSON de temas
│   └── meu-tema.json
├── snippets/               # Opcional: arquivos JSON de snippets
│   └── javascript.json
├── language-configuration.json  # Opcional: config de linguagem
├── icon.png                # Opcional: ícone da extensão (128x128)
└── README.md               # Opcional: documentação
```

### Regras de Nomes

O campo `name` no manifesto deve conter **apenas**:
- Letras (a-z, A-Z)
- Números (0-9)
- Hífens (`-`)
- Underscores (`_`)

Exemplos válidos: `react-support`, `tokyo_night`, `minha-extensao-v2`
Exemplos inválidos: `minha extensão`, `ext@special`, `../../hack`

---

## Manifesto (extension.json)

O manifesto é o coração da extensão. Todos os campos disponíveis:

```json
{
  "name": "minha-extensao",
  "displayName": "Minha Extensão",
  "version": "1.0.0",
  "description": "Descrição curta da extensão",
  "publisher": "seu-nome",
  "engines": { "hyscode": ">=0.1.0" },

  "icon": "icon.png",
  "categories": ["Themes", "Languages", "Snippets", "Other"],
  "keywords": ["react", "javascript", "tema"],

  "repository": "https://github.com/user/repo",
  "license": "MIT",
  "readme": "README.md",

  "main": "main.js",
  "activationEvents": ["onStartup", "onLanguage:javascript"],

  "contributes": {
    "themes": [],
    "languages": [],
    "languageServers": [],
    "commands": [],
    "keybindings": [],
    "views": [],
    "statusBarItems": [],
    "configuration": {},
    "snippets": [],
    "menus": {},
    "iconThemes": []
  }
}
```

### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | string | Identificador único (sem espaços) |
| `displayName` | string | Nome exibido na UI |
| `version` | string | Versão semântica (ex: `1.0.0`) |
| `publisher` | string | Nome do autor |
| `engines` | object | Compatibilidade: `{ "hyscode": ">=0.1.0" }` |

### Campos Opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `description` | string | Descrição curta |
| `icon` | string | Caminho relativo para ícone PNG |
| `categories` | string[] | Categorias para filtragem |
| `keywords` | string[] | Palavras-chave para busca |
| `main` | string | Arquivo JS de entrada |
| `activationEvents` | string[] | Quando ativar a extensão |
| `contributes` | object | Contribution points |
| `repository` | string | URL do repositório |
| `license` | string | Licença (ex: `MIT`) |
| `readme` | string | Caminho para README |

### Activation Events

| Evento | Descrição |
|--------|-----------|
| `onStartup` | Ativa quando o IDE inicia |
| `onLanguage:{id}` | Ativa ao abrir arquivo da linguagem |
| `onCommand:{id}` | Ativa quando o comando é executado |
| `workspaceContains:{pattern}` | Ativa se o workspace contém o arquivo |

---

## Tipos de Extensão

### 1. Extensão de Tema (sem código)
Contribui apenas cores. Não precisa de `main.js`.
```json
{
  "name": "meu-tema",
  "displayName": "Meu Tema",
  "version": "1.0.0",
  "publisher": "autor",
  "engines": { "hyscode": ">=0.1.0" },
  "categories": ["Themes"],
  "contributes": {
    "themes": [{
      "id": "meu-tema-dark",
      "label": "Meu Tema Dark",
      "uiTheme": "hyscode-dark",
      "path": "themes/dark.json"
    }]
  }
}
```

### 2. Extensão de Linguagem (sem código)
Adiciona suporte a nova linguagem com snippets e configuração.
```json
{
  "name": "minha-linguagem",
  "displayName": "Minha Linguagem",
  "version": "1.0.0",
  "publisher": "autor",
  "engines": { "hyscode": ">=0.1.0" },
  "categories": ["Languages"],
  "contributes": {
    "languages": [{
      "id": "minha-lang",
      "aliases": ["Minha Linguagem"],
      "extensions": [".ml", ".myl"]
    }],
    "snippets": [{
      "language": "minha-lang",
      "path": "snippets/minha-lang.json"
    }]
  }
}
```

### 3. Extensão com Código
Extensão completa com lógica, comandos e interação com a API.
```json
{
  "name": "minha-ferramenta",
  "displayName": "Minha Ferramenta",
  "version": "1.0.0",
  "publisher": "autor",
  "engines": { "hyscode": ">=0.1.0" },
  "main": "main.js",
  "activationEvents": ["onStartup"],
  "categories": ["Other"],
  "contributes": {
    "commands": [{ "id": "minha-ferramenta.executar", "title": "Executar Ferramenta" }]
  }
}
```

### 4. Extensão Completa (tema + linguagem + snippets + código)
Combina todos os tipos — como a extensão de suporte a React.

---

## Contribution Points — Referência Completa

### `themes` — Temas de Cores

```json
{
  "themes": [
    {
      "id": "meu-tema-id",
      "label": "Nome Exibido no Seletor",
      "uiTheme": "hyscode-dark",
      "path": "themes/meu-tema.json"
    }
  ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `id` | string | ✅ | Identificador único do tema |
| `label` | string | ✅ | Nome exibido no seletor de temas |
| `uiTheme` | `"hyscode-dark"` \| `"hyscode-light"` | ✅ | Tema base da UI |
| `path` | string | ✅ | Caminho relativo para o JSON do tema |

### `languages` — Linguagens

```json
{
  "languages": [
    {
      "id": "react-jsx",
      "aliases": ["React JSX", "JSX"],
      "extensions": [".jsx"],
      "configuration": "language-configuration.json",
      "icon": "icons/react.svg"
    }
  ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `id` | string | ✅ | Identificador da linguagem |
| `aliases` | string[] | | Nomes alternativos |
| `extensions` | string[] | | Extensões de arquivo (`.jsx`, `.tsx`) |
| `filenames` | string[] | | Nomes de arquivo exatos |
| `mimetypes` | string[] | | Tipos MIME |
| `configuration` | string | | Caminho para config de linguagem |
| `tokenizer` | string | | Caminho para tokenizador Monarch |
| `icon` | string | | Ícone da linguagem |

### `languageServers` — Servidores de Linguagem (LSP)

```json
{
  "languageServers": [
    {
      "id": "meu-lsp",
      "languageIds": ["javascript", "typescript"],
      "command": "my-lsp-server",
      "args": ["--stdio"],
      "rootPatterns": ["package.json"],
      "initializationOptions": {}
    }
  ]
}
```

### `commands` — Comandos

```json
{
  "commands": [
    {
      "id": "extensao.meuComando",
      "title": "Meu Comando",
      "category": "Minha Extensão",
      "icon": "play",
      "enablement": "editorHasSelection"
    }
  ]
}
```

### `keybindings` — Atalhos de Teclado

```json
{
  "keybindings": [
    {
      "command": "extensao.meuComando",
      "key": "ctrl+shift+r",
      "mac": "cmd+shift+r",
      "when": "editorTextFocus"
    }
  ]
}
```

### `views` — Views na Sidebar

```json
{
  "views": [
    {
      "id": "extensao.minhaView",
      "name": "Minha View",
      "icon": "eye",
      "when": "true"
    }
  ]
}
```

### `statusBarItems` — Itens na Barra de Status

```json
{
  "statusBarItems": [
    {
      "id": "extensao.status",
      "text": "$(check) Ativo",
      "tooltip": "Status da extensão",
      "command": "extensao.meuComando",
      "alignment": "right",
      "priority": 100
    }
  ]
}
```

### `configuration` — Configurações

```json
{
  "configuration": {
    "title": "Minha Extensão",
    "properties": {
      "minhaExtensao.habilitado": {
        "type": "boolean",
        "default": true,
        "description": "Habilita a extensão"
      },
      "minhaExtensao.nivel": {
        "type": "string",
        "default": "normal",
        "enum": ["baixo", "normal", "alto"],
        "enumDescriptions": ["Baixa prioridade", "Padrão", "Alta prioridade"]
      }
    }
  }
}
```

### `snippets` — Trechos de Código

```json
{
  "snippets": [
    { "language": "javascript", "path": "snippets/javascript.json" },
    { "language": "typescript", "path": "snippets/typescript.json" }
  ]
}
```

O arquivo de snippets segue o formato VS Code:
```json
{
  "Nome do Snippet": {
    "prefix": "gatilho",
    "body": [
      "linha 1",
      "linha 2 com ${1:placeholder}",
      "$0"
    ],
    "description": "Descrição do snippet"
  }
}
```

### `menus` — Menus de Contexto

```json
{
  "menus": {
    "editor/context": [
      { "command": "ext.cmd", "group": "navigation", "when": "editorHasSelection" }
    ],
    "editor/title": [
      { "command": "ext.cmd", "group": "navigation" }
    ],
    "explorer/context": [
      { "command": "ext.cmd", "group": "7_modification" }
    ],
    "commandPalette": [
      { "command": "ext.cmd" }
    ]
  }
}
```

### `iconThemes` — Temas de Ícones

```json
{
  "iconThemes": [
    {
      "id": "meus-icones",
      "label": "Meus Ícones",
      "path": "icons/icon-theme.json"
    }
  ]
}
```

---

## Código da Extensão (main.js)

Se a extensão tem `"main": "main.js"`, o arquivo deve exportar `activate()` e opcionalmente `deactivate()`:

```javascript
// main.js — Usa ESM (export/import)

export function activate(context) {
  // context.extensionName   → nome da extensão
  // context.extensionPath   → caminho no disco
  // context.subscriptions   → array de Disposables (limpos no deactivate)
  // context.globalState     → armazenamento persistente (key-value)
  // context.workspaceState  → armazenamento por workspace

  console.log(`${context.extensionName} ativada!`);

  // O objeto HysCode API é recebido como segundo argumento (ou via context)
}

export function deactivate() {
  console.log('Extensão desativada');
}
```

---

## API do HysCode

A API completa disponível para extensões:

### workspace — Operações de Arquivo

```javascript
// Ler arquivo
const conteudo = await hyscode.workspace.readFile('/caminho/arquivo.txt');

// Escrever arquivo
await hyscode.workspace.writeFile('/caminho/arquivo.txt', 'conteúdo');

// Listar diretório
const arquivos = await hyscode.workspace.listDir('/caminho');

// Eventos
const sub = hyscode.workspace.onDidOpenFile((path) => {
  console.log('Arquivo aberto:', path);
});
context.subscriptions.push(sub);
```

### commands — Comandos

```javascript
// Registrar comando
const cmd = hyscode.commands.registerCommand('ext.hello', () => {
  hyscode.window.showInformationMessage('Olá!');
});
context.subscriptions.push(cmd);

// Executar comando
await hyscode.commands.executeCommand('ext.hello');

// Listar comandos
const todos = hyscode.commands.getCommands();
```

### window — UI e Mensagens

```javascript
// Mensagens
await hyscode.window.showInformationMessage('Info');
await hyscode.window.showWarningMessage('Aviso');
await hyscode.window.showErrorMessage('Erro');

// Mensagem com ações
const escolha = await hyscode.window.showInformationMessage(
  'Deseja continuar?', 'Sim', 'Não'
);

// Status bar
const item = hyscode.window.createStatusBarItem({
  id: 'ext.item',
  text: 'Meu Item',
  tooltip: 'Clique aqui',
  command: 'ext.hello',
  alignment: 'right',
  priority: 100,
});
```

### editor — Editor de Código

```javascript
// Abrir arquivo
await hyscode.editor.openFile('/caminho/arquivo.ts');

// Obter seleção
const sel = hyscode.editor.getSelection();

// Inserir texto
await hyscode.editor.insertText('texto inserido');

// Decorações
const deco = hyscode.editor.addDecoration({ /* ... */ });
```

### themes — Temas

```javascript
// Registrar tema programaticamente
const tema = hyscode.themes.registerTheme({
  id: 'meu-tema',
  label: 'Meu Tema',
  type: 'dark',
  colors: { 'editor.background': '#1a1a2e' },
  tokenColors: [
    { scope: 'keyword', settings: { foreground: '#e94560' } }
  ],
});

// Obter tema ativo
const ativo = hyscode.themes.getActiveThemeId();
```

### notifications — Notificações

```javascript
// Notificações simples
hyscode.notifications.info('Operação concluída');
hyscode.notifications.warning('Cuidado');
hyscode.notifications.error('Falha na operação');

// Progresso
const reporter = hyscode.notifications.progress('Processando...');
reporter.report(50); // 50%
reporter.done();
```

### Tabela Resumo de APIs

| API | Métodos Principais |
|-----|-------------------|
| `workspace` | `readFile()`, `writeFile()`, `listDir()`, `onDidOpenFile()`, `onDidSaveFile()` |
| `commands` | `registerCommand()`, `executeCommand()`, `getCommands()` |
| `window` | `showInformationMessage()`, `showWarningMessage()`, `showErrorMessage()`, `createStatusBarItem()` |
| `editor` | `openFile()`, `getSelection()`, `insertText()`, `addDecoration()` |
| `settings` | `get()`, `set()`, `onDidChange()` |
| `git` | `getBranch()`, `getStatus()`, `getDiff()` |
| `themes` | `registerTheme()`, `getActiveThemeId()` |
| `languages` | `registerLanguage()`, `registerLanguageServer()`, `setLanguageDiagnostics()` |
| `notifications` | `info()`, `warning()`, `error()`, `progress()` |
| `extensions` | `getAll()`, `getExtension()` |

---

## Temas — Guia Detalhado

### Estrutura do Arquivo de Tema

O arquivo JSON referenciado em `themes[].path` segue o formato `ThemeDefinition`:

```json
{
  "id": "meu-tema-id",
  "label": "Meu Tema",
  "type": "dark",
  "colors": {
    "editor.background": "#1a1a2e",
    "editor.foreground": "#eaeaea",
    "editorLineNumber.foreground": "#4a4a6a",
    "editorLineNumber.activeForeground": "#a0a0c0",
    "editor.selectionBackground": "#e9456033",
    "editor.lineHighlightBackground": "#ffffff08",
    "editorCursor.foreground": "#e94560",
    "editorIndentGuide.background": "#2a2a4a",
    "editorBracketMatch.background": "#e9456022",
    "editorBracketMatch.border": "#e9456044",
    "editorWidget.background": "#222244",
    "editorWidget.border": "#3a3a5a",
    "input.background": "#1a1a2e",
    "input.foreground": "#eaeaea",
    "input.border": "#3a3a5a",
    "minimap.background": "#141428",
    "scrollbarSlider.background": "#e9456022",
    "scrollbarSlider.hoverBackground": "#e9456044",

    "sideBar.background": "#16162a",
    "activityBar.background": "#12122a",
    "panel.background": "#1a1a2e",
    "panel.border": "#2a2a4a",
    "focusBorder": "#e94560",
    "button.background": "#e94560",
    "tab.inactiveForeground": "#6a6a8a",
    "errorForeground": "#ff6b6b",

    "terminal.ansiGreen": "#50fa7b",
    "terminal.ansiYellow": "#f1fa8c",
    "terminal.ansiRed": "#ff5555",
    "terminal.ansiBlue": "#6272a4"
  },
  "tokenColors": [
    { "scope": "comment", "settings": { "foreground": "#6a6a8a", "fontStyle": "italic" } },
    { "scope": "keyword", "settings": { "foreground": "#e94560" } },
    { "scope": "string", "settings": { "foreground": "#50fa7b" } },
    { "scope": "constant.numeric", "settings": { "foreground": "#f1fa8c" } },
    { "scope": "entity.name.type", "settings": { "foreground": "#8be9fd" } },
    { "scope": "entity.name.function", "settings": { "foreground": "#bd93f9" } },
    { "scope": "variable", "settings": { "foreground": "#eaeaea" } },
    { "scope": "entity.name.tag", "settings": { "foreground": "#ff79c6" } },
    { "scope": "entity.other.attribute-name", "settings": { "foreground": "#50fa7b" } }
  ]
}
```

### Cores Importantes

As cores são divididas em duas categorias:

**Cores do Editor (Monaco):**
- `editor.background` — Fundo do editor
- `editor.foreground` — Texto principal
- `editorCursor.foreground` — Cor do cursor
- `editor.selectionBackground` — Seleção de texto
- `editor.lineHighlightBackground` — Destaque da linha atual
- `editorLineNumber.foreground` — Números de linha
- `editorIndentGuide.background` — Guias de indentação
- `editorBracketMatch.*` — Destaque de parênteses

**Cores da UI (CSS Variables):**
- `sideBar.background` — Sidebar
- `activityBar.background` — Activity bar
- `panel.background` — Painéis
- `panel.border` — Bordas
- `focusBorder` — Borda de foco / Cor de destaque
- `button.background` — Botões
- `tab.inactiveForeground` — Tabs inativos
- `errorForeground` — Erros

### Token Colors (Syntax Highlighting)

Escopos TextMate suportados:

| Escopo | Elementos |
|--------|-----------|
| `comment` | Comentários |
| `keyword`, `keyword.control` | Palavras-chave (`if`, `return`, `const`) |
| `storage`, `storage.type` | `class`, `function`, `let` |
| `string`, `string.quoted` | Strings |
| `constant.numeric` | Números |
| `constant.language` | `true`, `false`, `null` |
| `entity.name.type`, `entity.name.class` | Nomes de tipos/classes |
| `entity.name.function` | Nomes de funções |
| `entity.name.tag` | Tags HTML/JSX |
| `entity.other.attribute-name` | Atributos |
| `variable`, `variable.parameter` | Variáveis |
| `support.function`, `support.type` | Funções/tipos built-in |
| `punctuation` | Pontuação |
| `meta.tag` | Tags |
| `string.regexp` | Expressões regulares |
| `markup.deleted` | Texto deletado em diffs |

---

## Linguagens — Guia Detalhado

### Language Configuration (language-configuration.json)

Define comportamento de edição (brackets, comentários, auto-close):

```json
{
  "comments": {
    "lineComment": "//",
    "blockComment": ["/*", "*/"]
  },
  "brackets": [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
    ["<", ">"]
  ],
  "autoClosingPairs": [
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" },
    { "open": "(", "close": ")" },
    { "open": "'", "close": "'", "notIn": ["string", "comment"] },
    { "open": "\"", "close": "\"", "notIn": ["string"] },
    { "open": "`", "close": "`", "notIn": ["string", "comment"] },
    { "open": "<", "close": ">", "notIn": ["string", "comment"] }
  ],
  "surroundingPairs": [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
    ["'", "'"],
    ["\"", "\""],
    ["`", "`"],
    ["<", ">"]
  ],
  "folding": {
    "markers": {
      "start": "^\\s*//\\s*#?region\\b",
      "end": "^\\s*//\\s*#?endregion\\b"
    }
  },
  "indentationRules": {
    "increaseIndentPattern": "^((?!.*?\\/\\*).*\\{[^}\"'`]*|\\([^)\"'`]*)$",
    "decreaseIndentPattern": "^\\s*(\\}|\\))"
  }
}
```

---

## Snippets — Guia Detalhado

### Formato dos Snippets

```json
{
  "React Functional Component": {
    "prefix": ["rfc", "comp"],
    "body": [
      "export function ${1:${TM_FILENAME_BASE}}(${2:props}) {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  );",
      "}"
    ],
    "description": "Componente funcional React"
  }
}
```

### Variáveis Disponíveis

| Variável | Descrição |
|----------|-----------|
| `$1`, `$2`, `$0` | Tab stops (0 = posição final) |
| `${1:placeholder}` | Tab stop com texto padrão |
| `${1\|option1,option2\|}` | Tab stop com choices |
| `$TM_FILENAME` | Nome do arquivo atual |
| `$TM_FILENAME_BASE` | Nome sem extensão |
| `$TM_DIRECTORY` | Diretório do arquivo |
| `$TM_FILEPATH` | Caminho completo |
| `$CURRENT_YEAR` | Ano atual |
| `$CURRENT_MONTH` | Mês atual |
| `$CURRENT_DATE` | Dia atual |
| `$CLIPBOARD` | Conteúdo da área de transferência |
| `$LINE_COMMENT` | Comentário de linha da linguagem |

---

## Instalação

### Via Pasta (Desenvolvimento)
1. Abra o painel de **Extensões** na sidebar
2. Clique no ícone de **pasta** (📁)
3. Selecione a pasta que contém `extension.json`
4. A extensão é copiada para `~/.hyscode/extensions/` e ativada

### Via .zip (Distribuição)
1. Abra o painel de **Extensões** na sidebar
2. Clique no ícone de **arquivo** (📦)
3. Selecione o arquivo `.zip`
4. O zip é extraído e a extensão é instalada

### Estrutura do .zip aceita:

**Opção 1 — Arquivos na raiz:**
```
minha-extensao.zip
├── extension.json
├── main.js
└── themes/
```

**Opção 2 — Pasta no primeiro nível:**
```
minha-extensao.zip
└── minha-extensao/
    ├── extension.json
    ├── main.js
    └── themes/
```

---

## Empacotamento (.zip)

```bash
# Dentro do diretório da extensão:
cd minha-extensao
zip -r ../minha-extensao-1.0.0.zip .

# Ou pelo diretório pai:
zip -r minha-extensao-1.0.0.zip minha-extensao/

# No PowerShell:
Compress-Archive -Path .\minha-extensao\* -DestinationPath .\minha-extensao-1.0.0.zip
```

---

## Ciclo de Vida

```
Instalação → Carregamento → Ativação → Execução → Desativação → Desinstalação
```

1. **Instalação**: Extensão é copiada para `~/.hyscode/extensions/{name}/`
2. **Carregamento**: IDE lê `extension.json` e registra contribution points
3. **Ativação**: Se tem `main.js`, chama `activate(context)` baseado em `activationEvents`
4. **Execução**: Extensão responde a eventos, comandos, etc.
5. **Desativação**: `deactivate()` é chamado e subscriptions são limpas
6. **Desinstalação**: Pasta é removida e estado é limpo

### Contribution Points vs Código

- **Contribution points** (`contributes`) são carregados **sempre**, mesmo sem `main.js`
- **Código** (`main.js`) só é executado quando `activationEvents` são disparados
- Extensões apenas declarativas (temas, snippets) **não precisam de código**

---

## Boas Práticas

1. **Nome único** — Use prefixo do publisher: `publisher-nome-extensao`
2. **Categorias** — Sempre defina para facilitar a filtragem
3. **Descrição** — Seja claro e conciso
4. **Activation events** — Evite `onStartup`; use eventos específicos
5. **Cleanup** — Sempre implemente `deactivate()` e use `context.subscriptions`
6. **Versionamento** — Use semver (`major.minor.patch`)
7. **Teste o .zip** — Verifique que `extension.json` está acessível
8. **Validação** — Certifique-se que todos os campos obrigatórios estão presentes
9. **Ícone** — PNG 128x128 recomendado
10. **Readme** — Inclua documentação de uso

---

## Exemplos Completos

Veja as extensões de exemplo no repositório:
- `extensions/react-support/` — Suporte completo a React (linguagem + snippets + comandos)
- `extensions/tokyo-night/` — Tema Tokyo Night (tema de cores completo)

---

## Solução de Problemas

| Problema | Solução |
|----------|---------|
| "No extension.json found" | Verifique que o manifesto está na raiz da pasta/zip |
| "Invalid extension name" | Use apenas letras, números, hífens e underscores |
| Extensão não aparece | Verifique `~/.hyscode/extensions/` e `extension-state.json` |
| Tema não aplica | Verifique que `themes[].path` aponta para arquivo válido |
| Snippets não funcionam | Verifique que `snippets[].language` corresponde ao ID da linguagem |
| Comando não encontrado | Verifique que o comando está registrado em `contributes.commands` E no `main.js` |
