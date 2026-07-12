"""Crop the Calendly screenshot down to the 'Created events / 217 / +200' card
so that metric sits centered and fills the tile (object-cover), instead of the
whole wide dashboard where 217 gets cropped off the left edge."""
from PIL import Image

img = Image.open("public/calendly-fit.png").convert("RGB")  # ~1429x516
# Focus on the top-left 'Created events' card + a little of the next card,
# in roughly the tile's landscape aspect so cover barely crops it.
crop = img.crop((0, 52, 384, 268))  # 384 x 216  (~1.78 aspect)
crop.save("public/calendly-metric.png")
print("saved public/calendly-metric.png", crop.size)
