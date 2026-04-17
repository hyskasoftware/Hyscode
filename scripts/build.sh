#!/usr/bin/env bash
# ============================================================================
# HysCode — Unified Build Script
# Detects OS and runs the appropriate platform build script
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OS="$(uname -s)"

echo "╔══════════════════════════════════════════╗"
echo "║        HysCode Production Build          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

case "$OS" in
    Linux*)
        echo "Detected: Linux"
        echo ""
        bash "$SCRIPT_DIR/build-linux.sh" "$@"
        ;;
    Darwin*)
        echo "Detected: macOS"
        echo ""
        bash "$SCRIPT_DIR/build-macos.sh" "$@"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        echo "Detected: Windows (Git Bash / MSYS)"
        echo "Please use PowerShell instead:"
        echo "  .\\scripts\\build-windows.ps1"
        exit 1
        ;;
    *)
        echo "ERROR: Unsupported OS: $OS"
        exit 1
        ;;
esac
