// "Classic TeX": calibrated against Muhammad_Salman 1.pdf (pdfTeX, Computer
// Modern; the well-known Jake's-resume structure). Baseline distances in pt.
import { Column, Pager, type VLine } from "../flow";
import type { FontBook, FontKey } from "../fonts";
import { Typesetter, type Family, type IconPiece, type Piece } from "../text";
import type { Entry, Resume, Section } from "../../model/types";
import type { LayoutResult, RGB } from "../types";
import { PAPER, contactIconPiece, leftRight, linkIcon, namePieces, nonEmpty, normUrl, paragraph, plainName, scaleFor, sectionHasContent, visibleContacts, vline, wantsIcon } from "../common";

const INK: RGB = [0, 0, 0];
const M = 36;
// Computer Modern via Latin Modern: cmr10/cmbx10/cmti10 body, cmbx12 for name and headings.
const FAM: Family = { regular: "lm10-rm", bold: "lm10-bx", italic: "lm10-it", boldItalic: "lm10-bi" };
const NAME12: Family = { regular: "lm12-rm", bold: "lm12-bx", italic: "lm10-it", boldItalic: "lm10-bi" };
export const CLASSIC_FONTS: FontKey[] = ["lm10-rm", "lm10-bx", "lm10-it", "lm10-bi", "lm12-bx", "lm12-rm"];

const PROFILE = new Set(["linkedin", "github", "website", "other"]);

