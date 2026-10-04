"""Rasterise first pages to WebP for the gallery: python scripts/thumbs.py <pdfDir> <outDir>
Prints {id: height/width} as JSON for scripts/thumbs.ts."""
import io, json, os, sys
import pymupdf
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
# 250-370 CSS px on screen: 500 covers 1x and the 2x gallery, 760 the 2x hero.
WIDTHS = (500, 760)
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
        # A resume page has a handful of colours: a 16-colour palette, stored losslessly, is
        # pixel-sharp and about a third the size of lossy WebP at the same width.
        img = img.quantize(16, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
        img.save(os.path.join(dst, f"{tid}-{w}.webp"), "WEBP", lossless=True, quality=100, method=6)
print(json.dumps(ratios))
