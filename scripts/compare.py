"""Line-by-line diff of a rendered PDF against an original.
usage: python scripts/compare.py original.pdf ours.pdf [overlay.png]
Reports, for every original line, the baseline/x/right-edge error of the matching line in ours."""
import sys, re, pymupdf
from difflib import SequenceMatcher

def lines(path):
    pg = pymupdf.open(path)[0]
    # Collect words, not decorations: skip icon-font glyphs, bullets and unmapped glyphs.
    chars = []
    for b in pg.get_text("rawdict")["blocks"]:
        if b["type"] != 0: continue
        for l in b["lines"]:
            for s in l["spans"]:
                if "Awesome" in s["font"] or "CMSY6" in s["font"]: continue
                for c in s["chars"]:
                    if c["c"].strip() and ord(c["c"]) < 0xE000 and c["c"] not in "\uFFFD\u2022":
                        chars.append(c)
    # Group by baseline ourselves (pymupdf splits lines differently around font changes),
    # then split at big gaps (right-aligned dates, the column gutter).
    rows = {}
    for c in chars:
        key = round(c["origin"][1] * 2) / 2
        k = next((r for r in rows if abs(r - key) <= 1.6), key)
        rows.setdefault(k, []).append(c)
    out = []
    for _, row in sorted(rows.items()):
        row.sort(key=lambda c: c["origin"][0])
        groups = [[row[0]]]
        for c in row[1:]:
            if c["origin"][0] - groups[-1][-1]["bbox"][2] > 14: groups.append([c])
            else: groups[-1].append(c)
        for g in groups:
            t = "".join(c["c"] for c in g)
            ys = sorted(c["origin"][1] for c in g)
            out.append(dict(t=t, n=re.sub(r"[^a-z0-9]", "", t.lower()), y=ys[len(ys) // 2], x=g[0]["origin"][0], r=g[-1]["bbox"][2]))
    return out

a, b = lines(sys.argv[1]), lines(sys.argv[2])
used = set(); worst = 0; rows = []
for la in a:
    best, bi = 0, -1
    for i, lb in enumerate(b):
        if i in used: continue
        s = SequenceMatcher(None, la["n"], lb["n"]).ratio() if la["n"] and lb["n"] else 0
        if s > best: best, bi = s, i
    if bi < 0 or best < 0.6:
        rows.append(f"  MISSING  {la['t'][:70]}"); continue
    used.add(bi); lb = b[bi]
    dy, dx, dr = lb["y"] - la["y"], lb["x"] - la["x"], lb["r"] - la["r"]
    worst = max(worst, abs(dy), abs(dx))
    flag = "  " if abs(dy) < 0.3 and abs(dx) < 0.3 and abs(dr) < 1.0 and best > 0.97 else "!!"
    rows.append(f"{flag} y{la['y']:7.2f} dy{dy:+6.2f} dx{dx:+6.2f} dr{dr:+6.2f} {'' if best>0.97 else f'~{best:.2f} '}| {la['t'][:60]}" + ("" if best > 0.97 else f"  <> {lb['t'][:60]}"))
for i, lb in enumerate(b):
    if i not in used: rows.append(f"  EXTRA    {lb['t'][:70]}")
print("\n".join(rows))
print(f"lines: orig={len(a)} ours={len(b)} worst|d|={worst:.2f}pt")
if len(sys.argv) > 3:
    A = pymupdf.open(sys.argv[1])[0].get_pixmap(dpi=110); B = pymupdf.open(sys.argv[2])[0].get_pixmap(dpi=110)
    import struct
    # red = original only, blue = ours only, black = both
    w, h = A.width, A.height
    out = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, w, h), False)
    sa, sb = A.samples, B.samples; na, nb = A.n, B.n
    buf = bytearray(w*h*3)
    for i in range(w*h):
        va = sa[i*na]; vb = sb[i*nb] if i*nb < len(sb) else 255
        da, db = va < 160, vb < 160
        buf[i*3:i*3+3] = (0,0,0) if da and db else (230,40,40) if da else (40,90,240) if db else (255,255,255)
    pymupdf.Pixmap(pymupdf.csRGB, w, h, bytes(buf), False).save(sys.argv[3])
