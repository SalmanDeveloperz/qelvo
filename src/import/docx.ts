// DOCX → the same line shape the PDF extractor produces. mammoth gives semantic
// HTML (headings, paragraphs, list items, bold, links); a tiny tag walker turns
// it into lines, so this runs identically in the browser and under Node tests.
import { segsFromLines, type Extracted } from "./extract";

type LineIn = Parameters<typeof segsFromLines>[0][number];

export async function extractDocx(buf: ArrayBuffer): Promise<Extracted> {
  const mammoth: any = await import("mammoth");
  const api = mammoth.default ?? mammoth;
  const input = typeof window === "undefined" ? { buffer: Buffer.from(buf) } : { arrayBuffer: buf };
  const { value: html } = await api.convertToHtml(input);
  return segsFromLines(htmlToLines(html));
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", bull: "•", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
const decode = (s: string) => s.replace(/&(#x?[\da-f]+|\w+);/gi, (m, e: string) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m));

export function htmlToLines(html: string): LineIn[] {
  const lines: LineIn[] = [];
  // Block-level elements we turn into lines; mammoth emits flat, well-formed HTML.
  const re = /<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    const tag = m[1].toLowerCase();
    let inner = m[2];
    const links = [...inner.matchAll(/<a\b[^>]*href="([^"]+)"/gi)].map((x) => decode(x[1]));
    // A nested list inside an <li> is handled by its own <li> match; drop it here.
    inner = inner.replace(/<(ul|ol)\b[\s\S]*$/i, "");
    inner = inner.replace(/<br\s*\/?>/gi, " ");
    inner = inner.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => `**${t}**`);
    inner = inner.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => t);
    // Word users fake columns with tabs ("Engineer\t\tJan 2020 – Present"): keep them as a separator.
    let text = decode(inner.replace(/<[^>]+>/g, "")).replace(/\*\*\s*\*\*/g, "").replace(/\s*\t+\s*/g, " | ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    // A bullet typed by hand ("• Shipped …") is a list item, not part of the text.
    const typedBullet = /^(?:\*\*)?[•●▪◦‣■➢-]\s+/.test(text);
    if (typedBullet) text = text.replace(/^(\*\*)?[•●▪◦‣■➢-]\s+/, "$1");
    const allBold = /^\*\*[^*]+\*\*$/.test(text);
    lines.push({
      text: allBold ? text.slice(2, -2) : text,
      heading: /^h[1-6]$/.test(tag),
      bullet: tag === "li" || typedBullet,
      bold: allBold,
      size: tag === "h1" ? 20 : undefined,
      links,
    });
  }
  return lines;
}
