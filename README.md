# HysCode

**Desktop-native agentic IDE** built on Tauri v2 where AI agents write, edit, and execute code using real developer tools.

[![CI](https://github.com/Estevaobonatto/Hyscode/actions/workflows/ci.yml/badge.svg)](https://github.com/Estevaobonatto/Hyscode/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](./CHANGELOG.md)

---

## What is HysCode?

HysCode reimagines software development by bringing AI to the core of your coding environment. Instead of just suggesting code, HysCode enables AI agents to:

- **Write and edit code** in real time using Monaco Editor
- **Execute developer tools** — terminal, git, filesystem operations
- **Follow specifications** via Spec-Driven Development (SDD)
- **Request approval** for every change with full user control

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│  File Tree │ Monaco Editor │ Agent Panel │ Terminal │ Settings   │
│  React 19 + shadcn/ui + Tailwind v4 + Zustand                   │
├──────────────────────────────────────────────────────────────────┤
│                     TAURI IPC BOUNDARY                           │
│  invoke() / emit() / listen() — typed commands                   │
├──────────────────────────────────────────────────────────────────┤
│                      TAURI RUST SHELL                            │
│  FS Commands │ PTY Manager │ Git Ops │ SQLite │ Process Sandbox  │
├──────────────────────────────────────────────────────────────────┤
│                     AGENT HARNESS (TS)                           │
│  Agent Loop │ Context Manager │ Tool Router │ SDD Engine         │
├──────────────────────────────────────────────────────────────────┤
│                    AI PROVIDER LAYER (TS)                        │
│  Anthropic │ OpenAI │ Gemini │ Ollama │ OpenRouter               │
├──────────────────────────────────────────────────────────────────┤
│                     MCP CLIENT (TS)                              │
│  @modelcontextprotocol/sdk │ stdio / SSE / WS transports         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript |
| UI components | shadcn/ui + Tailwind CSS v4 |
| State management | Zustand |
| Code editor | Monaco Editor |
| Terminal | xterm.js + Tauri PTY |
| Database | SQLite (tauri-plugin-sql) |
| Build system | Turborepo + pnpm workspaces |
| AI providers | Anthropic, OpenAI, Gemini, Ollama, OpenRouter |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 10+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/)

### Development

```bash
# Clone the repository
git clone https://github.com/Estevaobonatto/Hyscode.git
cd Hyscode

# Install dependencies
pnpm install

# Start in development mode
pnpm dev
```

The Tauri window will open automatically with hot reload enabled.

### Production Build

```bash
# Windows
pnpm run build:prod

# macOS / Linux
pnpm run build
```

Installers are output to `apps/desktop/src-tauri/target/release/bundle/`.

---

## Repository Structure

```
apps/
  desktop/           # Tauri v2 desktop app (React + Vite frontend)
    src/             # React components, stores, hooks
    src-tauri/       # Rust backend, commands, migrations
packages/
  ai-providers/      # Multi-provider AI abstraction layer
  agent-harness/     # Agentic loop, tool routing, SDD engine
  mcp-client/        # Model Context Protocol client
  skills/            # Built-in agent skills
  ui/                # Shared UI components
  extension-api/     # Extension authoring API
  extension-host/    # Extension sandbox runtime
  lsp-client/        # Language Server Protocol client
extensions/          # Bundled extensions (themes, language support)
docs/                # Architecture and specification docs
scripts/             # Platform build scripts
```


## Documentation

- [Architecture Overview](./docs/architecture/OVERVIEW.md)
- [Agent Harness](./docs/architecture/AGENT_HARNESS.md)
- [AI Providers](./docs/architecture/AI_PROVIDERS.md)
- [MCP Client](./docs/architecture/MCP.md)
- [Database Schema](./docs/architecture/DATABASE.md)
- [Frontend Architecture](./docs/architecture/FRONTEND.md)
- [Tauri Backend](./docs/architecture/TAURI.md)
- [Extension Guide](./docs/EXTENSION_GUIDE.md)
- [MVP Spec](./docs/specs/MVP_SPEC.md)

---

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

---

## Security

For responsible disclosure of security vulnerabilities, see [SECURITY.md](./SECURITY.md).

---

## License

MIT — see [LICENSE](./LICENSE) for details.
