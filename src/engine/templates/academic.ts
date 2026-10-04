// "Two-Column TeX": calibrated against Resume 3.pdf (pdfTeX, Latin Modern at
// optical sizes 9/10/12). Numbers are baseline-to-baseline distances in pt.
import { Column, Pager, type VLine } from "../flow";
import type { FontBook, FontKey } from "../fonts";
import { Typesetter, type Family, type IconPiece, type Piece } from "../text";
import type { Entry, Resume, Section } from "../../model/types";
import type { LayoutResult, RGB } from "../types";
import { PAPER, contactIconPiece, linkIcon, namePieces, nonEmpty, normUrl, paragraph, plainName, scaleFor, splitColumns, visibleContacts, vline, wantsIcon, PROFILE_ICONS } from "../common";

const INK: RGB = [0, 0, 0];
const GRAY: RGB = [0.6, 0.6, 0.6];
const M = 23.04;

const F9: Family = { regular: "lm9-rm", bold: "lm9-bx", italic: "lm9-it", boldItalic: "lm9-bx" };
const F10: Family = { regular: "lm10-rm", bold: "lm10-bx", italic: "lm10-it", boldItalic: "lm10-bx" };
const NAME12: Family = { regular: "lm12-rm", bold: "lm12-bx", italic: "lm10-it", boldItalic: "lm10-bi" };
export const ACADEMIC_FONTS: FontKey[] = ["lm9-rm", "lm9-bx", "lm9-it", "lm10-rm", "lm10-bx", "lm10-it", "lm10-bi", "lm12-bx", "lm12-rm"];

/** TeX \underline sits below the box depth: deeper for "/" and "()" than for "g" or "p". */
function underlineDepth(text: string, size: number): number {
  const d = /[/()[\]|]/.test(text) ? 0.25 : /[gjpqy,;@]/.test(text) ? 0.194 : 0;
  return d * size + 1.38;
}

