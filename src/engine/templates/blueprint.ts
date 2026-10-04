// "Blueprint": calibrated against Template 4.pdf (pdfTeX, Source Sans Pro, A4).
// Blue small-caps section headings over a hairline rule, a split header
// (name and profile links left; location, email and phone right), aligned
// skill rows, and project rows with a centred stack column and a source link.
// Every number is a baseline-to-baseline distance or x offset measured from the original.
import { Column, Pager, type VLine } from "../flow";
import type { FontBook, FontKey } from "../fonts";
import { Typesetter, type Family, type Piece } from "../text";
import type { Contact, Entry, Resume, Section } from "../../model/types";
import type { Item, LayoutResult, RGB } from "../types";
import {
  PAPER, contactIconPiece, leftRight, linkIcon, namePieces, nonEmpty, normUrl, paragraph, plainName,
  scaleFor, sectionHasContent, visibleContacts, vline, wantsIcon,
} from "../common";

const INK: RGB = [0, 0, 0];
const BLUE: RGB = [0, 0, 1];
const M = 36;
const FAM: Family = { regular: "ssp-rm", bold: "ssp-bx", italic: "ssp-it", boldItalic: "ssp-bi" };
export const BLUEPRINT_FONTS: FontKey[] = ["ssp-rm", "ssp-it", "ssp-bx", "ssp-bi", "lm10-rm"];

const PROFILE = new Set(["website", "linkedin", "github", "twitter", "other"]);

