#!/usr/bin/env python3

"""
Generate LAMA app icon
Creates a colorful LAMA text logo as PNG
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Create 1024x1024 image with dark background
size = 1024
img = Image.new('RGBA', (size, size), (10, 10, 10, 255))
draw = ImageDraw.Draw(img)

# Add subtle circle background
center = size // 2
radius = 450
draw.ellipse(
    [center - radius, center - radius, center + radius, center + radius],
    fill=(20, 20, 20, 255),
    outline=(40, 40, 40, 255),
    width=2
)

# LAMA letters with colors
letters = [
    ('L', '#ef4444'),  # Red
    ('A', '#eab308'),  # Yellow
    ('M', '#22c55e'),  # Green
    ('A', '#a855f7')   # Purple
]

# Try to use a nice font, fallback to default if not available
try:
    # Try system fonts
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 280)
except:
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Avenir.ttc', 280)
    except:
        # Use default font but smaller
        font = ImageFont.load_default()

# Calculate positions for centered letters
letter_spacing = 200
total_width = letter_spacing * (len(letters) - 1)
start_x = center - total_width // 2
y_pos = center - 20  # Slightly offset up

# Draw each letter
for i, (letter, color) in enumerate(letters):
    x = start_x + i * letter_spacing
    
    # Draw shadow
    draw.text((x + 4, y_pos + 4), letter, fill=(0, 0, 0, 128), font=font, anchor='mm')
    
    # Draw letter
    # Convert hex to RGB
    r = int(color[1:3], 16)
    g = int(color[3:5], 16)
    b = int(color[5:7], 16)
    draw.text((x, y_pos), letter, fill=(r, g, b, 255), font=font, anchor='mm')

# Save the icon
output_dir = os.path.join(os.path.dirname(__file__), 'icons')
os.makedirs(output_dir, exist_ok=True)

# Save main icon
icon_path = os.path.join(output_dir, 'icon.png')
img.save(icon_path, 'PNG')

# Create different sizes
sizes = [16, 32, 64, 128, 256, 512]
for icon_size in sizes:
    resized = img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(output_dir, f'icon-{icon_size}.png'), 'PNG')

print(f'Icons generated successfully in {output_dir}')