export function layoutClassic(r: Resume, book: FontBook, density = 0): LayoutResult {
  const { w: W, h: H } = PAPER[r.paper];
  const s = scaleFor(density);
  const F = (n: number) => n * s.f;
  const G = (n: number) => n * s.g;
  const ts = new Typesetter(book, "tex");
  // TeX lets the last baseline sit on the bottom edge of the text block (depth hangs below).
  const pager = new Pager(M, H - M + 4.5);
  const p0 = pager.page(0).items;
  const fs = F(9.96);

  // ── Header: name, then contact details, then profile links ─────────────
  let y = M + G(17.21);
  const nameL = ts.line(namePieces(ts, r, NAME12, F(24.79), INK, () => [ts.plain(plainName(r), "lm12-bx", F(24.79), INK, { src: "name" })]));
  ts.emit(nameL, (W - nameL.width) / 2, y, p0);
  if (r.headline.trim()) {
    y += G(15.5);
    const hl = ts.line(ts.runs(r.headline, FAM, F(10.91), INK, { src: "headline" }, false, true));
    ts.emit(hl, (W - hl.width) / 2, y, p0);
  }
  const contacts = visibleContacts(r);
  const rows = [contacts.filter((c) => !PROFILE.has(c.kind)), contacts.filter((c) => PROFILE.has(c.kind))].filter((x) => x.length);
  let first = true;
  for (const row of rows) {
    const groups: Piece[][] = row.map((c, i) => {
      const g: Piece[] = [];
      if (i > 0) g.push(ts.plain(" | ", "lm10-rm", fs, INK));
      // Classic prints no icons unless asked (the original has none).
      if (wantsIcon(c, () => false)) g.push(contactIconPiece(c, F(8.97), 0.333 * fs, INK, 0.125 * F(8.97), c.url ? normUrl(c.url) : ""));
      g.push(ts.plain(c.text, "lm10-rm", fs, INK, { url: c.url ? normUrl(c.url) : undefined, src: `contacts.${r.contacts.indexOf(c)}` }));
      return g;
    });
    // Pack into lines no wider than the text block.
    const lines: Piece[][] = [[]];
    let lw = 0;
    for (const g of groups) {
      const gw = ts.width(g);
      if (lw + gw > W - 2 * M && lines[lines.length - 1].length) { lines.push(g.slice(1)); lw = ts.width(g.slice(1)); }
      else { lines[lines.length - 1].push(...g); lw += gw; }
    }
    for (const pcs of lines) {
      y += first ? G(15.94) : G(12.96);
      first = false;
      const l = ts.line(pcs);
      ts.emit(l, (W - l.width) / 2, y, p0);
    }
  }
  const firstHeading = y + G(25.66);

  // ── Body ─────────────────────────────────────────────────────────────
  const X = M + 10.8; // itemize leftmargin=0.15in
  const RIGHT = W - 42.4; // right edge of the dates (0.97\textwidth tabular)
  const WRAP = W - 41.4 - X;

  const gap = (prev: string, next: string): number => {
    let v: number;
    if (next === "heading") v = prev === "para" || prev === "skill" || prev === "cell" ? 25.66 : prev === "sub" || prev === "title" || prev === "proj" ? 19.58 : 22.39;
    else if (prev === "heading") v = next === "title" ? 17.9 : next === "proj" || next === "cell" ? 19.88 : 17.32;
    else if (next === "para" || next === "skill") v = 11.96;
    else if (next === "title") v = prev === "title" ? 13.0 : prev === "sub" ? 17.0 : 15.69;
    else if (next === "proj") v = prev === "proj" ? 12.0 : 17.67;
    else if (next === "sub") v = prev === "title" ? 13.55 : 11.96;
    else if (next === "bullet") v = prev === "sub" || prev === "title" || prev === "proj" ? 12.41 : 12.39;
    else if (next === "bwrap") v = 11.96;
    else if (next === "cell") v = 13.55;
    else v = 11.96;
    return G(v);
  };
  const col = new Column(M, W - 2 * M, pager, gap, () => firstHeading, (k) => M + (k === "heading" ? F(11.96) * 0.75 : fs * 0.75));

  const iconP = (url: string, size = F(8.97)): IconPiece => ({ k: "icon", icon: linkIcon(url), size, gap: 0.333 * fs, drop: 0.125 * size, color: INK, url: normUrl(url) });
  const solidLink = (url: string, size = F(8.97), space = 0.333 * fs): IconPiece => ({ k: "icon", icon: "link", size, gap: space, drop: 0.125 * size, color: INK, url: normUrl(url) });

  const bullets = (e: Entry, src: string): VLine[] => {
    const out: VLine[] = [];
    e.bullets.forEach((b, bi) => {
      if (!b.text.trim()) return;
      const pieces: Piece[] = ts.runs(b.text, FAM, fs, INK, { src: `${src}.bullets.${bi}` });
      if (b.link) pieces.push(/github\.com/i.test(b.link) ? iconP(b.link) : solidLink(b.link));
      ts.wrap(pieces, WRAP - 24.0 + 10.8 - 10.8).forEach((l, i) =>
        out.push(vline(i === 0 ? "bullet" : "bwrap", 2.5, (bl, items) => {
          // The original's tiny CMSY6 \bullet: LM's bullet glyph sized so its ink is 2.7pt across,
          // centred 2.75pt above the baseline. Real text, so ATS parsers still see "•".
          if (i === 0) items.push({ t: "text", x: X + 16.59 - 3.647 * s.f, y: bl - 0.584 * s.f, text: "•", font: "lm10-rm", size: 9.375 * s.f, color: INK, shaping: "tex" });
          ts.emit(l, X + 24.0, bl, items);
        })),
      );
    });
    return out;
  };

  const entry = (sec: Section, e: Entry, src: string): VLine[] => {
    const out: VLine[] = [];
    if (sec.role === "projects") {
      // \textbf{Title} $|$ \emph{stack} $|$ [icon]            date
      const row: Piece[] = ts.runs(e.title, FAM, fs, INK, { src: `${src}.title` }, true);
      const meta = nonEmpty(e.subtitle, e.meta).join(", ");
      if (meta) row.push(ts.plain(" | ", "lm10-rm", fs, INK), ...ts.runs(meta, FAM, fs, INK, { src: `${src}.meta` }, false, true));
      if (e.link.trim()) row.push(ts.plain(" |", "lm10-rm", fs, INK), iconP(e.link));
      const date = e.date.trim() ? [ts.plain(e.date, "lm10-rm", fs, INK, { src: `${src}.date` })] : [];
      out.push(...leftRight(ts, row, date, X, RIGHT, "proj", 2.5));
    } else {
      const right1 = e.location.trim() ? [ts.plain(e.location, "lm10-rm", fs, INK, { src: `${src}.location` })] : [];
      const sub = nonEmpty(e.subtitle, e.meta).join(" | ");
      // 	extit adds italic correction after the last glyph; right-aligned, that nudges dates left.
      const itCorr: Piece[] = /\d$/.test(e.date.trim()) ? [{ k: "gap", width: 0.036 * fs }] : [];
      const dateP: Piece[] = e.date.trim() ? [ts.plain(e.date, "lm10-it", fs, INK, { src: `${src}.date` }), ...itCorr] : [];
      const title: Piece[] = ts.runs(e.title, FAM, F(10.91), INK, { src: `${src}.title` }, true);
      if (e.link.trim()) title.push(iconP(e.link));
      // With no subtitle line the date moves up beside the title.
      const titleRight = sub ? right1 : right1.length ? right1 : dateP;
      if (e.title.trim()) out.push(...leftRight(ts, title, titleRight, X, RIGHT, "title", 2.5));
      if (sub || (dateP.length && right1.length)) {
        const sp = sub ? ts.runs(sub, FAM, fs, INK, { src: `${src}.subtitle` }, false, true) : [];
        out.push(...leftRight(ts, sp, dateP, X, RIGHT, "sub", 2.5));
      }
    }
    out.push(...bullets(e, src));
    return out;
  };

  for (const sec of r.sections) {
    if (!sectionHasContent(sec)) continue;
    const si = r.sections.indexOf(sec);
    const src = `sections.${si}`;
    const hl = ts.line([ts.plain(sec.title.toUpperCase(), "lm12-bx", F(11.96), INK, { src: `${src}.title` })]);
    const h = vline("heading", 3, (b, items) => {
      ts.emit(hl, M, b, items);
      items.push({ t: "rule", x1: M, x2: W - M, y: b + 4.43 * s.f, width: 0.4, color: INK });
    });
    if (sec.type === "summary") {
      col.place([h, ...paragraph(ts, ts.runs(sec.text, FAM, fs, INK, { src: `${src}.text` }), X, WRAP, "para", "para", 2.5)], 2);
    } else if (sec.type === "skills") {
      const lines: VLine[] = [];
      sec.skills.forEach((k, ki) => {
        if (!k.label.trim() && !k.value.trim()) return;
        const pieces: Piece[] = [];
        if (k.label.trim()) pieces.push(...ts.runs(k.label, FAM, fs, INK, { src: `${src}.skills.${ki}.label` }, true), ts.plain(k.value.trim() ? ": " : "", "lm10-rm", fs, INK));
        pieces.push(...ts.runs(k.value, FAM, fs, INK, { src: `${src}.skills.${ki}.value` }));
        lines.push(...paragraph(ts, pieces, X, WRAP, "skill", "skill", 2.5));
      });
      col.place([h, ...lines], 2);
    } else if (sec.type === "list") {
      // Two-column grid (certifications with link icons, coursework, …)
      const cs = F(10.91);
      const x1 = X + 0.333 * cs;
      const x2 = x1 + 248.42 * ((W - 2 * M) / 540);
      const cellW = x2 - x1 - 8;
      const cells = sec.items.map((it, ii) => ({ it, ii })).filter(({ it }) => it.text.trim());
      const lines: VLine[] = [];
      for (let i = 0; i < cells.length; i += 2) {
        const pair = cells.slice(i, i + 2).map(({ it, ii }) => {
          const p: Piece[] = ts.runs(it.text, FAM, cs, INK, { src: `${src}.items.${ii}.text` });
          if (it.link) p.push(solidLink(it.link, F(8.97), 0.333 * cs));
          return ts.wrap(p, cellW);
        });
        const n = Math.max(...pair.map((p) => p.length));
        for (let li = 0; li < n; li++) {
          lines.push(vline("cell", 2.5, (b, items) => {
            if (pair[0][li]) ts.emit(pair[0][li], x1, b, items);
            if (pair[1]?.[li]) ts.emit(pair[1][li], x2, b, items);
          }));
        }
      }
      col.place([h, ...lines], 2);
    } else {
      let firstE = true;
      sec.entries.forEach((e, ei) => {
        const lines = entry(sec, e, `${src}.entries.${ei}`);
        if (!lines.length) return;
        col.place(firstE ? [h, ...lines] : lines, firstE ? 4 : 3);
        firstE = false;
      });
    }
  }
  return { width: W, height: H, pages: pager.pages, bottom: H - M, top: M, fonts: CLASSIC_FONTS };
}
