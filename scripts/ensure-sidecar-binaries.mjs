// ─── Ensure the Tauri Sidecar Binaries Directory Exists ─────────────────────
// `apps/desktop/src-tauri/binaries` holds compiled sidecar executables and is
// fully gitignored (`.gitignore` lists every artifact pattern), so a fresh CI
// checkout does not contain the directory. `bun build --compile --outfile`
// does not create missing parent directories and fails with ENOENT.
//
// Every sidecar build script runs this before compiling so local, CI, and
// release builds share one idempotent fix instead of duplicating mkdir logic.
// Usage: node scripts/ensure-sidecar-binaries.mjs

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const binariesDir = path.resolve(root, 'apps', 'desktop', 'src-tauri', 'binaries');

mkdirSync(binariesDir, { recursive: true });
console.log(`[ensure-sidecar-binaries] ${binariesDir}`);
