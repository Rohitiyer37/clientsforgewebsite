"""Knock out the white background of the Clientsforge logo -> transparent trimmed PNG."""
from PIL import Image

SRC = "public/clientsforge logo.jpg"
OUT = "public/clientsforge-logo.png"

img = Image.open(SRC).convert("RGBA")
px = img.load()
w, h = img.size

for y in range(h):
    for x in range(w):
        r, g, b, _ = px[x, y]
        mn = min(r, g, b)
        mx = max(r, g, b)
        # Fully transparent for near-white pixels
        if r > 236 and g > 236 and b > 236:
            px[x, y] = (r, g, b, 0)
        # Feather the light anti-aliased edge between gold and white
        elif mn > 205 and (mx - mn) < 45:
            # closer to white -> more transparent
            alpha = int(max(0, min(255, (236 - mn) * 8)))
            px[x, y] = (r, g, b, alpha)
        else:
            px[x, y] = (r, g, b, 255)

# Trim transparent border
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

# Downscale to a sensible asset size (keeps file small, still crisp at 2x)
max_w = 480
if img.width > max_w:
    ratio = max_w / img.width
    img = img.resize((max_w, int(img.height * ratio)), Image.LANCZOS)

img.save(OUT)
print(f"Saved {OUT}  size={img.size}")
