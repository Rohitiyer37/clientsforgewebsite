"""Trim uniform (white or dark) borders from the proof screenshots so they
fit their tiles tightly. Detects the background from the top-left corner and
crops to the bounding box of everything that differs from it."""
from PIL import Image, ImageChops

FILES = [
    ("calendly.png", "calendly-fit.png"),
    ("stats2.png", "stats2-fit.png"),
    ("stats3.png", "stats3-fit.png"),
    ("stats4.png", "stats4-fit.png"),
    ("stats6.png", "stats6-fit.png"),
]

for src, out in FILES:
    img = Image.open(f"public/{src}").convert("RGB")
    bg_color = img.getpixel((0, 0))
    bg = Image.new("RGB", img.size, bg_color)
    diff = ImageChops.difference(img, bg)
    # Drop anything within ~40 levels of the background, then find the bbox.
    diff = ImageChops.add(diff, diff, 2.0, -40)
    bbox = diff.getbbox()
    if bbox:
        # small padding back so content isn't flush to the edge
        pad = 6
        left = max(0, bbox[0] - pad)
        top = max(0, bbox[1] - pad)
        right = min(img.width, bbox[2] + pad)
        bottom = min(img.height, bbox[3] + pad)
        img = img.crop((left, top, right, bottom))
    img.save(f"public/{out}")
    print(f"{src} {Image.open(f'public/{src}').size} -> {out} {img.size}")
