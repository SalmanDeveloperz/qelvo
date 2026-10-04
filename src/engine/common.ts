import { resolveColumn } from "../model/factory";
import type { Contact, Paper, Resume, Section } from "../model/types";
import type { Line, Piece, Typesetter } from "./text";
import type { VLine } from "./flow";
import type { IconKind, Item } from "./types";

export const PAPER: Record<Paper, { w: number; h: number }> = {
  letter: { w: 612, h: 792 },
  a4: { w: 595.28, h: 841.89 },
};

/** Density 0 = the template exactly as designed. 1 = tightest auto-fit allowed. */
export interface Scale {
  /** Multiplies every vertical gap. */
  g: number;
  /** Multiplies every font size. */
  f: number;
}

export function scaleFor(density: number): Scale {
  const d = Math.max(0, Math.min(1, density));
  return { g: 1 - 0.16 * d, f: 1 - 0.06 * d };
}

export const vline = (kind: string, depth: number, draw: (b: number, out: Item[]) => void): VLine => ({ kind, depth, draw });

/** Wrap pieces and return one VLine per output line, at x. */
export function paragraph(ts: Typesetter, pieces: Piece[], x: number, width: number, kind: string, wrapKind: string, depth: number, opts: { indent?: number; firstWidth?: number } = {}): VLine[] {
  const lines = ts.wrap(pieces, width - (opts.indent ?? 0), opts.firstWidth);
  return lines.map((l, i) => vline(i === 0 ? kind : wrapKind, depth, (b, out) => ts.emit(l, x + (i === 0 ? 0 : opts.indent ?? 0), b, out)));
}

/** A line with a left part and a right-aligned part (dates). Falls back to two lines if they collide. */
export function leftRight(ts: Typesetter, left: Piece[], right: Piece[], x: number, rightEdge: number, kind: string, depth: number, minGap = 8): VLine[] {
  const rl: Line = ts.line(right);
  const avail = rightEdge - x - (right.length ? rl.width + minGap : 0);
  const ll = ts.wrap(left, avail);
  return ll.map((l, i) =>
    vline(kind, depth, (b, out) => {
      ts.emit(l, x, b, out);
      if (i === 0 && right.length) ts.emit(rl, rightEdge - rl.width, b, out);
    }),
  );
}

export function splitColumns(r: Resume): { main: Section[]; side: Section[] } {
  const main: Section[] = [];
  const side: Section[] = [];
  for (const s of r.sections) {
    if (!sectionHasContent(s)) continue;
    (resolveColumn(s) === "side" ? side : main).push(s);
  }
  return { main, side };
}

export function sectionHasContent(s: Section): boolean {
  switch (s.type) {
    case "summary":
      return !!s.text.trim();
    case "entries":
      return s.entries.some((e) => e.title.trim() || e.subtitle.trim() || e.bullets.some((b) => b.text.trim()));
    case "skills":
      return s.skills.some((k) => k.label.trim() || k.value.trim());
    case "list":
      return s.items.some((i) => i.text.trim());
  }
}

export const visibleContacts = (r: Resume): Contact[] => r.contacts.filter((c) => c.text.trim());

export function contactIcon(c: Contact): IconKind | null {
  if (c.kind === "linkedin") return "linkedin";
  if (c.kind === "github") return "github";
  return null;
}

/** Choose the icon for an arbitrary link (repo vs. certificate vs. anything). */
export function linkIcon(url: string): IconKind {
  return /github\.com|gitlab\.com/i.test(url) ? "github" : "link";
}

export function normUrl(u: string): string {
  const t = u.trim();
  if (!t) return "";
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return `mailto:${t}`;
  return `https://${t.replace(/^\/+/, "")}`;
}

export const nonEmpty = (...xs: (string | undefined)[]) => xs.map((x) => (x ?? "").trim()).filter(Boolean);

// ── Contacts with icons ───────────────────────────────────────────────
import type { ContactKind } from "../model/types";
import { iconAspect } from "./fa";
import type { Family, IconPiece, TextPiece } from "./text";
import type { RGB } from "./types";

export const CONTACT_ICON: Record<ContactKind, IconKind> = {
  linkedin: "linkedin", github: "github", twitter: "twitter", location: "marker",
  phone: "phone", email: "envelope", website: "globe", other: "link",
};

/** Kinds that carry an icon by default in templates that use icons (Modern, Two-Column TeX). */
export { PROFILE_KINDS as PROFILE_ICONS } from "./meta";

/** The user's checkbox wins; otherwise the template's default for that kind. */
export const wantsIcon = (c: Contact, byDefault: (k: ContactKind) => boolean) => c.icon ?? byDefault(c.kind);

/** An icon piece sized to sit on a text line: `size` is the em box, `gap` the space after it. */
export function contactIconPiece(c: Contact, size: number, gap: number, color: RGB, drop = 0.125 * size, url = ""): IconPiece {
  const icon = CONTACT_ICON[c.kind];
  return { k: "icon", icon, size, gap: 0, drop, color, url, width: iconAspect(icon) * size + gap };
}

/**
 * The name. "auto" uses the template's look (`auto` pieces); "custom" follows the
 * name's own **bold** / *italic* markup exactly, so any word can be bold or not.
 */
export function namePieces(ts: Typesetter, r: Resume, fam: Family, size: number, color: RGB, auto: () => TextPiece[], extra: Partial<TextPiece["style"]> = {}): TextPiece[] {
  if (r.nameStyle !== "custom") return auto();
  return ts.runs(r.name, fam, size, color, { src: "name", ...extra });
}

/** Strip markup for templates/places that print the name as plain text. */
export const plainName = (r: Resume) => r.name.replace(/\*\*|\*/g, "");
