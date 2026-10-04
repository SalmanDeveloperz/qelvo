// "Modern": calibrated against Salman_Resume 2.pdf (ReportLab, Poppins).
// Every number below is a baseline-to-baseline distance or an x offset
// measured from that file, in PDF points.
import { Column, Pager } from "../flow";
import type { FontBook, FontKey } from "../fonts";
import { Typesetter, type Family, type IconPiece, type Piece } from "../text";
import type { Entry, Resume, Section } from "../../model/types";
import type { LayoutResult, RGB } from "../types";
import { PAPER, contactIconPiece, leftRight, linkIcon, namePieces, nonEmpty, normUrl, paragraph, plainName, scaleFor, splitColumns, visibleContacts, vline, wantsIcon, PROFILE_ICONS } from "../common";

const INK: RGB = [0x1a / 255, 0x1a / 255, 0x1a / 255];
const GRAY: RGB = [0.6, 0.6, 0.6];
const M = 23.04;

const FAM: Family = { regular: "pop-regular", bold: "pop-bold", italic: "pop-italic", boldItalic: "pop-bold" };
/** The name pairs Light with Bold: un-bolded words fall back to Light, not Regular. */
const NAME_FAM: Family = { regular: "pop-light", bold: "pop-bold", italic: "pop-italic", boldItalic: "pop-bold" };
export const MODERN_FONTS: FontKey[] = ["pop-light", "pop-regular", "pop-bold", "pop-italic"];

