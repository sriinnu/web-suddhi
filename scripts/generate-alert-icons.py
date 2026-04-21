#!/usr/bin/env python3
"""
WebSuddhi Icon Generator
Generates alert icons (red warning) and enhanced main icons for the extension.
Requires: pip install Pillow
"""

from PIL import Image, ImageDraw, ImageFont
import math
import os

def create_gradient_circle(draw, center, radius, color1, color2, steps=100):
    """Create a radial gradient circle."""
    for i in range(steps, 0, -1):
        r = int(radius * i / steps)
        # Interpolate colors
        ratio = i / steps
        color = tuple(int(c1 * ratio + c2 * (1 - ratio)) for c1, c2 in zip(color1, color2))
        draw.ellipse(
            [center[0] - r, center[1] - r, center[0] + r, center[1] + r],
            fill=color + (255,)
        )

def draw_shield(draw, center, size, fill_color, stroke_color=None, stroke_width=0):
    """Draw a shield shape."""
    cx, cy = center
    # Shield proportions relative to size
    top = cy - size * 0.55
    bottom = cy + size * 0.55
    left = cx - size * 0.45
    right = cx + size * 0.45
    mid_y = cy + size * 0.1

    # Shield path points
    points = [
        (cx, top),  # Top center
        (right, top + size * 0.15),  # Top right
        (right, mid_y),  # Right side
        (cx, bottom),  # Bottom point
        (left, mid_y),  # Left side
        (left, top + size * 0.15),  # Top left
    ]

    if fill_color:
        draw.polygon(points, fill=fill_color)
    if stroke_color and stroke_width > 0:
        draw.polygon(points, outline=stroke_color)

