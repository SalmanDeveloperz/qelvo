// Inline markup used inside every text field: **bold**, *italic*, [label](url).
// Deliberately tiny: resumes need emphasis and links, nothing else.

export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  url: string;
}

export function parseInline(src: string): Run[] {
  const out: Run[] = [];
  let bold = false;
  let italic = false;
  let buf = "";
  const flush = (url = "") => {
    if (buf) out.push({ text: buf, bold, italic, url });
    buf = "";
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length && "*[]()\\".includes(src[i + 1])) {
      buf += src[++i];
      continue;
    }
    if (c === "*" && src[i + 1] === "*") {
      flush();
      bold = !bold;
      i++;
      continue;
    }
    if (c === "*" && /\S/.test(src[i + 1] ?? "") || (c === "*" && italic)) {
      flush();
      italic = !italic;
      continue;
    }
    if (c === "[") {
      const close = findClose(src, i, "[", "]");
      if (close > 0 && src[close + 1] === "(") {
        const end = findClose(src, close + 1, "(", ")");
        if (end > 0) {
          flush();
          const label = src.slice(i + 1, close);
          const url = src.slice(close + 2, end).trim();
          for (const r of parseInline(label)) out.push({ ...r, bold: r.bold || bold, italic: r.italic || italic, url });
          i = end;
          continue;
        }
      }
    }
    buf += c;
  }
  flush();
  return merge(out);
}

function findClose(s: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "\\") { i++; continue; }
    if (s[i] === open) depth++;
    else if (s[i] === close && --depth === 0) return i;
  }
  return -1;
}

function merge(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const p = out[out.length - 1];
    if (p && p.bold === r.bold && p.italic === r.italic && p.url === r.url) p.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

export const plain = (src: string) => parseInline(src).map((r) => r.text).join("");

/** Typographic normalisation applied at render time: -- → en dash, --- → em dash, straight quotes stay. */
export function typo(s: string): string {
  return s.replace(/---/g, "—").replace(/--/g, "–");
}