export function layoutAcademic(r: Resume, book: FontBook, density = 0): LayoutResult {
  const { w: W, h: H } = PAPER[r.paper];
  const s = scaleFor(density);
  const F = (n: number) => n * s.f;
  const G = (n: number) => n * s.g;
  const ts = new Typesetter(book, "tex");
  const pager = new Pager(M, H - M);
  const p0 = pager.page(0).items;

  // ── Header ────────────────────────────────────────────────────────────
  let y = M + G(17.03);
  const nameL = ts.line(namePieces(ts, r, NAME12, F(24.91), INK, () => [ts.plain(plainName(r), "lm12-bx", F(24.91), INK, { src: "name", space: 0.302 })], { space: 0.302 }));
  ts.emit(nameL, (W - nameL.width) / 2, y, p0);
  if (r.headline.trim()) {
    y += G(15);
    const hl = ts.line(ts.runs(r.headline, F10, F(10.5), INK, { src: "headline" }));
    ts.emit(hl, (W - hl.width) / 2, y, p0);
  }
  const cs = F(8.67);
  const contacts = visibleContacts(r);
  if (contacts.length) {
    const groups: Piece[][] = contacts.map((c, i) => {
      const url = c.url ? normUrl(c.url) : "";
      const g: Piece[] = [];
      if (i > 0) g.push({ k: "gap", width: 0.629 * cs }, ts.plain("|", "lm9-rm", cs, INK), { k: "gap", width: 0.798 * cs });
      // Profile-link icons by default (as in the original); any kind on request.
      if (wantsIcon(c, (k) => PROFILE_ICONS.has(k))) g.push(contactIconPiece(c, cs, 0.229 * cs, INK, 0.125 * cs, url));
      g.push(ts.plain(c.text, "lm9-rm", cs, INK, { url, underline: !!url, src: `contacts.${r.contacts.indexOf(c)}` }));
      return g;
    });
    const maxW = W - 2 * M;
    const lines: Piece[][] = [[]];
    let lw = 0;
    for (const g of groups) {
      const gw = ts.width(g);
      if (lw + gw > maxW && lines[lines.length - 1].length) { const t = g.slice(3); lines.push(t); lw = ts.width(t); }
      else { lines[lines.length - 1].push(...g); lw += gw; }
    }
    lines.forEach((pieces, i) => {
      y += i === 0 ? G(17.27) : G(10.4);
      const l = ts.line(pieces);
      const items: typeof p0 = [];
      ts.emit(l, (W - l.width) / 2, y, items, { offset: 0, width: 0.4 });
      // Underlines follow TeX: below each link's own depth.
      for (const it of items) {
        if (it.t === "rule") {
          const txt = items.find((t) => t.t === "text" && Math.abs(t.x - it.x1) < 0.01);
          it.y = y + underlineDepth(txt && txt.t === "text" ? txt.text : "", cs);
          it.width = 0.4;
        }
      }
      p0.push(...items);
    });
  }
  const ruleY = y + G(27.86);
  p0.push({ t: "rule", x1: M, x2: W - M, y: ruleY, width: 0.598, color: GRAY });

  // ── Columns ───────────────────────────────────────────────────────────
  const { main, side } = splitColumns(r);
  const hasSide = side.length > 0;
  const inner = W - 2 * M;
  const sideX = M + inner * 0.64042;
  const sideW = W - M - sideX;
  const mainW = hasSide ? inner * 0.61232 : inner;

  const gap = (prev: string, next: string): number => {
    let v: number;
    if (next === "heading") v = prev === "para" ? 30.45 : ["value", "eduLine", "eduTitle", "awDate", "awDesc", "item"].includes(prev) ? 35.44 : 32.44;
    else if (prev === "heading") v = next === "title" ? 15.86 : next === "ptitle" ? 15.98 : next === "para" || next === "item" ? 14.51 : 14.61;
    else if (next === "title" || next === "ptitle") v = prev === "title" ? 10.31 : 12.29;
    else if (next === "sub") v = 10.31;
    else if (next === "bullet") v = prev === "sub" || prev === "title" || prev === "ptitle" ? 12.29 : 10.3;
    else if (next === "label") v = prev === "value" ? 13.29 : 10.3;
    else if (next === "eduTitle") v = prev === "eduTitle" ? 10.31 : 15.29;
    else if (next === "awTitle") v = prev === "awTitle" ? 10.31 : 15.29;
    else if (next === "para") v = 10.305;
    else v = 10.3;
    return G(v);
  };
  const firstHeading = ruleY + G(22.81);
  const colMain = new Column(M, mainW, pager, gap, () => firstHeading, (k) => M + (k === "heading" ? F(13.75) * 0.7 : F(9) * 0.75));
  const colSide = new Column(sideX, sideW, pager, gap, () => firstHeading, (k) => M + (k === "heading" ? F(13.75) * 0.7 : F(9) * 0.75));

  const fs = F(8.97);
  const bar = (): Piece[] => [{ k: "gap", width: 0.285 * fs }, ts.plain("|", "lm9-rm", fs, INK), { k: "gap", width: 0.8 * fs, breakable: true }];

  const bullets = (e: Entry, x: number, width: number, src: string): VLine[] => {
    const out: VLine[] = [];
    const dot = ts.line([ts.plain("•", "lm9-rm", fs, INK)]);
    e.bullets.forEach((b, bi) => {
      if (!b.text.trim()) return;
      const pieces: Piece[] = ts.runs(b.text, F9, fs, INK, { src: `${src}.bullets.${bi}` });
      if (b.link) pieces.push({ k: "icon", icon: linkIcon(b.link), size: fs, gap: 0.343 * fs, drop: 0.125 * fs, color: INK, url: normUrl(b.link) });
      ts.wrap(pieces, width - 9.96).forEach((l, i) =>
        out.push(vline(i === 0 ? "bullet" : "bwrap", 2.5, (bl, items) => {
          if (i === 0) ts.emit(dot, x - 2.19, bl, items);
          ts.emit(l, x + 9.96, bl, items);
        })),
      );
    });
    return out;
  };

  const mainEntry = (sec: Section, e: Entry, src: string, col: Column): VLine[] => {
    const x = col.x;
    const width = col.width;
    const out: VLine[] = [];
    const icon: IconPiece | null = e.link.trim() ? { k: "icon", icon: linkIcon(e.link), size: fs, gap: 0, drop: 0.125 * fs, color: INK, url: normUrl(e.link) } : null;
    if (sec.role === "projects") {
      // **Title** | tech stack | [icon]
      const row: Piece[] = ts.runs(e.title, F10, F(10.76), INK, { src: `${src}.title` }, true);
      const meta = nonEmpty(e.subtitle, e.meta, e.date).join(", ");
      if (meta) row.push(...bar(), ...ts.runs(meta, F9, F(8.77), INK, { src: `${src}.meta` }));
      if (icon) row.push(...bar(), icon);
      ts.wrap(row, width).forEach((l, i) => out.push(vline(i === 0 ? "ptitle" : "sub", 2.5, (b, items) => ts.emit(l, x, b, items))));
    } else {
      if (e.title.trim()) {
        const tp: Piece[] = ts.runs(e.title, F10, F(10.76), INK, { src: `${src}.title` }, true);
        if (icon) tp.push({ ...icon, gap: 0.343 * fs });
        ts.wrap(tp, width).forEach((l) => out.push(vline("title", 2.5, (b, items) => ts.emit(l, x, b, items))));
      }
      const sub = nonEmpty(e.subtitle, nonEmpty(e.date, e.location).join(", "), e.meta).join(" | ");
      if (sub) out.push(...paragraph(ts, ts.runs(sub, F9, F(8.77), INK, { src: `${src}.${e.subtitle.trim() ? "subtitle" : e.date.trim() ? "date" : "meta"}` }), x, width, "sub", "sub", 2.5));
    }
    out.push(...bullets(e, x, width, src));
    return out;
  };

  const sideEntry = (sec: Section, e: Entry, src: string, col: Column): VLine[] => {
    const x = col.x;
    const width = col.width;
    const out: VLine[] = [];
    const edu = sec.role === "education";
    const tk = edu ? "eduTitle" : "awTitle";
    if (e.title.trim()) {
      const tp: Piece[] = ts.runs(e.title, F9, fs, INK, { src: `${src}.title` }, true);
      if (e.link.trim()) tp.push({ k: "icon", icon: linkIcon(e.link), size: fs, gap: 0.343 * fs, drop: 0.125 * fs, color: INK, url: normUrl(e.link) });
      out.push(...paragraph(ts, tp, x, width, tk, tk, 2.5));
    }
    const lines = edu
      ? nonEmpty(e.subtitle, e.meta, nonEmpty(e.date, e.location).join(", ")).map((t) => ["eduLine", t])
      : [...(nonEmpty(e.subtitle, e.meta).length ? [["awDesc", nonEmpty(e.subtitle, e.meta).join(" – ")]] : []), ...(nonEmpty(e.date, e.location).length ? [["awDate", nonEmpty(e.date, e.location).join(", ")]] : [])];
    for (const [k, t] of lines) out.push(...paragraph(ts, ts.runs(t, F9, fs, INK, { src: `${src}.${k === "awDate" || (edu && t.includes(e.date) && e.date) ? "date" : "subtitle"}` }), x, width, k, k, 2.5));
    out.push(...bullets(e, x, width, src));
    return out;
  };

  const render = (sec: Section, col: Column, sideStyle: boolean) => {
    const si = r.sections.indexOf(sec);
    const src = `sections.${si}`;
    const x = col.x;
    const width = col.width;
    const hl = ts.line([ts.plain(sec.title.toUpperCase(), "lm12-bx", F(13.75), INK, { src: `${src}.title` })]);
    const h = vline("heading", 3, (b, items) => ts.emit(hl, x, b, items));
    if (sec.type === "summary") {
      col.place([h, ...paragraph(ts, ts.runs(sec.text, F9, fs, INK, { src: `${src}.text` }), x, width, "para", "para", 2.5)], 2);
    } else if (sec.type === "skills") {
      let first = true;
      sec.skills.forEach((k, ki) => {
        const g: VLine[] = [];
        if (k.label.trim()) g.push(...paragraph(ts, ts.runs(k.label, F9, fs, INK, { src: `${src}.skills.${ki}.label` }, true), x, width, "label", "label", 2.5));
        if (k.value.trim()) g.push(...paragraph(ts, ts.runs(k.value, F9, fs, INK, { src: `${src}.skills.${ki}.value` }), x, width, "value", "value", 2.5));
        if (!g.length) return;
        col.place(first ? [h, ...g] : g, first ? 3 : 2);
        first = false;
      });
    } else if (sec.type === "list") {
      const dot = ts.line([ts.plain("•", "lm9-rm", fs, INK)]);
      const lines: VLine[] = [];
      sec.items.forEach((it, ii) => {
        if (!it.text.trim()) return;
        const pieces: Piece[] = ts.runs(it.text, F9, fs, INK, { src: `${src}.items.${ii}.text` });
        if (it.link) pieces.push({ k: "icon", icon: linkIcon(it.link), size: fs, gap: 0.343 * fs, drop: 0.125 * fs, color: INK, url: normUrl(it.link) });
        ts.wrap(pieces, width - 9.95).forEach((l, i) => lines.push(vline(i === 0 ? "item" : "itemWrap", 2.5, (b, items) => {
          if (i === 0) ts.emit(dot, x - 2.19, b, items);
          ts.emit(l, x + 9.95, b, items);
        })));
      });
      col.place([h, ...lines], 2);
    } else {
      let first = true;
      sec.entries.forEach((e, ei) => {
        const lines = (sideStyle ? sideEntry : mainEntry)(sec, e, `${src}.entries.${ei}`, col);
        if (!lines.length) return;
        col.place(first ? [h, ...lines] : lines, first ? 4 : 3);
        first = false;
      });
    }
  };

  for (const sec of main) render(sec, colMain, false);
  for (const sec of side) render(sec, colSide, true);
  return { width: W, height: H, pages: pager.pages, bottom: H - M, top: M, fonts: ACADEMIC_FONTS };
}
