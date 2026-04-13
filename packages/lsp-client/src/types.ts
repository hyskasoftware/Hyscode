// ── LSP JSON-RPC Types ───────────────────────────────────────────────────────

export interface LspMessage {
  jsonrpc: '2.0';
}

export interface LspRequest extends LspMessage {
  id: number | string;
  method: string;
  params?: unknown;
}

export interface LspResponse extends LspMessage {
  id: number | string | null;
  result?: unknown;
  error?: LspError;
}

export interface LspNotification extends LspMessage {
  method: string;
  params?: unknown;
}

export interface LspError {
  code: number;
  message: string;
  data?: unknown;
}

// ── Transport Interface ──────────────────────────────────────────────────────

export interface MessageTransport {
  send(message: LspRequest | LspNotification): void;
  onMessage(handler: (message: LspResponse | LspNotification) => void): void;
  close(): void;
}

// ── Server Capabilities (subset) ─────────────────────────────────────────────

export interface ServerCapabilities {
  completionProvider?: { triggerCharacters?: string[]; resolveProvider?: boolean };
  hoverProvider?: boolean;
  definitionProvider?: boolean;
  referencesProvider?: boolean;
  signatureHelpProvider?: { triggerCharacters?: string[] };
  documentFormattingProvider?: boolean;
  documentRangeFormattingProvider?: boolean;
  codeActionProvider?: boolean;
  documentSymbolProvider?: boolean;
  workspaceSymbolProvider?: boolean;
  renameProvider?: boolean;
  diagnosticProvider?: { interFileDependencies?: boolean; workspaceDiagnostics?: boolean };
  textDocumentSync?: number | { openClose?: boolean; change?: number; save?: boolean | { includeText?: boolean } };
}

export interface InitializeResult {
  capabilities: ServerCapabilities;
  serverInfo?: { name: string; version?: string };
}

// ── Diagnostic ───────────────────────────────────────────────────────────────

export interface LspDiagnostic {
  range: LspRange;
  severity?: number; // 1=Error 2=Warning 3=Info 4=Hint
  code?: number | string;
  source?: string;
  message: string;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspPosition {
  line: number;
  character: number;
}

// ── Completion ───────────────────────────────────────────────────────────────

export interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string | { kind: string; value: string };
  insertText?: string;
  insertTextFormat?: number;
  textEdit?: { range: LspRange; newText: string };
  sortText?: string;
  filterText?: string;
}

export interface CompletionList {
  isIncomplete: boolean;
  items: CompletionItem[];
}

// ── Hover ────────────────────────────────────────────────────────────────────

export interface Hover {
  contents: string | { kind: string; value: string } | Array<string | { kind: string; value: string }>;
  range?: LspRange;
}

// ── Location ─────────────────────────────────────────────────────────────────

export interface Location {
  uri: string;
  range: LspRange;
}
