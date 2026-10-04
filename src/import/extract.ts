// Layout-aware text extraction. Plain "copy text" from a resume PDF scrambles
// two-column layouts, detaches right-aligned dates and loses every link behind
// an icon. This rebuilds reading order and keeps the signals a parser needs.

export interface Seg {
  page: number;
  /** Column: 0 = full width / single column, 1 = left, 2 = right. */
  col: 0 | 1 | 2;
  x0: number;
  x1: number;
  /** Baseline, measured from the top of the page. */
  y: number;
  size: number;
  bold: boolean;
  italic: boolean;
  /** Text with **bold** marking for partially bold lines and ⟨link: …⟩ markers. */
  text: string;
  /** Plain text, no markers. */
  plain: string;
  links: string[];
  /** Right-aligned companion text on the same baseline (dates, locations). */
  right?: Seg;
}

export interface Extracted {
  segs: Seg[];
  pageWidth: number;
  pages: number;
  columns: boolean;
}

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  size: number;
  bold: boolean;
  italic: boolean;
  /** Links inside this run: insert a marker after character `at`. */
  cuts: { url: string; at: number }[];
}

/** Icon fonts draw pictures, not words. */
const ICON_FONT = /awesome|\bicons?\b|symbol|dingbat|wingding|material|glyph|octicon|devicon/i;

const ICONISH = /[-�\u0000-\u0008\u000B-\u001F]/g;

/** Anything with pdf.js's getDocument: the browser build, or the legacy build under Node (tests). */
export type PdfLib = { getDocument: (src: any) => { promise: Promise<any> } };

