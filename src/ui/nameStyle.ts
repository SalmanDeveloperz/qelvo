// Per-word weight for the name. "auto" names follow the template; the first manual
// change materialises that default as markup, so nothing jumps when you toggle one word.
import { TEMPLATE_META } from "../engine/meta";
import { parseInline } from "../model/inline";
import type { Resume } from "../model/types";

export interface NameWord { text: string; bold: boolean; italic: boolean }

export function nameWords(r: Resume): NameWord[] {
  if (r.nameStyle === "custom") {
    const out: NameWord[] = [];
    let cur: { c: string; b: boolean; i: boolean }[] = [];
    const push = () => {
      if (cur.length) out.push({ text: cur.map((x) => x.c).join(""), bold: cur.every((x) => x.b), italic: cur.every((x) => x.i) });
      cur = [];
    };
    for (const run of parseInline(r.name)) for (const c of run.text) /\s/.test(c) ? push() : cur.push({ c, b: run.bold, i: run.italic });
    push();
    return out;
  }
  const words = r.name.replace(/\*+/g, "").trim().split(/\s+/).filter(Boolean);
  const all = TEMPLATE_META[r.template].nameWeight === "all";
  return words.map((text, i) => ({ text, bold: all || i === words.length - 1, italic: false }));
}

export function nameMarkup(words: NameWord[]): string {
  const groups: { ws: string[]; b: boolean; i: boolean }[] = [];
  for (const w of words) {
    const g = groups[groups.length - 1];
    if (g && g.b === w.bold && g.i === w.italic) g.ws.push(w.text);
    else groups.push({ ws: [w.text], b: w.bold, i: w.italic });
  }
  return groups.map((g) => {
    let s = g.ws.join(" ");
    if (g.i) s = `*${s}*`;
    return g.b ? `**${s}**` : s;
  }).join(" ");
}

/** Flip one word's weight (or italic), switching the name to custom styling. */
export function toggleNameWord(r: Resume, index: number, what: "bold" | "italic" = "bold"): Resume {
  const words = nameWords(r).map((w, i) => (i === index ? { ...w, [what]: !w[what] } : w));
  return { ...r, nameStyle: "custom", name: nameMarkup(words) };
}

export function resetNameStyle(r: Resume): Resume {
  return { ...r, nameStyle: "auto", name: r.name.replace(/\*+/g, "").replace(/\s+/g, " ").trim() };
}