export function layoutModern(r: Resume, book: FontBook, density = 0): LayoutResult {
  const { w: W, h: H } = PAPER[r.paper];
  const s = scaleFor(density);
  const F = (n: number) => n * s.f;
  const G = (n: number) => n * s.g;
  const ts = new Typesetter(book, "plain");
  const pager = new Pager(M, H - M);
  const p0 = pager.page(0).items;

  // ── Header ────────────────────────────────────────────────────────────
  const nameBase = M + G(4.0); // 27.04 at scale 1
  // Default look: light given names, bold surname. Custom: the name's own markup (light = not bold).
  const nameLine = ts.line(namePieces(ts, r, NAME_FAM, F(23.5), INK, () => {
    const words = plainName(r).trim().split(/\s+/).filter(Boolean);
    const last = words.pop() ?? "";
    const out = words.length ? [ts.plain(words.join(" ") + " ", "pop-light", F(23.5), INK, { src: "name" })] : [];
    return [...out, ts.plain(last, "pop-bold", F(23.5), INK, { src: "name" })];
  }));
  ts.emit(nameLine, (W - nameLine.width) / 2, nameBase, p0);
  let y = nameBase;

  const contacts = visibleContacts(r);
  if (r.headline.trim()) {
    y += G(12.5);
    const hl = ts.line(ts.runs(r.headline, FAM, F(9), INK, { src: "headline" }));
    ts.emit(hl, (W - hl.width) / 2, y, p0);
  }
  if (contacts.length) {
    const groups: Piece[][] = contacts.map((c, i) => {
      const src = `contacts.${r.contacts.indexOf(c)}`;
      const url = c.url ? normUrl(c.url) : "";
      const g: Piece[] = [];
      if (i > 0) g.push(ts.plain("  |  ", "pop-regular", F(8.2), INK));
      // Icons: profile links (LinkedIn, GitHub, website, X) on by default, as in the original; any kind on request.
      if (wantsIcon(c, (k) => PROFILE_ICONS.has(k))) {
        if (c.kind === "linkedin" || c.kind === "github") {
          const icon: IconPiece = {
            k: "icon", icon: c.kind === "linkedin" ? "linkedinSquare" : "github", size: F(7.4), gap: 0,
            drop: c.kind === "linkedin" ? 0.56 : 0.66, color: INK, url, width: F(7.4) + 2.6 * s.f,
          };
          g.push(icon);
        } else g.push(contactIconPiece(c, F(7.4), 2.6 * s.f, INK, 0.66, url));
      }
      g.push(ts.plain(c.text, "pop-regular", F(8.2), INK, { url, underline: !!url, src }));
      return g;
    });
    // Greedy pack groups into centred lines.
    const maxW = W - 2 * M;
    const lines: Piece[][] = [[]];
    let lw = 0;
    for (const g of groups) {
      const gw = ts.width(g);
      if (lw + gw > maxW && lines[lines.length - 1].length) {
        const trimmed = g.slice(1);
        lines.push(trimmed);
        lw = ts.width(trimmed);
      } else { lines[lines.length - 1].push(...g); lw += gw; }
    }
    lines.forEach((pieces, i) => {
      y += i === 0 ? G(12.5) : G(10.5);
      const l = ts.line(pieces);
      ts.emit(l, (W - l.width) / 2, y, p0, { offset: 1.16, width: 0.45 });
    });
  }
  const ruleY = y + G(11.46);
  p0.push({ t: "rule", x1: M, x2: W - M, y: ruleY, width: 0.65, color: GRAY });

  // ── Columns ───────────────────────────────────────────────────────────
  const sideW = (W - 2 * M) * 0.35952;
  const sideX = W - M - sideW;
  const mainW = sideX - M - 15.6;
  const { main, side } = splitColumns(r);
  const hasSide = side.length > 0;

  // Baseline gaps between line kinds.
  const lead: Record<string, number> = {
    heading: 12.2, para: 10.6, title: 10.6, subA: 10.6, subB: 10.5, bullet: 10.3, bwrap: 10.3,
    label: 10, value: 10, eduTitle: 10.5, eduLine: 10, awTitle: 10, awDesc: 9.8, awDate: 9.8, item: 9.9,
  };
  const gap = (prev: string, next: string): number => {
    let v: number;
    if (next === "heading") {
      v = prev === "value" ? 27.0 : prev === "eduLine" ? 18.0 : prev === "awDate" || prev === "item" ? 25.5 : 14.0 + (lead[prev] ?? 10.3);
    } else if (prev === "heading") v = 12.2;
    else if (next === "title" || next === "titleExp") {
      v = prev === "bullet" || prev === "bwrap" ? (next === "titleExp" ? 14.9 : 13.8) : 13.8;
    } else if (next === "bwrap") v = 10.3;
    else if (next === "bullet") v = prev === "bullet" || prev === "bwrap" ? 11.4 : prev === "subB" ? 10.5 : 10.6;
    else if (next === "para") v = 10.6;
    else if (next === "subA" || next === "subB") v = prev === "title" || prev === "titleExp" ? 10.6 : lead[next];
    else if (next === "label") v = prev === "value" ? 13.0 : 10;
    else if (next === "value") v = 10;
    else if (next === "eduTitle") v = prev === "eduTitle" ? 10.5 : 11.5;
    else if (next === "eduLine") v = prev === "eduTitle" ? 10.5 : 10;
    else if (next === "awTitle") v = prev === "awTitle" ? 10 : 11.5;
    else if (next === "awDesc") v = prev === "awTitle" ? 10 : 9.8;
    else if (next === "awDate") v = prev === "awTitle" ? 10 : 9.8;
    else if (next === "item") v = 9.9;
    else v = lead[next] ?? 10.3;
    return G(v);
  };
  const firstHeading = ruleY + G(20.04);
  const first1 = (k: string) => (k === "heading" ? firstHeading : firstHeading);
  const firstN = (k: string) => M + (k === "heading" ? F(12.1) * 0.85 : F(9) * 0.9);
  const colMain = new Column(M, hasSide ? mainW : W - 2 * M, pager, gap, first1, firstN);
  const colSide = new Column(sideX, sideW, pager, gap, first1, firstN);

  const heading = (sec: Section, src: string) => {
    const l = ts.line([ts.plain(sec.title.toUpperCase(), "pop-bold", F(12.1), INK, { src: `${src}.title` })]);
    return vline("heading", 3, (b, out) => ts.emit(l, 0 + colX(), b, out));
  };
  let curCol: Column = colMain;
  const colX = () => curCol.x;

  const bulletLines = (text: string, link: string, x: number, width: number, src: string, size: number, glyphGap = 9.0) => {
    const pieces: Piece[] = ts.runs(text, FAM, F(size), INK, { src });
    if (link) pieces.push({ k: "icon", icon: linkIcon(link), size: F(6.8), gap: 4.05, drop: 0.66, color: INK, url: normUrl(link) });
    const lines = ts.wrap(pieces, width - glyphGap);
    const dot = ts.line([ts.plain("•", "pop-regular", F(size), INK)]);
    return lines.map((l, i) =>
      vline(i === 0 ? "bullet" : "bwrap", 2.5, (b, out) => {
        if (i === 0) ts.emit(dot, x, b, out);
        ts.emit(l, x + glyphGap, b, out);
      }),
    );
  };

  const mainEntry = (sec: Section, e: Entry, src: string, col: Column) => {
    const x = col.x;
    const width = col.width;
    const out = [] as ReturnType<typeof vline>[];
    const titleKind = sec.role === "experience" ? "titleExp" : "title";
    const leftPart = e.subtitle.trim() && e.meta.trim() ? `${e.subtitle.trim()} – ${e.meta.trim()}` : e.subtitle.trim() || e.meta.trim();
    const rightPart = nonEmpty(e.date, e.location).join(", ");
    const subText = nonEmpty(leftPart, rightPart).join("  |  ");
    const subSize = !e.subtitle.trim() && e.meta.trim() ? 8.2 : e.date.trim() ? 8.3 : 8.0;
    const icon: IconPiece | null = e.link.trim() ? { k: "icon", icon: linkIcon(e.link), size: F(7), gap: 4.02, drop: 0.66, color: INK, url: normUrl(e.link) } : null;

    if (e.title.trim()) {
      const tp: Piece[] = ts.runs(e.title, FAM, F(9.3), INK, { src: `${src}.title` }, true);
      if (icon && !subText) tp.push(icon);
      out.push(...paragraph(ts, tp, x, width, titleKind, titleKind, 2.5));
    }
    if (subText) {
      const sp: Piece[] = ts.runs(subText, FAM, F(subSize), INK, { src: `${src}.${e.subtitle.trim() ? "subtitle" : e.meta.trim() ? "meta" : "date"}` });
      if (icon) sp.push(icon);
      const k = subSize >= 8.3 ? "subA" : "subB";
      out.push(...paragraph(ts, sp, x, width, k, k, 2.5));
    }
    e.bullets.forEach((b, bi) => {
      if (b.text.trim()) out.push(...bulletLines(b.text, b.link, x, width, `${src}.bullets.${bi}`, 8.2));
    });
    return out;
  };

  const sideEntry = (sec: Section, e: Entry, src: string, col: Column) => {
    const x = col.x;
    const width = col.width;
    const out = [] as ReturnType<typeof vline>[];
    const edu = sec.role === "education";
    const icon: IconPiece | null = e.link.trim() ? { k: "icon", icon: linkIcon(e.link), size: F(6.8), gap: 4.0, drop: 0.66, color: INK, url: normUrl(e.link) } : null;
    if (e.title.trim()) {
      const tp: Piece[] = ts.runs(e.title, FAM, F(8.4), INK, { src: `${src}.title` }, true);
      if (icon) tp.push(icon);
      out.push(...paragraph(ts, tp, x, width, edu ? "eduTitle" : "awTitle", edu ? "eduTitle" : "awTitle", 2.5));
    }
    if (edu) {
      const lines = nonEmpty(e.subtitle, e.meta, nonEmpty(e.date, e.location).join(", "));
      const srcs = [e.subtitle.trim() && "subtitle", e.meta.trim() && "meta", "date"].filter(Boolean);
      lines.forEach((t, i) => out.push(...paragraph(ts, ts.runs(t, FAM, F(8.25), INK, { src: `${src}.${srcs[i]}` }), x, width, "eduLine", "eduLine", 2.5)));
    } else {
      const desc = nonEmpty(e.subtitle, e.meta).join(" – ");
      if (desc) out.push(...paragraph(ts, ts.runs(desc, FAM, F(8.1), INK, { src: `${src}.subtitle` }), x, width, "awDesc", "awDesc", 2.5));
      const d = nonEmpty(e.date, e.location).join(", ");
      if (d) out.push(...paragraph(ts, ts.runs(d, FAM, F(7.9), INK, { src: `${src}.date` }), x, width, "awDate", "awDate", 2.5));
    }
    e.bullets.forEach((b, bi) => {
      if (b.text.trim()) out.push(...bulletLines(b.text, b.link, x, width, `${src}.bullets.${bi}`, 8.1, 9.0));
    });
    return out;
  };

  const renderSection = (sec: Section, col: Column, sideStyle: boolean) => {
    curCol = col;
    const si = r.sections.indexOf(sec);
    const src = `sections.${si}`;
    const h = heading(sec, src);
    const x = col.x;
    const width = col.width;
    if (sec.type === "summary") {
      const lines = paragraph(ts, ts.runs(sec.text, FAM, F(8.4), INK, { src: `${src}.text` }), x, width, "para", "para", 2.5);
      col.place([h, ...lines], 2);
    } else if (sec.type === "skills") {
      let firstGroup = true;
      sec.skills.forEach((k, ki) => {
        if (!k.label.trim() && !k.value.trim()) return;
        const g = [] as ReturnType<typeof vline>[];
        if (k.label.trim()) g.push(...paragraph(ts, ts.runs(k.label, FAM, F(8.4), INK, { src: `${src}.skills.${ki}.label` }, true), x, width, "label", "label", 2.5));
        if (k.value.trim()) g.push(...paragraph(ts, ts.runs(k.value, FAM, F(8.15), INK, { src: `${src}.skills.${ki}.value` }), x, width, "value", "value", 2.5));
        col.place(firstGroup ? [h, ...g] : g, firstGroup ? 3 : 2);
        firstGroup = false;
      });
    } else if (sec.type === "list") {
      const lines = sec.items.filter((i) => i.text.trim()).map((it) => {
        const ii = sec.items.indexOf(it);
        const pieces: Piece[] = [ts.plain("•  ", "pop-regular", F(8.1), INK), ...ts.runs(it.text, FAM, F(8.1), INK, { src: `${src}.items.${ii}.text` })];
        if (it.link) pieces.push({ k: "icon", icon: linkIcon(it.link), size: F(6.8), gap: 4.0, drop: 0.66, color: INK, url: normUrl(it.link) });
        return paragraph(ts, pieces, x, width, "item", "item", 2.5, { indent: ts.width([ts.plain("•  ", "pop-regular", F(8.1), INK)]) });
      }).flat();
      col.place([h, ...lines], 2);
    } else {
      let firstEntry = true;
      sec.entries.forEach((e, ei) => {
        const lines = (sideStyle ? sideEntry : mainEntry)(sec, e, `${src}.entries.${ei}`, col);
        if (!lines.length) return;
        col.place(firstEntry ? [h, ...lines] : lines, firstEntry ? 4 : 3);
        firstEntry = false;
      });
    }
  };

  for (const sec of main) renderSection(sec, colMain, false);
  for (const sec of side) renderSection(sec, colSide, true);

  return { width: W, height: H, pages: pager.pages, bottom: H - M, top: M, fonts: MODERN_FONTS };
}

export { leftRight };
