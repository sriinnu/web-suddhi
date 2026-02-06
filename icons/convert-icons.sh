#!/bin/bash
# Icon conversion script for WebSuddhi
# Converts SVG source files to PNG at various sizes
#
# Prerequisites:
# - Inkscape: brew install inkscape (macOS) or apt install inkscape (Linux)
# - OR ImageMagick: brew install imagemagick (macOS) or apt install imagemagick (Linux)
# - OR rsvg-convert: brew install librsvg (macOS) or apt install librsvg2-bin (Linux)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Define sizes
SIZES=(16 32 48 128 256)

# Function to convert using Inkscape (best quality)
convert_inkscape() {
    local svg_file="$1"
    local output_base="$2"

    for size in "${SIZES[@]}"; do
        echo "Converting $svg_file to ${output_base}${size}.png (${size}x${size})..."
        inkscape --export-type=png \
                 --export-filename="${output_base}${size}.png" \
                 --export-width=$size \
                 --export-height=$size \
                 "$svg_file" 2>/dev/null
    done
}

# Function to convert using rsvg-convert (good quality, fast)
convert_rsvg() {
    local svg_file="$1"
    local output_base="$2"

    for size in "${SIZES[@]}"; do
        echo "Converting $svg_file to ${output_base}${size}.png (${size}x${size})..."
        rsvg-convert -w $size -h $size "$svg_file" > "${output_base}${size}.png"
    done
}

# Function to convert using ImageMagick (fallback)
convert_imagemagick() {
    local svg_file="$1"
    local output_base="$2"

    for size in "${SIZES[@]}"; do
        echo "Converting $svg_file to ${output_base}${size}.png (${size}x${size})..."
        convert -background none -density 300 -resize ${size}x${size} "$svg_file" "${output_base}${size}.png"
    done
}

# Detect available converter
if command -v inkscape &> /dev/null; then
    CONVERTER="inkscape"
    echo "Using Inkscape for conversion..."
elif command -v rsvg-convert &> /dev/null; then
    CONVERTER="rsvg"
    echo "Using rsvg-convert for conversion..."
elif command -v convert &> /dev/null; then
    CONVERTER="imagemagick"
    echo "Using ImageMagick for conversion..."
else
    echo "Error: No suitable converter found."
    echo "Please install one of: inkscape, librsvg, or imagemagick"
    exit 1
fi

# Convert main icon
echo ""
echo "=== Converting main icon ==="
case $CONVERTER in
    inkscape) convert_inkscape "icon-source.svg" "icon" ;;
    rsvg) convert_rsvg "icon-source.svg" "icon" ;;
    imagemagick) convert_imagemagick "icon-source.svg" "icon" ;;
esac

# Convert alert icon
echo ""
echo "=== Converting alert icon ==="
case $CONVERTER in
    inkscape) convert_inkscape "icon-source-alert.svg" "icon" ;;
    rsvg) convert_rsvg "icon-source-alert.svg" "icon" ;;
    imagemagick) convert_imagemagick "icon-source-alert.svg" "icon" ;;
esac

# Rename alert icons
echo ""
echo "=== Renaming alert icons ==="
for size in "${SIZES[@]}"; do
    if [ -f "icon${size}.png" ]; then
        # The alert versions were exported, so we need to handle this differently
        # First, backup the main icons
        :
    fi
done

# Actually, let's do this properly - convert to temp first
echo ""
echo "=== Finalizing icon files ==="

# Convert main icons
for size in "${SIZES[@]}"; do
    case $CONVERTER in
        inkscape)
            inkscape --export-type=png \
                     --export-filename="icon${size}.png" \
                     --export-width=$size \
                     --export-height=$size \
                     "icon-source.svg" 2>/dev/null
            inkscape --export-type=png \
                     --export-filename="icon${size}-alert.png" \
                     --export-width=$size \
                     --export-height=$size \
                     "icon-source-alert.svg" 2>/dev/null
            ;;
        rsvg)
            rsvg-convert -w $size -h $size "icon-source.svg" > "icon${size}.png"
            rsvg-convert -w $size -h $size "icon-source-alert.svg" > "icon${size}-alert.png"
            ;;
        imagemagick)
            convert -background none -density 300 -resize ${size}x${size} "icon-source.svg" "icon${size}.png"
            convert -background none -density 300 -resize ${size}x${size} "icon-source-alert.svg" "icon${size}-alert.png"
            ;;
    esac
    echo "Created icon${size}.png and icon${size}-alert.png"
done

echo ""
echo "=== Done! ==="
echo "Icons created:"
ls -la icon*.png
