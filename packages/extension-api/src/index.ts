// ── Disposable ───────────────────────────────────────────────────────────────

export interface Disposable {
  dispose(): void;
}

// ── Extension Manifest (extension.json) ──────────────────────────────────────

export interface ExtensionManifest {
  name: string;
  displayName: string;
  version: string;
  description?: string;
  publisher: string;
  engines: { hyscode: string };
  main?: string;
  activationEvents?: string[];
  contributes?: ContributionPoints;
  icon?: string;
  categories?: string[];
  keywords?: string[];
}

// ── Contribution Points ──────────────────────────────────────────────────────

export interface ContributionPoints {
  themes?: ThemeContribution[];
  languages?: LanguageContribution[];
  languageServers?: LspContribution[];
  commands?: CommandContribution[];
  keybindings?: KeybindingContribution[];
  views?: ViewContribution[];
  statusBarItems?: StatusBarItemContribution[];
  configuration?: ConfigurationContribution;
}

// ── Theme Contribution ───────────────────────────────────────────────────────

export interface ThemeContribution {
  id: string;
  label: string;
  uiTheme: 'hyscode-dark' | 'hyscode-light';
  path: string;
}

export interface ThemeDefinition {
  id: string;
  label: string;
  type: 'dark' | 'light';
  colors: Record<string, string>;
  tokenColors?: TokenColorRule[];
  source?: 'builtin' | 'extension';
  extensionName?: string;
}

export interface TokenColorRule {
  scope: string | string[];
  settings: {
    foreground?: string;
    background?: string;
    fontStyle?: string;
  };
}

// ── Language Contribution ────────────────────────────────────────────────────

export interface LanguageContribution {
  id: string;
  aliases?: string[];
  extensions?: string[];
  filenames?: string[];
  mimetypes?: string[];
  configuration?: string;
  tokenizer?: string;
  icon?: string;
}

// ── Language Server Contribution ─────────────────────────────────────────────

export interface LspContribution {
  id: string;
  languageIds: string[];
  command: string;
  args?: string[];
  rootPatterns?: string[];
  initializationOptions?: Record<string, unknown>;
}

// ── Command Contribution ─────────────────────────────────────────────────────

export interface CommandContribution {
  id: string;
  title: string;
  category?: string;
  icon?: string;
  enablement?: string;
}

// ── Keybinding Contribution ──────────────────────────────────────────────────

export interface KeybindingContribution {
  command: string;
  key: string;
  mac?: string;
  when?: string;
}

// ── View Contribution ────────────────────────────────────────────────────────

export interface ViewContribution {
  id: string;
  name: string;
  icon?: string;
  when?: string;
}

// ── Status Bar Item Contribution ─────────────────────────────────────────────

export interface StatusBarItemContribution {
  id: string;
  text: string;
  tooltip?: string;
  command?: string;
  alignment?: 'left' | 'right';
  priority?: number;
}

// ── Configuration Contribution ───────────────────────────────────────────────

export interface ConfigurationContribution {
  title?: string;
  properties: Record<string, ConfigurationProperty>;
}

export interface ConfigurationProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: unknown;
  description?: string;
  enum?: string[];
  enumDescriptions?: string[];
  minimum?: number;
  maximum?: number;
}

// ── Extension Context (received by extension in activate()) ─────────────────

export interface ExtensionContext {
  extensionPath: string;
  extensionName: string;
  subscriptions: Disposable[];
  globalState: ExtensionMemento;
  workspaceState: ExtensionMemento;
}

export interface ExtensionMemento {
  get<T>(key: string, defaultValue?: T): T | undefined;
  update(key: string, value: unknown): Promise<void>;
  keys(): readonly string[];
}

// ── HysCode API (injected into extensions) ──────────────────────────────────

export interface HyscodeAPI {
  workspace: WorkspaceAPI;
  commands: CommandsAPI;
  window: WindowAPI;
  editor: EditorAPI;
  settings: SettingsAPI;
  git: GitAPI;
  themes: ThemesAPI;
  languages: LanguagesAPI;
}

// ── Workspace API ────────────────────────────────────────────────────────────

export interface WorkspaceAPI {
  rootPath: string | null;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDir(path: string): Promise<FileEntry[]>;
  onDidOpenFile(handler: (path: string) => void): Disposable;
  onDidSaveFile(handler: (path: string) => void): Disposable;
  onDidCloseFile(handler: (path: string) => void): Disposable;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

// ── Commands API ─────────────────────────────────────────────────────────────

export interface CommandsAPI {
  registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable;
  executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T>;
  getCommands(): string[];
}

// ── Window API ───────────────────────────────────────────────────────────────

export interface WindowAPI {
  showInformationMessage(message: string, ...actions: string[]): Promise<string | undefined>;
  showWarningMessage(message: string, ...actions: string[]): Promise<string | undefined>;
  showErrorMessage(message: string, ...actions: string[]): Promise<string | undefined>;
  createStatusBarItem(options: StatusBarItemOptions): StatusBarItem;
  registerViewProvider(viewId: string, provider: ViewProvider): Disposable;
}

export interface StatusBarItemOptions {
  id: string;
  text: string;
  tooltip?: string;
  command?: string;
  alignment?: 'left' | 'right';
  priority?: number;
}

export interface StatusBarItem extends Disposable {
  id: string;
  text: string;
  tooltip?: string;
  command?: string;
  show(): void;
  hide(): void;
  update(options: Partial<StatusBarItemOptions>): void;
}

export interface ViewProvider {
  render(): HTMLElement | string;
  onVisibilityChange?(visible: boolean): void;
}

// ── Editor API ───────────────────────────────────────────────────────────────

export interface EditorAPI {
  activeFilePath: string | null;
  openFile(path: string): Promise<void>;
  getSelectedText(): string | null;
  insertText(text: string): void;
  addDecorations(
    filePath: string,
    decorations: EditorDecoration[],
  ): Disposable;
}

export interface EditorDecoration {
  range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  options: {
    className?: string;
    inlineClassName?: string;
    hoverMessage?: string;
    isWholeLine?: boolean;
    glyphMarginClassName?: string;
  };
}

// ── Settings API ─────────────────────────────────────────────────────────────

export interface SettingsAPI {
  get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  onDidChange(key: string, handler: (newValue: unknown) => void): Disposable;
}

// ── Git API ──────────────────────────────────────────────────────────────────

export interface GitAPI {
  currentBranch(): Promise<string | null>;
  status(): Promise<GitFileStatus[]>;
  diff(staged?: boolean): Promise<string>;
  onDidChangeBranch(handler: (branch: string) => void): Disposable;
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';
}

// ── Themes API ───────────────────────────────────────────────────────────────

export interface ThemesAPI {
  registerTheme(theme: ThemeDefinition): Disposable;
  getActiveThemeId(): string;
}

// ── Languages API ────────────────────────────────────────────────────────────

export interface LanguagesAPI {
  registerLanguage(language: LanguageRegistration): Disposable;
  registerLanguageServer(config: LspContribution): Disposable;
  setLanguageDiagnostics(uri: string, diagnostics: Diagnostic[]): void;
}

export interface LanguageRegistration {
  id: string;
  extensions?: string[];
  aliases?: string[];
  mimetypes?: string[];
}

export interface Diagnostic {
  range: { startLine: number; startColumn: number; endLine: number; endColumn: number };
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
  code?: string | number;
}

// ── Extension Module Shape ───────────────────────────────────────────────────

export interface ExtensionModule {
  activate(context: ExtensionContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}
