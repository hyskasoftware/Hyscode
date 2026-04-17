import type { LspConnection } from './lsp-connection';
import type { CompletionItem, CompletionList, Hover, Location, LspDiagnostic } from './types';

type MonacoEditor = typeof import('monaco-editor');

export class MonacoLspAdapter {
  private disposables: Array<{ dispose(): void }> = [];
  private connection: LspConnection;
  private monaco: MonacoEditor;

  constructor(connection: LspConnection, monaco: MonacoEditor) {
    this.connection = connection;
    this.monaco = monaco;
  }

  register(languageId: string) {
    const caps = this.connection.capabilities;
    if (!caps) return;

    if (caps.completionProvider) {
      this.registerCompletionProvider(languageId, caps.completionProvider);
    }
    if (caps.hoverProvider) {
      this.registerHoverProvider(languageId);
    }
    if (caps.definitionProvider) {
      this.registerDefinitionProvider(languageId);
    }
    if (caps.signatureHelpProvider) {
      this.registerSignatureHelpProvider(languageId, caps.signatureHelpProvider);
    }
    if (caps.documentFormattingProvider) {
      this.registerFormattingProvider(languageId);
    }
    if (caps.codeActionProvider) {
      this.registerCodeActionProvider(languageId);
    }

    this.registerDiagnostics();
  }

  private registerCompletionProvider(
    languageId: string,
    options: { triggerCharacters?: string[]; resolveProvider?: boolean },
  ) {
    const conn = this.connection;
    const d = this.monaco.languages.registerCompletionItemProvider(languageId, {
      triggerCharacters: options.triggerCharacters ?? ['.'],
      provideCompletionItems: async (model, position) => {
        const uri = model.uri.toString();
        const result = (await conn.completion(uri, position.lineNumber - 1, position.column - 1)) as
          | CompletionList
          | CompletionItem[]
          | null;

        if (!result) return { suggestions: [] };
        const items = Array.isArray(result) ? result : result.items;

        return {
          suggestions: items.map((item) => ({
            label: item.label,
            kind: this.mapCompletionKind(item.kind),
            detail: item.detail,
            documentation: typeof item.documentation === 'string'
              ? item.documentation
              : item.documentation?.value,
            insertText: item.insertText ?? item.label,
            insertTextRules: item.insertTextFormat === 2
              ? this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            range: undefined as unknown as import('monaco-editor').IRange,
            sortText: item.sortText,
            filterText: item.filterText,
          })),
        };
      },
    });
    this.disposables.push(d);
  }

  private registerHoverProvider(languageId: string) {
    const conn = this.connection;
    const d = this.monaco.languages.registerHoverProvider(languageId, {
      provideHover: async (model, position) => {
        const uri = model.uri.toString();
        const result = (await conn.hover(uri, position.lineNumber - 1, position.column - 1)) as Hover | null;
        if (!result) return null;

        const contents = Array.isArray(result.contents)
          ? result.contents
          : [result.contents];

        return {
          contents: contents.map((c) =>
            typeof c === 'string'
              ? { value: c }
              : { value: c.value },
          ),
          range: result.range
            ? new this.monaco.Range(
                result.range.start.line + 1,
                result.range.start.character + 1,
                result.range.end.line + 1,
                result.range.end.character + 1,
              )
            : undefined,
        };
      },
    });
    this.disposables.push(d);
  }

  private registerDefinitionProvider(languageId: string) {
    const conn = this.connection;
    const monacoRef = this.monaco;
    const d = this.monaco.languages.registerDefinitionProvider(languageId, {
      provideDefinition: async (model, position) => {
        const uri = model.uri.toString();
        const result = (await conn.definition(uri, position.lineNumber - 1, position.column - 1)) as
          | Location
          | Location[]
          | null;

        if (!result) return null;
        const locations = Array.isArray(result) ? result : [result];

        return locations.map((loc) => ({
          uri: monacoRef.Uri.parse(loc.uri),
          range: new monacoRef.Range(
            loc.range.start.line + 1,
            loc.range.start.character + 1,
            loc.range.end.line + 1,
            loc.range.end.character + 1,
          ),
        }));
      },
    });
    this.disposables.push(d);
  }

  private registerSignatureHelpProvider(
    languageId: string,
    options: { triggerCharacters?: string[] },
  ) {
    const conn = this.connection;
    const d = this.monaco.languages.registerSignatureHelpProvider(languageId, {
      signatureHelpTriggerCharacters: options.triggerCharacters ?? ['(', ','],
      provideSignatureHelp: async (model, position) => {
        const uri = model.uri.toString();
        const result = (await conn.signatureHelp(uri, position.lineNumber - 1, position.column - 1)) as {
          signatures: Array<{
            label: string;
            documentation?: string | { kind: string; value: string };
            parameters?: Array<{ label: string | [number, number]; documentation?: string }>;
          }>;
          activeSignature?: number;
          activeParameter?: number;
        } | null;

        if (!result) return null;

        return {
          value: {
            signatures: result.signatures.map((sig) => ({
              label: sig.label,
              documentation: typeof sig.documentation === 'string'
                ? sig.documentation
                : sig.documentation?.value,
              parameters: (sig.parameters ?? []).map((p) => ({
                label: p.label,
                documentation: p.documentation,
              })),
            })),
            activeSignature: result.activeSignature ?? 0,
            activeParameter: result.activeParameter ?? 0,
          },
          dispose: () => {},
        };
      },
    });
    this.disposables.push(d);
  }