export function layoutBlueprint(r: Resume, book: FontBook, density = 0): LayoutResult {
  const { w: W, h: H } = PAPER[r.paper];
  const s = scaleFor(density);
  const F = (n: number) => n * s.f;
  const G = (n: number) => n * s.g;
  // Source Sans Pro's TFMs carry no kerning: TeX glue and breaking, ligatures, no kerns.
  const ts = new Typesetter(book, "texnk");
  const pager = new Pager(M, H - M + 4.5);
  const p0 = pager.page(0).items;
  const cs = F(10.91);
  const ul = { offset: 1.82, width: 0.4 };

  // ── Header ────────────────────────────────────────────────────────────
  const bar = (): Piece[] => [ts.plain(" ", "ssp-rm", cs, INK), ts.plain("|", "lm10-rm", cs, INK), ts.plain(" ", "ssp-rm", cs, INK)];
  const contactPieces = (c: Contact, label: string): Piece[] => {
    const url = c.url ? normUrl(c.url) : "";
    const src = `contacts.${r.contacts.indexOf(c)}`;
    const out: Piece[] = [];
    const icon = wantsIcon(c, () => false);
    if (icon) out.push(contactIconPiece(c, F(9.4), 0.3 * cs, INK, 0.125 * F(9.4), url));
    else if (label) out.push(ts.plain(label, "ssp-rm", cs, INK, { src }));
    out.push(ts.plain(c.text, "ssp-rm", cs, INK, { url, underline: !!url, src }));
    return out;
  };
  const join = (groups: Piece[][]) => groups.flatMap((g, i) => (i ? [...bar(), ...g] : g));
  const contacts = visibleContacts(r);
  const loc = contacts.filter((c) => c.kind === "location");
  const reach = contacts.filter((c) => c.kind === "email" || c.kind === "phone");
  const links = contacts.filter((c) => PROFILE.has(c.kind));
  const rightRows: Piece[][] = [];
  if (loc.length) rightRows.push(join(loc.map((c) => contactPieces(c, "Location: "))));
  if (reach.length) rightRows.push(join(reach.map((c) => contactPieces(c, c.kind === "email" ? "Email: " : "Mobile: "))));
  const leftRows: Piece[][] = [];
  if (r.headline.trim()) leftRows.push(ts.runs(r.headline, FAM, cs, INK, { src: "headline" }, false, true));
  if (links.length) leftRows.push(join(links.map((c) => contactPieces(c, ""))));

  const nameBase = M + G(15.94);
  const name = ts.line(namePieces(ts, r, FAM, F(24.79), INK, () => [ts.plain(plainName(r), "ssp-bx", F(24.79), INK, { src: "name" })]));
  ts.emit(name, M, nameBase, p0);
  // Row 0 shares the name's baseline on the right; later rows step 15.54pt. A right row that
  // would collide with the left row (long link lists) moves down a row.
  const placed: { left?: Piece[]; right?: Piece[] }[] = [{}];
  const queueR = [...rightRows];
  if (queueR.length && ts.line(queueR[0]).width + name.width + 18 < W - 2 * M) placed[0].right = queueR.shift();
  for (const lr of leftRows) placed.push({ left: lr });
  for (let i = 1; queueR.length; i++) {
    placed[i] ??= {};
    const lw = placed[i].left ? ts.line(placed[i].left!).width : 0;
    if (lw + ts.line(queueR[0]).width + 18 < W - 2 * M) placed[i].right = queueR.shift();
  }
  let y = nameBase;
  placed.forEach((row, i) => {
    if (i > 0) y += G(15.54);
    if (row.left) ts.emit(ts.line(row.left), M, y, p0, ul);
    if (row.right) { const l = ts.line(row.right); ts.emit(l, W - M - l.width, y, p0, ul); }
  });
  const firstHeading = y + G(31.14);

  // ── Body ──────────────────────────────────────────────────────────────
  const X = M + 10.8;
  const RE = W - M - 10.12;
  const fs = F(9.96);
  const gap = (prev: string, next: string): number => {
    let v: number;
    if (next === "heading") v = prev === "skill" ? 28.27 : prev === "sub" || prev === "title" ? 30.67 : 30.27;
    else if (prev === "heading") v = next === "para" ? 22.74 : next === "cell" ? 22.71 : 23.75;
    else if (next === "para") v = 11.95;
    else if (next === "skill") v = prev === "skillWrap" ? 15.67 : 15.67;
    else if (next === "skillWrap") v = 11.95;
    else if (next === "sub") v = 11.95;
    else if (next === "bwrap") v = 11.95;
    else if (next === "bullet") v = prev === "bullet" || prev === "bwrap" ? 15.67 : 19.15;
    else if (next === "title" || next === "proj") v = 19.16;
    else if (next === "cell") v = 17.67;
    else v = 11.95;
    return G(v);
  };
  const col = new Column(M, W - 2 * M, pager, gap, () => firstHeading, (k) => M + (k === "heading" ? F(11.96) * 0.75 : fs * 0.75));
  // 	extit's italic correction: Source Sans Italic has it after letters, not digits.
  const itCorr = (t: string): Piece[] => (/[a-z]$/.test(t.trim()) ? [{ k: "gap", width: 0.036 * fs }] : []);

  /**
   * 	extsc headings. True small-caps glyphs extract as garbage from the PDF, so lowercase
   * letters are drawn as capitals at the small-cap height (0.79) and letter-spaced to the real
   * small-caps advance widths: same look and width as the original, and the text layer reads
   * "FULL STACK DEVELOPER" for ATS parsers.
   */
  const smallCaps = (title: string, x0: number, b: number, size: number, items: Item[], src: string) => {
    let x = x0;
    for (const word of title.split(/(\s+)/)) {
      if (!word) continue;
      if (/^\s+$/.test(word)) { x += book.width("ssp-rm", " ", size, "texnk"); continue; }
      // Runs of same-case letters share one text item.
      for (const run of word.match(/\p{Ll}+|[^\p{Ll}]+/gu) ?? []) {
        if (/\p{Ll}/u.test(run)) {
          const target = [...run].reduce((a, ch) => a + book.width("ssp-rm", ch, size, "texsc"), 0);
          const up = run.toUpperCase();
          const natural = book.width("ssp-rm", up, size * 0.79, "texnk");
          items.push({ t: "text", x, y: b, text: up, font: "ssp-rm", size: size * 0.79, color: BLUE, shaping: "texnk", src, charSpacing: (target - natural) / up.length });
          x += target;
        } else {
          items.push({ t: "text", x, y: b, text: run, font: "ssp-rm", size, color: BLUE, shaping: "texnk", src });
          x += book.width("ssp-rm", run, size, "texnk");
        }
      }
    }
  };

  const bullets = (e: Entry, src: string): VLine[] => {
    const out: VLine[] = [];
    e.bullets.forEach((b, bi) => {
      if (!b.text.trim()) return;
      const pieces: Piece[] = ts.runs(b.text, FAM, fs, INK, { src: `${src}.bullets.${bi}` });
      if (b.link) pieces.push({ k: "icon", icon: linkIcon(b.link), size: F(8.97), gap: 0.2 * fs, drop: 0.125 * F(8.97), color: INK, url: normUrl(b.link) });
      ts.wrap(pieces, RE - (X + 24)).forEach((l, i) =>
        out.push(vline(i === 0 ? "bullet" : "bwrap", 2.5, (bl, items) => {
          // The original's tiny CMSY6 \bullet, as in Classic: real text so ATS parsers see "•".
          if (i === 0) items.push({ t: "text", x: X + 16.59 - 3.647 * s.f, y: bl - 0.584 * s.f, text: "•", font: "lm10-rm", size: 9.375 * s.f, color: INK, shaping: "tex" });
          ts.emit(l, X + 24, bl, items);
        })),
      );
    });
    return out;
  };

  const entry = (sec: Section, e: Entry, src: string): VLine[] => {
    const out: VLine[] = [];
    if (sec.role === "projects") {
      // Title · centred stack · "Source Code"
      const title = ts.line(ts.runs(e.title, FAM, fs, INK, { src: `${src}.title` }, true));
      const metaText = nonEmpty(e.subtitle, e.meta).join(", ");
      const meta = metaText ? ts.line(ts.runs(metaText, FAM, fs, INK, { src: `${src}.meta` }, false, true)) : null;
      const linkLabel = e.link.trim() ? (/\b(demo|live|app|play\.google|apps\.apple)\b/i.test(e.link) && !/github|gitlab|source/i.test(e.link) ? "Live Demo" : "Source Code") : "";
      const right = e.link.trim()
        ? ts.line([ts.plain(linkLabel, "ssp-rm", fs, INK, { url: normUrl(e.link), underline: true, src: `${src}.link` })])
        : e.date.trim() ? ts.line([ts.plain(e.date, "ssp-rm", fs, INK, { src: `${src}.date` })]) : null;
      const center = M + 0.488 * (W - 2 * M);
      out.push(vline("proj", 2.5, (b, items) => {
        ts.emit(title, X, b, items, ul);
        if (meta) {
          // Centred in its column, but never into the title or the link.
          const lo = X + title.width + 12;
          const hi = (right ? RE - right.width : RE) - 12;
          const mx = Math.max(lo, Math.min(center - meta.width / 2, hi - meta.width));
          ts.emit(meta, mx, b, items);
        }
        if (right) ts.emit(right, RE - right.width, b, items, ul);
      }));
    } else {
      // Experience shows the role first (bold) and the organisation under it (italic);
      // education, open source and the rest lead with the institution / organisation.
      const roleFirst = sec.role === "experience" && e.subtitle.trim();
      const row1 = roleFirst ? e.subtitle : e.title;
      const row2 = nonEmpty(roleFirst ? e.title : e.subtitle, e.meta).join(" | ");
      const dateTop = sec.role !== "education";
      const r1Right = dateTop ? e.date : e.location;
      const r2Right = dateTop ? e.location : e.date;
      const s1 = roleFirst ? "subtitle" : "title";
      const s2 = roleFirst ? "title" : "subtitle";
      if (row1.trim()) {
        const left: Piece[] = ts.runs(row1, FAM, fs, INK, { src: `${src}.${s1}` }, true);
        if (e.link.trim()) left.push({ k: "icon", icon: linkIcon(e.link), size: F(8.97), gap: 0.2 * fs, drop: 0.125 * F(8.97), color: INK, url: normUrl(e.link) });
        const right = r1Right.trim() ? [ts.plain(r1Right, "ssp-rm", fs, INK, { src: `${src}.${dateTop ? "date" : "location"}` })] : [];
        out.push(...leftRight(ts, left, right, X, RE, "title", 2.5));
      }
      if (row2.trim() || r2Right.trim()) {
        const left = row2.trim() ? ts.runs(row2, FAM, fs, INK, { src: `${src}.${s2}` }, false, true) : [];
        const right = r2Right.trim() ? [ts.plain(r2Right, "ssp-it", fs, INK, { src: `${src}.${dateTop ? "location" : "date"}` }), ...itCorr(r2Right)] : [];
        out.push(...leftRight(ts, left, right, X, RE, "sub", 2.5));
      }
    }
    out.push(...bullets(e, src));
    return out;
  };

  for (const sec of r.sections) {
    if (!sectionHasContent(sec)) continue;
    const si = r.sections.indexOf(sec);
    const src = `sections.${si}`;
    const h = vline("heading", 3, (b, items) => {
      smallCaps(sec.title, M, b, F(11.96), items, `${src}.title`);
      items.push({ t: "rule", x1: M, x2: W - M, y: b + 4.38 * s.f, width: 0.4, color: INK });
    });
    if (sec.type === "summary") {
      col.place([h, ...paragraph(ts, ts.runs(sec.text, FAM, fs, INK, { src: `${src}.text` }), M, W - 2 * M, "para", "para", 2.5)], 2);
    } else if (sec.type === "skills") {
      // Label · colon · value, the colon aligned down the section.
      const labelW = Math.max(0, ...sec.skills.map((k) => ts.width(ts.runs(k.label, FAM, fs, INK, {}, true))));
      const colonX = Math.max(X + 76.87, X + labelW + 8);
      const valueX = colonX + 10.25;
      const lines: VLine[] = [];
      sec.skills.forEach((k, ki) => {
        if (!k.label.trim() && !k.value.trim()) return;
        const label = ts.line(ts.runs(k.label, FAM, fs, INK, { src: `${src}.skills.${ki}.label` }, true));
        const vx = k.label.trim() ? valueX : X;
        const vals = ts.wrap(ts.runs(k.value, FAM, fs, INK, { src: `${src}.skills.${ki}.value` }), RE - vx);
        (vals.length ? vals : [null]).forEach((v, i) => lines.push(vline(i === 0 ? "skill" : "skillWrap", 2.5, (b, items) => {
          if (i === 0 && k.label.trim()) {
            ts.emit(label, X, b, items);
            ts.emit(ts.line([ts.plain(":", "ssp-rm", fs, INK)]), colonX, b, items);
          }
          if (v) ts.emit(v, vx, b, items);
        })));
      });
      col.place([h, ...lines], 2);
    } else if (sec.type === "list") {
      const dot = ts.line([ts.plain("•", "ssp-rm", fs, INK)]);
      const lines: VLine[] = [];
      sec.items.forEach((it, ii) => {
        if (!it.text.trim()) return;
        const url = it.link ? normUrl(it.link) : undefined;
        ts.wrap(ts.runs(it.text, FAM, fs, INK, { src: `${src}.items.${ii}.text`, url, underline: !!url }), RE - (M + 27.27)).forEach((l, i) =>
          lines.push(vline(i === 0 ? "cell" : "bwrap", 2.5, (b, items) => {
            if (i === 0) ts.emit(dot, M + 18.78, b, items);
            ts.emit(l, M + 27.27, b, items, ul);
          })),
        );
      });
      col.place([h, ...lines], 2);
    } else {
      let first = true;
      sec.entries.forEach((e, ei) => {
        const lines = entry(sec, e, `${src}.entries.${ei}`);
        if (!lines.length) return;
        col.place(first ? [h, ...lines] : lines, first ? 4 : 3);
        first = false;
      });
    }
  }
  return { width: W, height: H, pages: pager.pages, bottom: H - M, top: M, fonts: BLUEPRINT_FONTS };
}
