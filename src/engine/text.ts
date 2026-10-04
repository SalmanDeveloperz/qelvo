// Inline text: markup → styled pieces → lines → drawable items.
//
// Two line-breaking models, because the originals use two different engines:
//   • "plain" (ReportLab): fixed interword space, greedy first-fit.
//   • "tex" (pdfTeX \raggedright): TFM interword glue with shrink, extra space
//     after sentence punctuation, and Knuth–Plass optimal breaking: so lines
//     break, shrink and end exactly where LaTeX puts them.
import { parseInline, typo } from "../model/inline";
import type { FontBook, FontKey, Shaping } from "./fonts";
import type { IconKind, Item, RGB } from "./types";

export interface Family {
  regular: FontKey;
  bold: FontKey;
  italic: FontKey;
  boldItalic: FontKey;
}

export interface PieceStyle {
  font: FontKey;
  size: number;
  color: RGB;
  url?: string;
  underline?: boolean;
  src?: string;
  /** Override the interword space (em): TeX templates only. */
  space?: number;
}

export interface TextPiece { k: "text"; text: string; style: PieceStyle }
export interface IconPiece {
  k: "icon";
  icon: IconKind;
  size: number;
  /** Horizontal gap before the icon. */
  gap: number;
  /** Icon bottom relative to the baseline (positive = below). */
  drop: number;
  color: RGB;
  url?: string;
  /** Advance width (defaults to size). */
  width?: number;
}
/** Fixed horizontal space (TeX glue). Breakable gaps behave like an interword space. */
export interface GapPiece { k: "gap"; width: number; breakable?: boolean }
export type Piece = TextPiece | IconPiece | GapPiece;

interface Atom {
  pieces: Piece[];
  widths: number[];
  width: number;
  space: boolean;
  /** Shrinkability of a space atom (TeX). */
  shrink: number;
}

export interface Line {
  atoms: Atom[];
  width: number;
  /** TeX glue-set ratio: how much of each space's shrink is used (0..1). */
  shrinkRatio: number;
}

export interface Underline {
  offset: number;
  width: number;
}

/** TFM fontdimens 2/4/7 (space, shrink, extra space) in em, for the Computer/Latin Modern faces. */
const TFM: Partial<Record<FontKey, [number, number, number]>> = {
  "lm9-rm": [0.342857, 0.114286, 0.114286],
  "lm9-bx": [0.394444, 0.131481, 0.131481],
  "lm9-it": [0.365118, 0.121706, 0.121706],
  "lm10-rm": [0.333333, 0.111111, 0.111111],
  "lm10-bx": [0.383333, 0.127778, 0.127778],
  "lm10-it": [0.357776, 0.119259, 0.119259],
  "lm10-bi": [0.413889, 0.137963, 0.137963],
  "lm12-rm": [0.326388, 0.108796, 0.108796],
  "lm12-bx": [0.375, 0.125, 0.125],
  // Source Sans Pro (autoinst TFMs): space 0.2em, shrink a third of it, small extra after colons.
  "ssp-rm": [0.2, 0.0667, 0.0333],
  "ssp-it": [0.2, 0.0667, 0.0333],
  "ssp-bx": [0.2, 0.0667, 0.0333],
  "ssp-bi": [0.2, 0.0667, 0.0333],
  "ssp-sb": [0.2, 0.0667, 0.0333],
};