  private registerFormattingProvider(languageId: string) {
    const conn = this.connection;
    const monacoRef = this.monaco;
    const d = this.monaco.languages.registerDocumentFormattingEditProvider(languageId, {
      provideDocumentFormattingEdits: async (model, options) => {
        const uri = model.uri.toString();
        const result = (await conn.formatting(uri, options.tabSize, options.insertSpaces)) as
          | Array<{ range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }>
          | null;

        if (!result) return [];

        return result.map((edit) => ({
          range: new monacoRef.Range(
            edit.range.start.line + 1,
            edit.range.start.character + 1,
            edit.range.end.line + 1,
            edit.range.end.character + 1,
          ),
          text: edit.newText,
        }));
      },
    });
    this.disposables.push(d);
  }

  private registerCodeActionProvider(languageId: string) {
    const conn = this.connection;
    const d = this.monaco.languages.registerCodeActionProvider(languageId, {
      provideCodeActions: async (model, range, context) => {
        const uri = model.uri.toString();
        const lspRange = {
          start: { line: range.startLineNumber - 1, character: range.startColumn - 1 },
          end: { line: range.endLineNumber - 1, character: range.endColumn - 1 },
        };

        const result = (await conn.codeAction(uri, lspRange, context.markers)) as
          | Array<{ title: string; kind?: string; edit?: unknown; command?: unknown }>
          | null;

        if (!result) return { actions: [], dispose: () => {} };

        return {
          actions: result.map((action) => ({
            title: action.title,
            kind: action.kind,
            diagnostics: [],
            isPreferred: false,
          })),
          dispose: () => {},
        };
      },
    });
    this.disposables.push(d);
  }

  private registerDiagnostics() {
    this.connection.onNotification('textDocument/publishDiagnostics', (params) => {
      const { uri, diagnostics } = params as { uri: string; diagnostics: LspDiagnostic[] };
      const model = this.monaco.editor.getModels().find((m) => m.uri.toString() === uri);
      if (!model) return;

      const markers = diagnostics.map((d) => ({
        severity: this.mapSeverity(d.severity),
        startLineNumber: d.range.start.line + 1,
        startColumn: d.range.start.character + 1,
        endLineNumber: d.range.end.line + 1,
        endColumn: d.range.end.character + 1,
        message: d.message,
        source: d.source,
        code: d.code !== undefined ? String(d.code) : undefined,
      }));

      this.monaco.editor.setModelMarkers(model, `lsp-${this.connection.languageId}`, markers);
    });
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }

  private mapCompletionKind(kind?: number): import('monaco-editor').languages.CompletionItemKind {
    const map: Record<number, import('monaco-editor').languages.CompletionItemKind> = {
      1: this.monaco.languages.CompletionItemKind.Text,
      2: this.monaco.languages.CompletionItemKind.Method,
      3: this.monaco.languages.CompletionItemKind.Function,
      4: this.monaco.languages.CompletionItemKind.Constructor,
      5: this.monaco.languages.CompletionItemKind.Field,
      6: this.monaco.languages.CompletionItemKind.Variable,
      7: this.monaco.languages.CompletionItemKind.Class,
      8: this.monaco.languages.CompletionItemKind.Interface,
      9: this.monaco.languages.CompletionItemKind.Module,
      10: this.monaco.languages.CompletionItemKind.Property,
      13: this.monaco.languages.CompletionItemKind.Enum,
      14: this.monaco.languages.CompletionItemKind.Keyword,
      15: this.monaco.languages.CompletionItemKind.Snippet,
      21: this.monaco.languages.CompletionItemKind.Constant,
      22: this.monaco.languages.CompletionItemKind.Struct,
    };
    return map[kind ?? 1] ?? this.monaco.languages.CompletionItemKind.Text;
  }

  private mapSeverity(severity?: number): import('monaco-editor').MarkerSeverity {
    switch (severity) {
      case 1: return this.monaco.MarkerSeverity.Error;
      case 2: return this.monaco.MarkerSeverity.Warning;
      case 3: return this.monaco.MarkerSeverity.Info;
      case 4: return this.monaco.MarkerSeverity.Hint;
      default: return this.monaco.MarkerSeverity.Info;
    }
  }
}