export async function extractPdf(data: ArrayBuffer, lib?: PdfLib): Promise<Extracted> {
  const pdfjs = lib ?? (await import("./pdfjs"));
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), fontExtraProperties: true }).promise;
  const segs: Seg[] = [];
  let pageWidth = 612;
  let anyColumns = false;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    pageWidth = vp.width;
    const H = vp.height;
    await page.getOperatorList(); // forces fonts to load so we can read their names
    const tc = await page.getTextContent();
    const annots = (await page.getAnnotations()).filter((a: any) => a.subtype === "Link" && (a.url || a.unsafeUrl));
    // pdf.js normalises "https://site.com" to "https://site.com/": keep the URL as the author wrote it.
    const links = annots.map((a: any) => ({ url: String(a.url || a.unsafeUrl).replace(/^(https?:\/\/[^/?#]+)\/$/, "$1"), x0: a.rect[0], x1: a.rect[2], top: H - a.rect[3], bot: H - a.rect[1] }));

    const items: Item[] = [];
    for (const it of tc.items as any[]) {
      if (!("str" in it)) continue;
      const str = String(it.str).replace(ICONISH, "");
      const [a, b, , , e, f] = it.transform as number[];
      const size = Math.hypot(a, b) || it.height || 10;
      if (!str.trim() && !(it.width > 0)) continue;
      let fname = "";
      try { fname = (page.commonObjs.get(it.fontName) as any)?.name ?? ""; } catch { /* font not resolved */ }
      const fam = `${fname} ${(tc.styles as any)[it.fontName]?.fontFamily ?? ""}`;
      if (ICON_FONT.test(fname)) continue;
      items.push({
        str, x: e, y: H - f, w: it.width, size,
        bold: /bold|black|heavy|semibold|demi|[-_+]bx|cmbx|lmbx/i.test(fam),
        italic: /italic|oblique|[-_+]ti\d|cmti|lmit/i.test(fam),
        cuts: [],
      });
    }
    // Attach link annotations to the exact words under them. One pdf.js run can hold several
    // fields ("phone  |  email  |  "), so the marker goes where the link's box ends inside the run.
    // A run belongs to a link only if its baseline sits inside the link's box.
    const onLine = (it: Item, l: (typeof links)[number]) => it.y >= l.top + (l.bot - l.top) * 0.3 && it.y <= l.bot + 2;
    for (const l of links) {
      let hit = false;
      for (const it of items) {
        if (!it.str.trim() || !onLine(it, l)) continue;
        const ox = Math.min(it.x + it.w, l.x1) - Math.max(it.x, l.x0);
        if (ox < Math.min(it.w, l.x1 - l.x0) * 0.5) continue;
        it.cuts.push({ url: l.url, at: cutAt(it, l.x1) });
        hit = true;
      }
      if (!hit) {
        // Icon-only link: attach to the nearest text to its left on the same line.
        const cands = items.filter((it) => onLine(it, l) && it.x < l.x0 + 2 && it.str.trim());
        cands.sort((u, v) => (v.x + v.w) - (u.x + u.w));
        if (cands[0]) cands[0].cuts.push({ url: l.url, at: cands[0].str.length });
      }
    }
    // Rows by baseline.
    items.sort((u, v) => u.y - v.y || u.x - v.x);
    const rows: Item[][] = [];
    for (const it of items) {
      const row = rows.find((r) => Math.abs(r[0].y - it.y) < Math.max(2, r[0].size * 0.3));
      if (row) row.push(it); else rows.push([it]);
    }
    const cleanRows = rows.map((raw) => {
      // Text drawn inside an icon (a LinkedIn badge's white "in") is decoration, not content.
      const big = Math.max(...raw.map((i) => i.size));
      // Whitespace-only runs (Google Docs/Word tab fills) hide real gaps: drop them; buildSeg
      // re-inserts word spaces from geometry.
      return raw.filter((i) => i.str.trim() && !(i.size < big * 0.6 && i.str.trim().length <= 3)).sort((u, v) => u.x - v.x);
    }).filter((r) => r.length);
    /** Split rows into segments at wide gaps: and, once known, at the column boundary. */
    const segment = (split: number | null, colTop = 0): Seg[] => {
      const out: Seg[] = [];
      for (const row of cleanRows) {
        // The header above the columns spans the full width: never split it at the gutter.
        const inCols = split !== null && row[0].y >= colTop - 1;
        let cur: Item[] = [];
        const flush = () => { if (cur.some((c) => c.str.trim())) out.push(buildSeg(cur, p)); cur = []; };
        for (const it of row) {
          const prev = cur[cur.length - 1];
          const gap = prev ? it.x - (prev.x + prev.w) : 0;
          const crosses = inCols && prev && prev.x + prev.w <= split! + 2 && it.x >= split! - 3;
          // A bullet glyph after a gap starts a new grid cell ("● Jira    ● Postman").
          const cell = prev && gap > prev.size * 0.8 && BULLET_GLYPH.test(it.str);
          if (prev && (gap > Math.max(18, prev.size * 2.4) || crosses || cell)) flush();
          cur.push(it);
        }
        flush();
      }
      return out;
    };
    let pageSegs = segment(null);
    const split = findColumnSplit(pageSegs, pageWidth);
    if (split) {
      anyColumns = true;
      pageSegs = segment(split, Math.min(...pageSegs.filter((s) => s.x0 >= split - 3).map((s) => s.y)));
      for (const s of pageSegs) s.col = s.x0 >= split - 3 ? 2 : s.x1 > split + 6 ? 0 : 1;
      // Full-width lines below the column area belong to the left flow.
      const colTop = Math.min(...pageSegs.filter((s) => s.col === 2).map((s) => s.y));
      for (const s of pageSegs) if (s.col === 0 && s.y > colTop) s.col = 1;
      const order = (s: Seg) => (s.col === 0 ? 0 : s.col);
      pageSegs.sort((u, v) => order(u) - order(v) || u.y - v.y || u.x0 - v.x0);
      segs.push(...pageSegs);
    } else {
      segs.push(...assembleSingleColumn(pageSegs));
    }
  }
  return { segs, pageWidth, pages: doc.numPages, columns: anyColumns };
}

const BULLET_GLYPH = /^\s*[•●▪◦○■□♦◆➢➤►▸✓✔❖⦿⁃∙]/;
const isBulletSeg = (s: Seg) => BULLET_GLYPH.test(s.plain);

/**
 * Single-column page: one row = one line, with right-aligned companions (dates,
 * places) attached. Bulleted grids (skills in 2–4 columns) are read column by
 * column, the way their author typed them.
 */
function assembleSingleColumn(pageSegs: Seg[]): Seg[] {
  pageSegs.sort((u, v) => u.y - v.y || u.x0 - v.x0);
  const rows: Seg[][] = [];
  for (const s of pageSegs) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(r[0].y - s.y) < Math.max(2, r[0].size * 0.35)) r.push(s);
    else rows.push([s]);
  }
  for (const r of rows) r.sort((u, v) => u.x0 - v.x0);
  const isGridRow = (r: Seg[]) => r.length >= 2 && r.every(isBulletSeg);
  const out: Seg[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (isGridRow(rows[i])) {
      // Collect the run of grid rows; a short last row (one item) still belongs to it.
      const run: Seg[][] = [rows[i]];
      const cols = rows[i].map((s) => s.x0);
      while (i + 1 < rows.length) {
        const n = rows[i + 1];
        const aligned = n.every((s) => isBulletSeg(s) && cols.some((x) => Math.abs(x - s.x0) < 14));
        if (!aligned) break;
        run.push(n);
        for (const s of n) if (!cols.some((x) => Math.abs(x - s.x0) < 14)) cols.push(s.x0);
        i++;
      }
      cols.sort((a, b) => a - b);
      for (const cx of cols) for (const r of run) for (const s of r) if (Math.abs(s.x0 - cx) < 14) out.push(s);
      continue;
    }
    const [first, ...rest] = rows[i];
    if (rest.length) {
      // Companions on the same baseline: "Role ............ Jan 2020 – Present".
      const right = rest.reduce((a, b) => ({ ...a, text: `${a.text} ${b.text}`, plain: `${a.plain} ${b.plain}`, x1: b.x1, links: [...a.links, ...b.links] }));
      first.right = right;
    }
    out.push(first);
  }
  return out;
}

/** Character index inside a run where x falls, snapped to the end of a word. */
function cutAt(it: Item, x: number): number {
  const n = it.str.length;
  if (x >= it.x + it.w - 1) return n;
  const est = Math.round((n * (x - it.x)) / Math.max(1, it.w));
  for (let d = 0; d < 14; d++) {
    // A word end: never just after a separator like "|", which pdf.js may have shifted.
    for (const k of [est + d, est - d]) if (k > 0 && k < n && /[^\s|•·]/.test(it.str[k - 1]) && /\s/.test(it.str[k])) return k;
  }
  return Math.max(0, Math.min(n, est));
}

function buildSeg(items: Item[], page: number): Seg {
  let text = "";
  let plain = "";
  const links: string[] = [];
  const allBold = items.filter((i) => i.str.trim()).every((i) => i.bold);
  let inBold = false;
  items.forEach((it, i) => {
    const prev = items[i - 1];
    if (prev) {
      const gap = it.x - (prev.x + prev.w);
      if (gap > it.size * 0.12 && !/\s$/.test(plain) && !/^\s/.test(it.str)) { text += " "; plain += " "; }
    }
    const markBold = !allBold && it.bold && it.str.trim();
    if (markBold && !inBold) { text += "**"; inBold = true; }
    // Close the bold run before any space we just added: "PHP**. I have", "PHP** in".
    if (!markBold && inBold && it.str.trim()) { text = text.replace(/(\s*)$/, "**$1"); inBold = false; }
    let piece = it.str;
    const next = items[i + 1];
    for (const c of [...it.cuts].sort((a, b) => b.at - a.at)) {
      if (!links.includes(c.url)) links.push(c.url);
      // Same link continuing into the next run: mark it there instead.
      if (c.at >= it.str.length && next?.cuts.some((n) => n.url === c.url)) continue;
      piece = `${piece.slice(0, c.at)} ⟨link: ${c.url}⟩${piece.slice(c.at)}`;
    }
    text += piece;
    plain += it.str;
  });
  if (inBold) text += "**";
  const sizes = items.filter((i) => i.str.trim()).map((i) => i.size);
  return {
    page,
    col: 0,
    x0: items[0].x,
    x1: Math.max(...items.map((i) => i.x + i.w)),
    y: items[0].y,
    size: Math.max(...sizes),
    bold: allBold,
    italic: items.filter((i) => i.str.trim()).every((i) => i.italic),
    text: unspace(ligatures(text).replace(/\s+/g, " ").trim()),
    plain: unspace(ligatures(plain).replace(/\s+/g, " ").trim()),
    links,
  };
}

/** Typographic ligatures (ﬁ ﬂ ﬀ ﬃ ﬄ ﬅ ﬆ) back to letters: "CERTIﬁCATIONS" must match "Certifications". */
const LIG: Record<string, string> = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st" };
const ligatures = (t: string) =>
  t
    // pdf.js may already have expanded the ligature, in lowercase: "CERTIfiCATIONS".
    .replace(/(?<=\p{Lu})(ffi|ffl|ff|fi|fl)(?=\p{Lu})/gu, (m) => m.toUpperCase())
    .replace(/[ﬀ-ﬆ]/g, (c, i: number) => {
    const s = LIG[c] ?? c;
    // Inside an all-caps word ("CERTIﬁCATIONS") the letters are capitals too.
    return /\p{Lu}/u.test(t[i - 1] ?? "") && /\p{Lu}|$/u.test(t[i + 1] ?? "") ? s.toUpperCase() : s;
  });

/** "L a h o r e , P a k i s t a n" → "Lahore, Pakistan" (letter-spaced headers). */
export function unspace(t: string): string {
  const tok = t.split(" ");
  const out: string[] = [];
  for (let i = 0; i < tok.length; ) {
    let j = i;
    while (j < tok.length && /^[\p{L}\p{N}][,.;:&]?$/u.test(tok[j])) j++;
    if (j - i >= 4) {
      out.push(tok.slice(i, j).map((w) => (/[,.;:]$/.test(w) ? w + " " : w)).join("").trim());
      i = j;
    } else out.push(tok[i++]);
  }
  return out.join(" ");
}

/** A two-column page has many lines starting at one x in the middle band and almost nothing crossing it. */
function findColumnSplit(segs: Seg[], W: number): number | null {
  const counts = new Map<number, number>();
  for (const s of segs) {
    if (s.x0 < W * 0.3 || s.x0 > W * 0.78) continue;
    const k = Math.round(s.x0 / 3) * 3;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestN = 0;
  for (const [k, n] of counts) {
    const near = n + (counts.get(k - 3) ?? 0) + (counts.get(k + 3) ?? 0);
    if (near > bestN) { bestN = near; best = k; }
  }
  if (best === null || bestN < 5) return null;
  const crossing = segs.filter((s) => s.x0 < best! - 8 && s.x1 > best! + 8).length;
  const left = segs.filter((s) => s.x1 <= best! + 2).length;
  return crossing <= Math.max(3, segs.length * 0.06) && left >= 5 ? best - 2 : null;
}

/** The annotated text sent to the AI. */
export function annotate(x: Extracted): string {
  const out: string[] = [];
  let page = 0;
  let col = -1;
  for (const s of x.segs) {
    if (s.page !== page) { page = s.page; col = -1; out.push(`--- page ${page} ---`); }
    if (x.columns && s.col !== col) {
      col = s.col;
      out.push(col === 0 ? "--- header (full width) ---" : col === 1 ? "--- left column ---" : "--- right column ---");
    }
    const flags = `${s.size.toFixed(1)}${s.bold ? " bold" : ""}${s.italic ? " italic" : ""}`;
    out.push(`[${flags}] ${s.text}${s.right ? `   ⟶ right-aligned: ${s.right.text}` : ""}`);
  }
  return out.join("\n");
}

/** Plain text (DOCX/TXT/paste) in the same line shape, so one parser handles everything. */
export function segsFromLines(lines: { text: string; size?: number; bold?: boolean; heading?: boolean; bullet?: boolean; links?: string[] }[]): Extracted {
  return {
    pageWidth: 612,
    pages: 1,
    columns: false,
    segs: lines.map((l, i) => ({
      page: 1, col: 0, x0: l.bullet ? 50 : 36, x1: 576, y: 40 + i * 12, size: l.heading ? 13 : l.size ?? 10,
      bold: !!(l.bold || l.heading), italic: false,
      text: (l.bullet ? "• " : "") + l.text + (l.links ?? []).map((u) => ` ⟨link: ${u}⟩`).join(""),
      plain: (l.bullet ? "• " : "") + l.text, links: l.links ?? [],
    })),
  };
}
