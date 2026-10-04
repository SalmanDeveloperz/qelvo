import type { Resume, TemplateId } from "../model/types";
import { plain } from "../model/inline";
import type { FontBook, FontKey } from "./fonts";
import type { LayoutResult } from "./types";
import { writePdf } from "./pdf";
import { layoutModern, MODERN_FONTS } from "./templates/modern";
import { layoutClassic, CLASSIC_FONTS } from "./templates/classic";
import { layoutAcademic, ACADEMIC_FONTS } from "./templates/academic";
import { layoutBlueprint, BLUEPRINT_FONTS } from "./templates/blueprint";
import { TEMPLATE_META } from "./meta";

export interface TemplateDef {
  id: TemplateId;
  name: string;
  tagline: string;
  fonts: FontKey[];
  twoColumn: boolean;
  layout(r: Resume, book: FontBook, density: number): LayoutResult;
}

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  classic: { ...TEMPLATE_META.classic, fonts: CLASSIC_FONTS, layout: layoutClassic },
  academic: { ...TEMPLATE_META.academic, fonts: ACADEMIC_FONTS, layout: layoutAcademic },
  modern: { ...TEMPLATE_META.modern, fonts: MODERN_FONTS, layout: layoutModern },
  blueprint: { ...TEMPLATE_META.blueprint, fonts: BLUEPRINT_FONTS, layout: layoutBlueprint },
};

export interface Compiled {
  layout: LayoutResult;
  /** 0 = template exactly as designed; >0 = spacing tightened to hit the page target. */
  density: number;
  pageCount: number;
  target: number;
  /** Content still doesn't fit the target even at the tightest density. */
  overflow: boolean;
  /** How full the last page is, 0..1. */
  lastFill: number;
  ms: number;
}

/**
 * Lay the resume out, tightening spacing (then type size, a little) only as far
 * as needed to land on the requested page count. Never touches the words.
 */
export function compile(r: Resume, book: FontBook): Compiled {
  const t0 = performance.now();
  const t = TEMPLATES[r.template];
  const run = (d: number) => t.layout(r, book, d);
  let best = run(0);
  let density = 0;
  let overflow = false;
  if (best.pages.length > r.pages) {
    const tight = run(1);
    if (tight.pages.length > r.pages) {
      // Can't land on the target anyway: keep the template's natural rhythm and say so,
      // rather than cramming every page for nothing.
      overflow = true;
    } else {
      let lo = 0;
      let hi = 1;
      best = tight;
      density = 1;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        const l = run(mid);
        if (l.pages.length <= r.pages) { hi = mid; best = l; density = mid; }
        else lo = mid;
      }
    }
  }
  const last = best.pages[best.pages.length - 1];
  const top = best.pages.length === 1 ? 0 : best.top;
  const lastFill = Math.min(1, Math.max(0, (last.used - top) / (best.bottom - top)));
  return { layout: best, density, pageCount: best.pages.length, target: r.pages, overflow, lastFill, ms: performance.now() - t0 };
}

export async function renderPdf(r: Resume, book: FontBook, c: Compiled = compile(r, book)): Promise<Uint8Array> {
  const skills = r.sections.filter((s) => s.type === "skills").flatMap((s) => s.skills.flatMap((k) => k.value.split(/,\s*/)));
  return writePdf(c.layout, book, {
    title: `${plain(r.name) || "Resume"} – Resume`,
    author: plain(r.name),
    subject: r.headline || "Resume",
    keywords: skills.map((s) => plain(s).trim()).filter(Boolean).slice(0, 40),
  });
}

export const ALL_FONTS: FontKey[] = [...new Set([...CLASSIC_FONTS, ...ACADEMIC_FONTS, ...MODERN_FONTS, ...BLUEPRINT_FONTS])];
