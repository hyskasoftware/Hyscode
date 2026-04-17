#!/usr/bin/env bash
# ============================================================================
# HysCode Production Build Script — Linux
# Generates: .deb, .AppImage, .tar.gz
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
DESKTOP="$ROOT/apps/desktop"
TAURI_DIR="$DESKTOP/src-tauri"
RELEASE_DIR="$TAURI_DIR/target/release"
BUNDLE_DIR="$RELEASE_DIR/bundle"
VERSION="0.1.0"
APP_NAME="hyscode"
ARCH="$(uname -m)"

echo ""
echo "============================================"
echo "  HysCode Production Build — Linux"
echo "  Version: $VERSION"
echo "  Arch:    $ARCH"
echo "============================================"
echo ""

# ── Step 1: Check prerequisites ─────────────────────────────────────────────
echo "[1/5] Checking prerequisites..."

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

# Check Linux build dependencies
echo "  Checking system dependencies..."
MISSING_DEPS=()

for pkg in libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev libssl-dev librsvg2-dev; do
    if ! dpkg -s "$pkg" &>/dev/null 2>&1; then
        MISSING_DEPS+=("$pkg")
    fi
done

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo "  ⚠ Missing system dependencies:"
    printf "    - %s\n" "${MISSING_DEPS[@]}"
    echo ""
    echo "  Install with:"
    echo "    sudo apt install -y ${MISSING_DEPS[*]}"
    echo ""
    read -rp "  Install now? [Y/n] " answer
    if [[ "$answer" != "n" && "$answer" != "N" ]]; then
        sudo apt install -y "${MISSING_DEPS[@]}"
    else
        echo "  Aborting."
        exit 1
    fi
fi
echo "  ✓ System dependencies OK"

# ── Step 2: Install dependencies ─────────────────────────────────────────────
echo ""
echo "[2/5] Installing Node dependencies..."
cd "$ROOT"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo "  ✓ Dependencies installed"

# ── Step 3: Build frontend ───────────────────────────────────────────────────
echo ""
echo "[3/5] Building frontend..."
cd "$ROOT"
pnpm build
echo "  ✓ Frontend built"

# ── Step 4: Build Tauri bundles (.deb + .AppImage) ──────────────────────────
echo ""
echo "[4/5] Building Tauri bundles..."
cd "$DESKTOP"

export TAURI_SIGNING_PRIVATE_KEY=""
pnpm tauri build

echo "  ✓ Tauri build complete"

# ── Step 5: Create .tar.gz archive ──────────────────────────────────────────
echo ""
echo "[5/5] Creating .tar.gz archive..."

TAR_DIR="$BUNDLE_DIR/tar"
mkdir -p "$TAR_DIR"

TAR_STAGING="$TAR_DIR/${APP_NAME}-${VERSION}"
rm -rf "$TAR_STAGING"
mkdir -p "$TAR_STAGING"

# Copy binary
if [ -f "$RELEASE_DIR/$APP_NAME" ]; then
    cp "$RELEASE_DIR/$APP_NAME" "$TAR_STAGING/"
elif [ -f "$RELEASE_DIR/hyscode" ]; then
    cp "$RELEASE_DIR/hyscode" "$TAR_STAGING/"
fi

# Copy resources if they exist
if [ -d "$RELEASE_DIR/resources" ]; then
    cp -r "$RELEASE_DIR/resources" "$TAR_STAGING/"
fi

# Create desktop entry
cat > "$TAR_STAGING/$APP_NAME.desktop" << EOF
[Desktop Entry]
Name=HysCode
Comment=An agentic code IDE
Exec=$APP_NAME %F
Icon=$APP_NAME
Type=Application
Categories=Development;IDE;TextEditor;
MimeType=text/plain;
StartupWMClass=HysCode
StartupNotify=true
EOF

# Copy icon
ICON_SRC="$TAURI_DIR/icons/128x128.png"
if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$TAR_STAGING/$APP_NAME.png"
fi

# Create install script
cat > "$TAR_STAGING/install.sh" << 'INSTALL_EOF'
#!/usr/bin/env bash
set -euo pipefail

PREFIX="${1:-/usr/local}"
BIN_DIR="$PREFIX/bin"
SHARE_DIR="$PREFIX/share"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing HysCode to $PREFIX..."

sudo mkdir -p "$BIN_DIR"
sudo cp "$SCRIPT_DIR/hyscode" "$BIN_DIR/"
sudo chmod +x "$BIN_DIR/hyscode"

if [ -d "$SCRIPT_DIR/resources" ]; then
    sudo mkdir -p "$SHARE_DIR/hyscode"
    sudo cp -r "$SCRIPT_DIR/resources" "$SHARE_DIR/hyscode/"
fi

if [ -f "$SCRIPT_DIR/hyscode.desktop" ]; then
    sudo mkdir -p "$SHARE_DIR/applications"
    sudo cp "$SCRIPT_DIR/hyscode.desktop" "$SHARE_DIR/applications/"
fi

if [ -f "$SCRIPT_DIR/hyscode.png" ]; then
    sudo mkdir -p "$SHARE_DIR/icons/hicolor/128x128/apps"
    sudo cp "$SCRIPT_DIR/hyscode.png" "$SHARE_DIR/icons/hicolor/128x128/apps/"
fi

echo "✓ HysCode installed to $PREFIX"
echo "  Run with: hyscode"
INSTALL_EOF
chmod +x "$TAR_STAGING/install.sh"

# Create tar.gz
TAR_FILE="$TAR_DIR/${APP_NAME}-${VERSION}-linux-${ARCH}.tar.gz"
cd "$TAR_DIR"
tar -czf "$TAR_FILE" "$(basename "$TAR_STAGING")"
rm -rf "$TAR_STAGING"

echo "  ✓ tar.gz created: $TAR_FILE"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Build Complete!"
echo "============================================"
echo ""
echo "Output directory: $BUNDLE_DIR"
echo ""
echo "Generated files:"

find "$BUNDLE_DIR" -type f \( -name "*.deb" -o -name "*.AppImage" -o -name "*.tar.gz" \) | while read -r file; do
    size=$(du -h "$file" | cut -f1)
    echo "  $(basename "$file") ($size)"
done

echo ""
