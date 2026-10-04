"""Rasterise the brand SVGs (run scripts/brand.ts first). Needs: pip install pymupdf"""
import pymupdf

JOBS = [
    # (svg, png, pixel width)
    ("brand/qelvo-icon-dark.svg", "brand/qelvo-icon-dark-1024.png", 1024),
    ("brand/qelvo-icon-light.svg", "brand/qelvo-icon-light-1024.png", 1024),
    ("brand/qelvo-avatar.svg", "brand/qelvo-avatar-800.png", 800),
    ("brand/qelvo-logo-dark.svg", "brand/qelvo-logo-dark.png", 1600),
    ("brand/qelvo-logo-light.svg", "brand/qelvo-logo-light.png", 1600),
    ("brand/qelvo-linkedin-banner.svg", "brand/qelvo-linkedin-banner.png", 1584),
    ("brand/qelvo-github-social.svg", "brand/qelvo-github-social.png", 1280),
    ("brand/qelvo-og.svg", "public/og.png", 1200),
    ("brand/qelvo-icon-dark.svg", "public/apple-touch-icon.png", 180),
]

for src, dst, width in JOBS:
    doc = pymupdf.open(src)
    page = doc[0]
    zoom = width / page.rect.width
    alpha = "logo" in src or "mark" in src
    page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=alpha).save(dst)
    print("wrote", dst)
