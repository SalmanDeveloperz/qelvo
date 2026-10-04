import fontkit from "@pdf-lib/fontkit";

// Every face the three templates use. TeX faces are Latin Modern (metric-
// compatible with Computer Modern) at the optical sizes LaTeX picks: 9, 10
// and 12pt designs are genuinely different drawings. Poppins is the exact
// family ReportLab embedded in the modern original.
export const FONT_FILES = {
  "pop-light": "poppins/Poppins-Light.ttf",
  "pop-regular": "poppins/Poppins-Regular.ttf",
  "pop-italic": "poppins/Poppins-Italic.ttf",
  "pop-medium": "poppins/Poppins-Medium.ttf",
  "pop-semibold": "poppins/Poppins-SemiBold.ttf",
  "pop-bold": "poppins/Poppins-Bold.ttf",
  "lm9-rm": "lm/lmroman9-regular.ttf",
  "lm9-bx": "lm/lmroman9-bold.ttf",
  "lm9-it": "lm/lmroman9-italic.ttf",
  "lm10-rm": "lm/lmroman10-regular.ttf",
  "lm10-bx": "lm/lmroman10-bold.ttf",
  "lm10-it": "lm/lmroman10-italic.ttf",
  "lm10-bi": "lm/lmroman10-bolditalic.ttf",
  "lm12-rm": "lm/lmroman12-regular.ttf",
  "lm12-bx": "lm/lmroman12-bold.ttf",
  "ssp-rm": "ssp/SourceSansPro-Regular.ttf",
  "ssp-it": "ssp/SourceSansPro-It.ttf",
  "ssp-bx": "ssp/SourceSansPro-Bold.ttf",
  "ssp-bi": "ssp/SourceSansPro-BoldIt.ttf",
  "ssp-sb": "ssp/SourceSansPro-Semibold.ttf",
} as const;

export type FontKey = keyof typeof FONT_FILES;

/** "tex" = kerning + ligatures (what pdfTeX does); "plain" = neither (what ReportLab does). */
/** "texsc" = TeX shaping with real small caps (OpenType smcp), for 	extsc headings. */
export type Shaping = "tex" | "texsc" | "texnk" | "plain";

export const SHAPING: Record<Shaping, Record<string, boolean>> = {
  tex: { kern: true, liga: true },
  plain: { kern: false, liga: false },
  texsc: { kern: true, liga: false, smcp: true },
  /**
   * TeX glue and breaking without kerning (Source Sans Pro's TFMs carry none). No ligatures
   * either: Source Sans has an "ft" ligature with no Unicode mapping, which would make
   * "Software" extract as "Soġware" for applicant-tracking systems.
   */
  texnk: { kern: false, liga: false },
};

const FALLBACK: Record<string, string> = {
  "→": "->", "←": "<-", "➔": "->", "✓": "", "✔": "", "●": "•", "▪": "•",
  "‣": "•", "·": "•", "−": "-", "‑": "-", " ": " ", " ": " ", " ": " ",
};

export type FontLoader = (path: string) => Promise<Uint8Array>;

interface Face {
  bytes: Uint8Array;
  // fontkit's Font type isn't exported in a useful way; we only touch layout()/unitsPerEm.
  fk: any;
  upm: number;
  widths: Record<Shaping, Map<string, number>>;
}

export class FontBook {
  private faces = new Map<FontKey, Face>();
  private pending = new Map<FontKey, Promise<void>>();
  constructor(private loader: FontLoader) {}

  async load(keys: readonly FontKey[]): Promise<void> {
    await Promise.all(keys.map((k) => this.loadOne(k)));
  }

  private loadOne(key: FontKey): Promise<void> {
    if (this.faces.has(key)) return Promise.resolve();
    let p = this.pending.get(key);
    if (!p) {
      p = this.loader(FONT_FILES[key]).then((bytes) => {
        const fk = fontkit.create(bytes as any) as any;
        this.faces.set(key, { bytes, fk, upm: fk.unitsPerEm, widths: { tex: new Map(), texsc: new Map(), texnk: new Map(), plain: new Map() } });
      });
      this.pending.set(key, p);
    }
    return p;
  }

  has(key: FontKey) {
    return this.faces.has(key);
  }

  bytes(key: FontKey): Uint8Array {
    return this.face(key).bytes;
  }

  private face(key: FontKey): Face {
    const f = this.faces.get(key);
    if (!f) throw new Error(`Font ${key} not loaded`);
    return f;
  }

  /** Advance width in points, using the same shaping the PDF writer will use. */
  width(key: FontKey, text: string, size: number, shaping: Shaping): number {
    if (!text) return 0;
    const f = this.face(key);
    const cache = f.widths[shaping];
    let w = cache.get(text);
    if (w === undefined) {
      w = f.fk.layout(text, SHAPING[shaping]).advanceWidth as number;
      if (cache.size > 20000) cache.clear();
      cache.set(text, w);
    }
    return (w / f.upm) * size;
  }

  /**
   * Splits text into runs that can be drawn with plain glyph advances, plus the
   * x offset (in points) of each run: i.e. kerning expressed as positions.
   */
  kernedRuns(key: FontKey, text: string, size: number, shaping: Shaping): { text: string; dx: number }[] {
    if (shaping === "plain") return [{ text, dx: 0 }];
    const f = this.face(key);
    const run = f.fk.layout(text, SHAPING[shaping]);
    const out: { text: string; dx: number }[] = [];
    let x = 0;
    let cur = "";
    let curX = 0;
    for (let i = 0; i < run.glyphs.length; i++) {
      const g = run.glyphs[i];
      const pos = run.positions[i];
      const chars = String.fromCodePoint(...(g.codePoints as number[]));
      if (!cur) curX = x;
      cur += chars;
      x += pos.xAdvance;
      if (pos.xAdvance !== g.advanceWidth) {
        out.push({ text: cur, dx: (curX / f.upm) * size });
        cur = "";
      }
    }
    if (cur) out.push({ text: cur, dx: (curX / f.upm) * size });
    return out;
  }

  /** Swap characters the face has no glyph for: accents decompose, the rest become "?". */
  clean(key: FontKey, text: string): string {
    const f = this.face(key);
    let out = "";
    let changed = false;
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp < 0x80 || f.fk.hasGlyphForCodePoint(cp)) { out += ch; continue; }
      changed = true;
      const base = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      const fallback = FALLBACK[ch] ?? (base && [...base].every((c) => f.fk.hasGlyphForCodePoint(c.codePointAt(0)!)) ? base : "?");
      out += fallback;
    }
    return changed ? out : text;
  }

  ascent(key: FontKey): number {
    const f = this.face(key);
    return f.fk.ascent / f.upm;
  }
}