def draw_exclamation(draw, center, size, color):
    """Draw an exclamation mark."""
    cx, cy = center
    bar_width = max(2, int(size * 0.12))
    bar_height = int(size * 0.35)
    dot_radius = max(1, int(size * 0.08))

    # Bar
    bar_top = cy - size * 0.2
    draw.rounded_rectangle(
        [cx - bar_width//2, bar_top, cx + bar_width//2, bar_top + bar_height],
        radius=bar_width//2,
        fill=color
    )

    # Dot
    dot_y = bar_top + bar_height + size * 0.08 + dot_radius
    draw.ellipse(
        [cx - dot_radius, dot_y - dot_radius, cx + dot_radius, dot_y + dot_radius],
        fill=color
    )

def draw_triangle(draw, center, size, fill_color, stroke_color=None):
    """Draw a warning triangle."""
    cx, cy = center
    height = size * 0.45
    width = size * 0.5

    top = cy - height * 0.4
    bottom = cy + height * 0.6

    points = [
        (cx, top),  # Top
        (cx + width/2, bottom),  # Bottom right
        (cx - width/2, bottom),  # Bottom left
    ]

    if fill_color:
        draw.polygon(points, fill=fill_color)
    if stroke_color:
        draw.polygon(points, outline=stroke_color)

def create_alert_icon(size):
    """Create a red alert/warning icon."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = (size // 2, size // 2)
    padding = max(1, size // 16)
    radius = size // 2 - padding

    # Colors
    red_light = (239, 68, 68)  # #ef4444
    red_dark = (185, 28, 28)   # #b91c1c
    white = (255, 255, 255)
    shield_white = (255, 255, 255)

    # Background circle with gradient effect (simplified)
    for i in range(radius, 0, -1):
        ratio = i / radius
        r = int(red_light[0] * ratio + red_dark[0] * (1 - ratio))
        g = int(red_light[1] * ratio + red_dark[1] * (1 - ratio))
        b = int(red_light[2] * ratio + red_dark[2] * (1 - ratio))
        draw.ellipse(
            [center[0] - i, center[1] - i, center[0] + i, center[1] + i],
            fill=(r, g, b, 255)
        )

    # Shield
    shield_size = radius * 0.85
    draw_shield(draw, center, shield_size, shield_white)

    # Warning triangle inside shield
    triangle_size = shield_size * 0.7
    triangle_center = (center[0], center[1] + shield_size * 0.05)
    draw_triangle(draw, triangle_center, triangle_size, red_dark)

    # Exclamation mark
    exclaim_size = triangle_size * 0.6
    exclaim_center = (center[0], center[1] + shield_size * 0.05)
    draw_exclamation(draw, exclaim_center, exclaim_size, white)

    return img

def draw_checkmark(draw, center, size, color, stroke_width):
    """Draw a checkmark."""
    cx, cy = center

    # Checkmark points
    start = (cx - size * 0.3, cy)
    mid = (cx - size * 0.05, cy + size * 0.25)
    end = (cx + size * 0.35, cy - size * 0.2)

    draw.line([start, mid], fill=color, width=stroke_width)
    draw.line([mid, end], fill=color, width=stroke_width)

def draw_w_letter(draw, center, size, color, stroke_width):
    """Draw a W letter."""
    cx, cy = center
    h = size * 0.4  # height
    w = size * 0.35  # width

    top_y = cy - h/2
    bottom_y = cy + h/2
    mid_y = cy + h * 0.1

    points = [
        (cx - w, top_y),
        (cx - w/2, bottom_y),
        (cx, mid_y),
        (cx + w/2, bottom_y),
        (cx + w, top_y),
    ]

    for i in range(len(points) - 1):
        draw.line([points[i], points[i+1]], fill=color, width=stroke_width)

def draw_s_letter(draw, center, size, color, stroke_width):
    """Draw a simplified S letter."""
    cx, cy = center
    h = size * 0.35
    w = size * 0.2

    # Simplified S as connected arcs
    # Top curve
    draw.arc(
        [cx - w, cy - h, cx + w, cy],
        start=180, end=0,
        fill=color, width=stroke_width
    )
    # Bottom curve
    draw.arc(
        [cx - w, cy - h*0.1, cx + w, cy + h*0.9],
        start=0, end=180,
        fill=color, width=stroke_width
    )

def create_main_icon(size):
    """Create the main WebSuddhi icon with shield and WS letters."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = (size // 2, size // 2)
    padding = max(1, size // 16)
    radius = size // 2 - padding

    # Colors
    blue_light = (14, 165, 233)   # #0ea5e9
    blue_dark = (3, 105, 161)     # #0369a1
    white = (255, 255, 255)
    green = (34, 197, 94)         # #22c55e

    # Background circle with gradient effect
    for i in range(radius, 0, -1):
        ratio = i / radius
        r = int(blue_light[0] * ratio + blue_dark[0] * (1 - ratio))
        g = int(blue_light[1] * ratio + blue_dark[1] * (1 - ratio))
        b = int(blue_light[2] * ratio + blue_dark[2] * (1 - ratio))
        draw.ellipse(
            [center[0] - i, center[1] - i, center[0] + i, center[1] + i],
            fill=(r, g, b, 255)
        )

    # Shield
    shield_size = radius * 0.85
    draw_shield(draw, center, shield_size, white)

    # Draw W and S letters or checkmark based on size
    stroke_width = max(1, size // 10)

    if size >= 32:
        # Draw WS letters for larger icons
        # W
        w_center = (center[0] - shield_size * 0.15, center[1])
        draw_w_letter(draw, w_center, shield_size * 0.6, blue_dark, stroke_width)

        # S (simplified for pixel art)
        if size >= 48:
            s_center = (center[0] + shield_size * 0.25, center[1])
            # Simple S shape
            s_size = shield_size * 0.4
            top = center[1] - s_size * 0.4
            mid = center[1]
            bottom = center[1] + s_size * 0.4
            left = s_center[0] - s_size * 0.3
            right = s_center[0] + s_size * 0.3

            draw.line([(right, top), (left, top)], fill=blue_dark, width=stroke_width)
            draw.line([(left, top), (left, mid)], fill=blue_dark, width=stroke_width)
            draw.line([(left, mid), (right, mid)], fill=blue_dark, width=stroke_width)
            draw.line([(right, mid), (right, bottom)], fill=blue_dark, width=stroke_width)
            draw.line([(right, bottom), (left, bottom)], fill=blue_dark, width=stroke_width)
    else:
        # Draw checkmark for very small icons (16x16)
        check_center = (center[0], center[1] + shield_size * 0.05)
        check_size = shield_size * 0.5
        draw_checkmark(draw, check_center, check_size, green, stroke_width)

    return img

def create_enhanced_icon(size):
    """Create an enhanced modern icon with better gradients."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    center = (size // 2, size // 2)
    padding = max(1, size // 16)
    radius = size // 2 - padding

    # Colors
    blue_light = (14, 165, 233)   # #0ea5e9
    blue_mid = (2, 132, 199)      # #0284c7
    blue_dark = (3, 105, 161)     # #0369a1
    white = (255, 255, 255)
    green = (34, 197, 94)         # #22c55e

    # Background circle with smooth gradient
    for i in range(radius, 0, -1):
        ratio = i / radius
        # Three-color gradient
        if ratio > 0.5:
            sub_ratio = (ratio - 0.5) * 2
            r = int(blue_light[0] * sub_ratio + blue_mid[0] * (1 - sub_ratio))
            g = int(blue_light[1] * sub_ratio + blue_mid[1] * (1 - sub_ratio))
            b = int(blue_light[2] * sub_ratio + blue_mid[2] * (1 - sub_ratio))
        else:
            sub_ratio = ratio * 2
            r = int(blue_mid[0] * sub_ratio + blue_dark[0] * (1 - sub_ratio))
            g = int(blue_mid[1] * sub_ratio + blue_dark[1] * (1 - sub_ratio))
            b = int(blue_mid[2] * sub_ratio + blue_dark[2] * (1 - sub_ratio))

        draw.ellipse(
            [center[0] - i, center[1] - i, center[0] + i, center[1] + i],
            fill=(r, g, b, 255)
        )

    # Shield with slight gradient
    shield_size = radius * 0.85
    draw_shield(draw, center, shield_size, white)

    # Inner shield border for depth
    inner_shield_size = shield_size * 0.92
    draw_shield(draw, center, inner_shield_size, None, (blue_light[0], blue_light[1], blue_light[2], 60), 1)

    # Checkmark centered in shield
    check_center = (center[0], center[1] + shield_size * 0.05)
    check_size = shield_size * 0.55
    stroke_width = max(2, int(size * 0.08))
    draw_checkmark(draw, check_center, check_size, green, stroke_width)

    return img

def main():
    # Get the directory of this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(script_dir, 'icons')

    # Ensure icons directory exists
    os.makedirs(icons_dir, exist_ok=True)

    sizes = [16, 32, 48, 128]

    print("WebSuddhi Icon Generator")
    print("=" * 40)

    # Generate alert icons
    print("\nGenerating alert icons...")
    for size in sizes:
        icon = create_alert_icon(size)
        path = os.path.join(icons_dir, f'icon{size}-alert.png')
        icon.save(path)
        print(f"  Created: icon{size}-alert.png")

    # Generate main icons (optional - uncomment if you want to regenerate)
    # print("\nGenerating main icons...")
    # for size in sizes:
    #     icon = create_main_icon(size)
    #     path = os.path.join(icons_dir, f'icon{size}.png')
    #     icon.save(path)
    #     print(f"  Created: icon{size}.png")

    # Generate enhanced icons
    print("\nGenerating enhanced icons...")
    for size in sizes:
        icon = create_enhanced_icon(size)
        path = os.path.join(icons_dir, f'icon{size}-enhanced.png')
        icon.save(path)
        print(f"  Created: icon{size}-enhanced.png")

    print("\n" + "=" * 40)
    print("Icon generation complete!")
    print("\nTo use the new icons:")
    print("1. Alert icons are ready at icons/icon*-alert.png")
    print("2. Enhanced icons are at icons/icon*-enhanced.png")
    print("3. To use enhanced as main icons, rename them to icon*.png")

if __name__ == '__main__':
    main()
