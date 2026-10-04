"""Rasterise first pages to WebP for the gallery: python scripts/thumbs.py <pdfDir> <outDir>
Prints {id: height/width} as JSON for scripts/thumbs.ts."""
import io, json, os, sys
import pymupdf
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
# Shown at 236-370 CSS px. The browser picks whichever width matches its screen density and
# zoom: 640 for 1x and the 2x gallery, 960 for a 2x hero, 1280/1920 for 3x screens or zooming in.
WIDTHS = (640, 960, 1280, 1920)
ratios = {}
for f in sorted(os.listdir(src)):
    if not f.endswith(".pdf"):
        continue
    tid = f[:-4]
    page = pymupdf.open(os.path.join(src, f))[0]
    ratios[tid] = round(page.rect.height / page.rect.width, 5)
    for w in WIDTHS:
        z = w / page.rect.width
        pix = page.get_pixmap(matrix=pymupdf.Matrix(z, z), alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        # Lossless, full colour: small text keeps its anti-aliasing, so it reads sharp. (A reduced
        # palette was smaller but stripped the edge greys and made text look soft.)
        img.save(os.path.join(dst, f"{tid}-{w}.webp"), "WEBP", lossless=True, quality=100, method=6)
print(json.dumps(ratios))
