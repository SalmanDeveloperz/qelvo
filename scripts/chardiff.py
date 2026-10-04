"""Per-character x drift between original and ours for lines near a baseline: chardiff.py orig ours y [x0 x1]"""
import sys, pymupdf
def chars(p, y, x0, x1):
    pg = pymupdf.open(p)[0]; out = []
    for b in pg.get_text("rawdict")["blocks"]:
        if b["type"] != 0: continue
        for l in b["lines"]:
            for s in l["spans"]:
                for c in s["chars"]:
                    if abs(c["origin"][1] - y) < 1.5 and x0 <= c["origin"][0] <= x1 and c["c"].strip() and c["c"].isascii(): out.append((c["c"], c["origin"][0]))
    return sorted(out, key=lambda t: t[1])
y = float(sys.argv[3]); x0, x1 = (float(sys.argv[4]), float(sys.argv[5])) if len(sys.argv) > 5 else (0, 612)
a, b = chars(sys.argv[1], y, x0, x1), chars(sys.argv[2], y, x0, x1)
prev = None; out = []
for (ca, xa), (cb, xb) in zip(a, b):
    d = xb - xa
    if prev is None or abs(d - prev) > 0.05: out.append(f"{ca}{'' if ca == cb else '/' + cb}:{d:+.2f}")
    prev = d
print(" ".join(out)); print("n", len(a), len(b))
