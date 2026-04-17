#!/usr/bin/env bash
# ============================================================================
# HysCode Production Build Script — macOS
# Generates: .dmg, .app bundle
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
DESKTOP="$ROOT/apps/desktop"
TAURI_DIR="$DESKTOP/src-tauri"
VERSION="0.1.0"
ARCH="$(uname -m)"

# Determine Rust target
if [ "$ARCH" = "arm64" ]; then
    RUST_TARGET="aarch64-apple-darwin"
else
    RUST_TARGET="x86_64-apple-darwin"
fi

echo ""
echo "============================================"
echo "  HysCode Production Build — macOS"
echo "  Version: $VERSION"
echo "  Arch:    $ARCH ($RUST_TARGET)"
echo "============================================"
echo ""

# ── Flags ────────────────────────────────────────────────────────────────────
SIGN=false
UNIVERSAL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --sign) SIGN=true; shift ;;
        --universal) UNIVERSAL=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ── Step 1: Check prerequisites ─────────────────────────────────────────────
echo "[1/4] Checking prerequisites..."

command_exists() {
    command -v "$1" &>/dev/null
}

if ! command_exists rustc; then
    echo "ERROR: Rust is not installed. Install from https://rustup.rs"
    exit 1
fi
echo "  ✓ Rust $(rustc --version)"

if ! command_exists pnpm; then
    echo "ERROR: pnpm is not installed. Install with: npm install -g pnpm"
    exit 1
fi
echo "  ✓ pnpm $(pnpm --version)"

if ! command_exists cargo; then
    echo "ERROR: Cargo not found."
    exit 1
fi
echo "  ✓ Cargo $(cargo --version)"

# Check Xcode command line tools
if ! xcode-select -p &>/dev/null; then
    echo "  ⚠ Xcode Command Line Tools not found. Installing..."
    xcode-select --install
    echo "  Please re-run after installation completes."
    exit 1
fi
echo "  ✓ Xcode CLI tools"

# For universal builds, ensure both targets are installed
if $UNIVERSAL; then
    echo "  Setting up universal binary targets..."
    rustup target add aarch64-apple-darwin 2>/dev/null || true
    rustup target add x86_64-apple-darwin 2>/dev/null || true
    echo "  ✓ Universal targets ready"
fi

# ── Step 2: Install dependencies ─────────────────────────────────────────────
echo ""
echo "[2/4] Installing Node dependencies..."
cd "$ROOT"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo "  ✓ Dependencies installed"

# ── Step 3: Build frontend ───────────────────────────────────────────────────
echo ""
echo "[3/4] Building frontend..."
cd "$ROOT"
pnpm build
echo "  ✓ Frontend built"

# ── Step 4: Build Tauri bundle (.dmg + .app) ────────────────────────────────
echo ""
echo "[4/4] Building Tauri bundles..."
cd "$DESKTOP"

export TAURI_SIGNING_PRIVATE_KEY=""

if $UNIVERSAL; then
    echo "  Building universal binary (x86_64 + aarch64)..."
    pnpm tauri build --target universal-apple-darwin
else
    pnpm tauri build --target "$RUST_TARGET"
fi

echo "  ✓ Tauri build complete"

# ── Code signing (optional) ─────────────────────────────────────────────────
if $SIGN; then
    echo ""
    echo "[+] Code signing..."
    
    BUNDLE_DIR="$TAURI_DIR/target/release/bundle"
    APP_PATH=$(find "$BUNDLE_DIR" -name "*.app" -maxdepth 3 | head -1)
    
    if [ -n "$APP_PATH" ]; then
        if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
            codesign --deep --force --verify --verbose \
                --sign "$APPLE_SIGNING_IDENTITY" \
                --options runtime \
                "$APP_PATH"
            echo "  ✓ App signed with: $APPLE_SIGNING_IDENTITY"
        else
            echo "  ⚠ APPLE_SIGNING_IDENTITY not set. Skipping code signing."
            echo "    Set it with: export APPLE_SIGNING_IDENTITY=\"Developer ID Application: Your Name (TEAM_ID)\""
        fi
    fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
BUNDLE_DIR="$TAURI_DIR/target/release/bundle"

if $UNIVERSAL; then
    BUNDLE_DIR="$TAURI_DIR/target/universal-apple-darwin/release/bundle"
fi

echo ""
echo "============================================"
echo "  Build Complete!"
echo "============================================"
echo ""
echo "Output directory: $BUNDLE_DIR"
echo ""
echo "Generated files:"

find "$BUNDLE_DIR" -type f \( -name "*.dmg" -o -name "*.app" \) -maxdepth 3 | while read -r file; do
    size=$(du -h "$file" | cut -f1)
    echo "  $(basename "$file") ($size)"
done

echo ""
echo "Notes:"
echo "  • To notarize for distribution: xcrun notarytool submit <path-to-dmg>"
echo "  • For universal binary: ./build-macos.sh --universal"
echo "  • For signed build: ./build-macos.sh --sign"
echo ""
