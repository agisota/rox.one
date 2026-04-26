#!/bin/bash
# Generate app icons for all platforms from a source SVG or PNG.
# Usage: ./generate-icons.sh [icon.svg|source.png]

set -e

INPUT_SOURCE="${1:-icon.svg}"
TEMP_SOURCE=""
ICONSET="icon.iconset"

if [ ! -f "$INPUT_SOURCE" ]; then
    echo "Error: Source file '$INPUT_SOURCE' not found"
    echo "Usage: ./generate-icons.sh [icon.svg|source.png]"
    exit 1
fi

case "${INPUT_SOURCE##*.}" in
    svg|SVG)
        if ! command -v rsvg-convert &> /dev/null; then
            echo "Error: rsvg-convert is required to render SVG icons"
            echo "Install with: brew install librsvg"
            exit 1
        fi
        TEMP_SOURCE="$(mktemp "${TMPDIR:-/tmp}/rox-one-icon-XXXXXX.png")"
        rsvg-convert -w 1024 -h 1024 "$INPUT_SOURCE" -o "$TEMP_SOURCE"
        SOURCE="$TEMP_SOURCE"
        ;;
    *)
        SOURCE="$INPUT_SOURCE"
        ;;
esac

trap 'rm -f "$TEMP_SOURCE"; rm -rf "$ICONSET"' EXIT

echo "Generating icons from: $INPUT_SOURCE"

# Create temporary iconset directory for macOS
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

# Generate all sizes for macOS iconset
echo "Generating macOS iconset..."
sips -z 16 16 "$SOURCE" --out "$ICONSET/icon_16x16.png" > /dev/null
sips -z 32 32 "$SOURCE" --out "$ICONSET/icon_16x16@2x.png" > /dev/null
sips -z 32 32 "$SOURCE" --out "$ICONSET/icon_32x32.png" > /dev/null
sips -z 64 64 "$SOURCE" --out "$ICONSET/icon_32x32@2x.png" > /dev/null
sips -z 128 128 "$SOURCE" --out "$ICONSET/icon_128x128.png" > /dev/null
sips -z 256 256 "$SOURCE" --out "$ICONSET/icon_128x128@2x.png" > /dev/null
sips -z 256 256 "$SOURCE" --out "$ICONSET/icon_256x256.png" > /dev/null
sips -z 512 512 "$SOURCE" --out "$ICONSET/icon_256x256@2x.png" > /dev/null
sips -z 512 512 "$SOURCE" --out "$ICONSET/icon_512x512.png" > /dev/null
sips -z 1024 1024 "$SOURCE" --out "$ICONSET/icon_512x512@2x.png" > /dev/null

# Generate .icns for macOS
echo "Creating icon.icns..."
iconutil -c icns "$ICONSET" -o icon.icns

# Generate icon.png for Linux (512x512)
echo "Creating icon.png for Linux..."
sips -z 512 512 "$SOURCE" --out icon.png > /dev/null

# Generate icon.ico for Windows using ImageMagick when available,
# otherwise fall back to Pillow if Python imaging support exists.
if command -v convert &> /dev/null; then
    echo "Creating icon.ico for Windows..."
    # Create multiple sizes for ICO
    sips -z 16 16 "$SOURCE" --out icon_16.png > /dev/null
    sips -z 24 24 "$SOURCE" --out icon_24.png > /dev/null
    sips -z 32 32 "$SOURCE" --out icon_32.png > /dev/null
    sips -z 48 48 "$SOURCE" --out icon_48.png > /dev/null
    sips -z 64 64 "$SOURCE" --out icon_64.png > /dev/null
    sips -z 128 128 "$SOURCE" --out icon_128.png > /dev/null
    sips -z 256 256 "$SOURCE" --out icon_256.png > /dev/null

    convert icon_16.png icon_24.png icon_32.png icon_48.png icon_64.png icon_128.png icon_256.png icon.ico

    # Clean up temp files
    rm -f icon_16.png icon_24.png icon_32.png icon_48.png icon_64.png icon_128.png icon_256.png
elif python3 - <<'PY' >/dev/null 2>&1
from PIL import Image
PY
then
    echo "Creating icon.ico for Windows via Pillow..."
    python3 - <<'PY'
from PIL import Image

img = Image.open("icon.png")
sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save("icon.ico", format="ICO", sizes=sizes)
PY
else
    echo "Warning: neither ImageMagick nor Pillow is installed. Skipping .ico generation."
    echo "Install with: brew install imagemagick"
fi

echo ""
echo "✅ Icons generated:"
ls -la icon.*

echo ""
echo "Next steps:"
echo "1. Verify icon readability at 16px/32px and halo clipping on dark backgrounds"
echo "2. Run: bun run electron:build"