/** TeX \sfcode: space factor set by the character that ends a word. */
function spaceFactor(prevText: string): number {
  const t = prevText.replace(/[)"'’”\]]+$/, "");
  const c = t[t.length - 1] ?? "";
  const before = t[t.length - 2] ?? "";
  const s = c === "." || c === "?" || c === "!" ? 3000 : c === ":" ? 2000 : c === ";" ? 1500 : c === "," ? 1250 : 1000;
  // After an uppercase letter (sfcode 999) a period doesn't end a sentence ("CI. ").
  if (s > 1000 && /[A-Z]/.test(before)) return 1000;
  return s;
}

export class Typesetter {
  constructor(public book: FontBook, public shaping: Shaping) {}

  get tex() {
    return this.shaping === "tex" || this.shaping === "texsc" || this.shaping === "texnk";
  }

  /** Markup ("**bold** and [link](url)") → pieces in a font family. */
  runs(markup: string, fam: Family, size: number, color: RGB, extra: Partial<PieceStyle> = {}, forceBold = false, forceItalic = false): TextPiece[] {
    return parseInline(typo(markup)).map((r) => {
      const b = r.bold || forceBold;
      const i = r.italic || forceItalic;
      const font = b && i ? fam.boldItalic : b ? fam.bold : i ? fam.italic : fam.regular;
      return { k: "text", text: this.clean(font, r.text), style: { font, size, color, ...extra, url: r.url || extra.url } };
    });
  }

  plain(text: string, font: FontKey, size: number, color: RGB, extra: Partial<PieceStyle> = {}): TextPiece {
    return { k: "text", text: this.clean(font, typo(text)), style: { font, size, color, ...extra } };
  }

  /** Replace characters the face can't draw (emoji, CJK…) instead of failing the whole PDF. */
  private clean(font: FontKey, text: string): string {
    return this.book.clean(font, text);
  }

  measure(p: Piece): number {
    if (p.k === "icon") return p.gap + (p.width ?? p.size);
    if (p.k === "gap") return p.width;
    return this.book.width(p.style.font, p.text, p.style.size, this.shaping);
  }

  width(pieces: Piece[]): number {
    return pieces.reduce((s, p) => s + this.measure(p), 0);
  }

  private glue(style: PieceStyle): [number, number, number] {
    const g = TFM[style.font] ?? [0.333333, 0.111111, 0.111111];
    return style.space !== undefined ? [style.space, g[1], g[2]] : g;
  }

  private atoms(pieces: Piece[]): Atom[] {
    const atoms: Atom[] = [];
    let cur: Atom | null = null;
    let lastText = "";
    const word = (p: Piece) => {
      if (!cur) { cur = { pieces: [], widths: [], width: 0, space: false, shrink: 0 }; atoms.push(cur); }
      const w = this.measure(p);
      cur.pieces.push(p);
      cur.widths.push(w);
      cur.width += w;
      if (p.k === "text") lastText = p.text;
    };
    const space = (p: Piece) => {
      cur = null;
      let w = this.measure(p);
      let shrink = 0;
      if (p.k === "text" && this.tex) {
        // One interword glue per run of spaces, sized by TeX's rules.
        const [sp, sh, ex] = this.glue(p.style);
        const sf = spaceFactor(lastText);
        w = (sp + (sf >= 2000 ? ex : 0)) * p.style.size;
        shrink = (sh * p.style.size * 1000) / sf;
      }
      const last = atoms[atoms.length - 1];
      if (last?.space) {
        if (!this.tex || p.k !== "text") { last.pieces.push(p); last.widths.push(w); last.width += w; }
        return;
      }
      atoms.push({ pieces: [p], widths: [w], width: w, space: true, shrink });
    };
    for (const p of pieces) {
      if (p.k === "gap") {
        if (p.breakable) space(p);
        else { const last = atoms[atoms.length - 1]; if (last && !last.space) cur = last; word(p); }
        continue;
      }
      if (p.k === "icon") {
        // Icons glue to the preceding word so they never orphan onto a new line.
        const last = atoms[atoms.length - 1];
        if (last && !last.space) cur = last;
        word(p);
        continue;
      }
      for (const part of p.text.split(/( +)/)) {
        if (!part) continue;
        const piece: TextPiece = { k: "text", text: part, style: p.style };
        if (part.startsWith(" ")) space(piece);
        else word(piece);
      }
    }
    return atoms;
  }

  wrap(pieces: Piece[], maxWidth: number, firstLineWidth = maxWidth): Line[] {
    const raw = this.atoms(pieces);
    // Pre-split words that can never fit (long URLs).
    const atoms: Atom[] = [];
    for (const a of raw) atoms.push(...(a.space ? [a] : this.splitLong(a, Math.min(maxWidth, firstLineWidth))));
    while (atoms.length && atoms[0].space) atoms.shift();
    while (atoms.length && atoms[atoms.length - 1].space) atoms.pop();
    if (!atoms.length) return [];
    return this.tex ? this.knuthPlass(atoms, maxWidth, firstLineWidth) : this.greedy(atoms, maxWidth, firstLineWidth);
  }

  /** Greedy first-fit: what ReportLab does. */
  private greedy(atoms: Atom[], maxWidth: number, firstLineWidth: number): Line[] {
    const lines: Line[] = [];
    let cur: Atom[] = [];
    let w = 0;
    let space: Atom | null = null;
    const limit = () => (lines.length === 0 ? firstLineWidth : maxWidth) + 0.01;
    for (const a of atoms) {
      if (a.space) { if (cur.length) space = a; continue; }
      if (cur.length && w + (space?.width ?? 0) + a.width > limit()) {
        lines.push({ atoms: cur, width: w, shrinkRatio: 0 });
        cur = []; w = 0; space = null;
      }
      if (cur.length && space) { cur.push(space); w += space.width; }
      cur.push(a);
      w += a.width;
      space = null;
    }
    if (cur.length) lines.push({ atoms: cur, width: w, shrinkRatio: 0 });
    return lines;
  }

  /**
   * Knuth–Plass with \rightskip = 0pt plus 1fil: any line at or under the
   * measure has badness 0; overfull lines may shrink their glue (badness
   * 100·r³). Demerits (10 + b)². Ties go to the later breakpoint, as in TeX.
   */
  private knuthPlass(atoms: Atom[], maxWidth: number, firstLineWidth: number): Line[] {
    const boxes: Atom[] = [];
    const glues: (Atom | null)[] = [];
    for (const a of atoms) {
      if (a.space) { glues[boxes.length] = a; continue; }
      if (glues.length < boxes.length + 1) glues[boxes.length] = null;
      boxes.push(a);
    }
    const n = boxes.length;
    const best = new Array<number>(n + 1).fill(Infinity);
    const from = new Array<number>(n + 1).fill(-1);
    const ratio = new Array<number>(n + 1).fill(0);
    best[0] = 0;
    for (let j = 1; j <= n; j++) {
      // Line = boxes[i..j-1]
      let nat = 0;
      let shr = 0;
      for (let i = j - 1; i >= 0; i--) {
        nat += boxes[i].width;
        if (i < j - 1) { const g = glues[i + 1]; if (g) { nat += g.width; shr += g.shrink; } }
        const L = (i === 0 ? firstLineWidth : maxWidth) + 0.005;
        let b = 0;
        let r = 0;
        if (nat > L) {
          if (shr <= 0 || nat - shr > L) {
            if (i === j - 1) { b = 10000; } // a lone overfull box: accept, nothing else to do
            else break;
          } else {
            r = (nat - L) / shr;
            b = Math.round(100 * r * r * r);
          }
        }
        if (best[i] === Infinity) continue;
        const d = best[i] + (10 + b) * (10 + b);
        if (d < best[j]) { best[j] = d; from[j] = i; ratio[j] = r; }
      }
    }
    const lines: Line[] = [];
    for (let j = n; j > 0; j = from[j]) {
      const i = from[j];
      const la: Atom[] = [];
      let w = 0;
      for (let k = i; k < j; k++) {
        if (k > i && glues[k]) { la.push(glues[k]!); w += glues[k]!.width - glues[k]!.shrink * ratio[j]; }
        la.push(boxes[k]);
        w += boxes[k].width;
      }
      lines.unshift({ atoms: la, width: w, shrinkRatio: ratio[j] });
      if (i <= 0) break;
    }
    return lines;
  }

  /** A single word wider than the line (long URLs) gets broken by character. */
  private splitLong(a: Atom, max: number): Atom[] {
    if (a.width <= max || a.pieces.length !== 1 || a.pieces[0].k !== "text") return [a];
    const p = a.pieces[0];
    const out: Atom[] = [];
    let buf = "";
    const push = (t: string) => {
      const piece: TextPiece = { k: "text", text: t, style: p.style };
      const w = this.measure(piece);
      out.push({ pieces: [piece], widths: [w], width: w, space: false, shrink: 0 });
    };
    for (const ch of p.text) {
      if (buf && this.book.width(p.style.font, buf + ch, p.style.size, this.shaping) > max) { push(buf); buf = ch; }
      else buf += ch;
    }
    if (buf) push(buf);
    return out;
  }

  /** Single line, no wrapping. */
  line(pieces: Piece[]): Line {
    const atoms = this.atoms(pieces);
    return { atoms, width: atoms.reduce((s, a) => s + a.width, 0), shrinkRatio: 0 };
  }

  /** Draw a line at (x, baseline). Adjacent same-style text is merged so extracted text reads naturally (ATS). */
  emit(line: Line, x: number, baseline: number, out: Item[], ul?: Underline): void {
    let cx = x;
    type Pending = { x: number; text: string; style: PieceStyle };
    let pending = null as Pending | null;
    const flush = () => {
      if (!pending) return;
      out.push({ t: "text", x: pending.x, y: baseline, text: pending.text, font: pending.style.font, size: pending.style.size, color: pending.style.color, shaping: this.shaping, src: pending.style.src });
      pending = null;
    };
    const same = (a: PieceStyle, b: PieceStyle) => a.font === b.font && a.size === b.size && a.color === b.color && a.src === b.src && a.url === b.url && !!a.underline === !!b.underline;
    for (const atom of line.atoms) {
      if (atom.space && this.tex) {
        // TeX glue isn't the space glyph: end the run with a real space (so extracted text keeps
        // word boundaries for ATS parsers) and position the next word exactly.
        if (pending) pending.text += " ";
        flush();
        cx += atom.width - atom.shrink * line.shrinkRatio;
        continue;
      }
      atom.pieces.forEach((p, i) => {
        const w = atom.widths[i];
        if (p.k === "gap") {
          flush();
        } else if (p.k === "icon") {
          flush();
          const ix = cx + p.gap;
          const iw = p.width ?? p.size;
          out.push({ t: "icon", kind: p.icon, x: ix, top: baseline + p.drop - p.size, size: p.size, color: p.color });
          if (p.url) out.push({ t: "link", x: ix - 1, top: baseline + p.drop - p.size - 1, w: iw + 2 - p.gap, h: p.size + 2, url: p.url });
        } else {
          const st = p.style;
          if (pending && same(pending.style, st)) pending.text += p.text;
          else { flush(); pending = { x: cx, text: p.text, style: st }; }
          if (p.text.trim()) {
            if (st.url) out.push({ t: "link", x: cx, top: baseline - st.size * 0.82, w, h: st.size * 1.08, url: st.url });
            if (st.underline && ul) out.push({ t: "rule", x1: cx, x2: cx + w, y: baseline + ul.offset, width: ul.width, color: st.color });
          }
        }
        cx += w;
      });
    }
    flush();
  }
}
