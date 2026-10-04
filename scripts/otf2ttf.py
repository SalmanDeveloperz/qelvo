# Convert CFF-flavoured OpenType fonts to TrueType outlines (cu2qu) so they subset cleanly in pdf-lib.
import sys, glob, os
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen

def convert(src, dst, max_err=0.5):
    f = TTFont(src)
    gs = f.getGlyphSet()
    glyf = newTable("glyf"); glyf.glyphOrder = f.getGlyphOrder(); glyf.glyphs = {}
    for name in f.getGlyphOrder():
        pen = TTGlyphPen(gs)
        gs[name].draw(Cu2QuPen(pen, max_err, reverse_direction=True))
        glyf[name] = pen.glyph()
    f["glyf"] = glyf; f["loca"] = newTable("loca")
    m = newTable("maxp"); m.tableVersion = 0x00010000
    for k in ("maxZones","maxTwilightPoints","maxStorage","maxFunctionDefs","maxInstructionDefs","maxStackElements","maxSizeOfInstructions","maxComponentElements"):
        setattr(m, k, 0)
    m.maxZones = 1; m.maxComponentDepth = 0
    old = f["maxp"]; m.numGlyphs = old.numGlyphs
    f["maxp"] = m
    f["head"].glyphDataFormat = 0
    if "post" in f: f["post"].formatType = 2.0; f["post"].extraNames = []; f["post"].mapping = {}; f["post"].glyphOrder = f.getGlyphOrder()
    del f["CFF "]
    if "VORG" in f: del f["VORG"]
    f.sfntVersion = "\x00\x01\x00\x00"
    f.save(dst)

for src in sys.argv[1:]:
    dst = os.path.splitext(src)[0] + ".ttf"
    convert(src, dst); os.remove(src); print("->", dst, os.path.getsize(dst))
