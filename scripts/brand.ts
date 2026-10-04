// Generates the Qelvo brand kit: brand/*.svg (+ PNGs via scripts/brand_png.py) and the site icons.
//   npx tsx scripts/brand.ts && python scripts/brand_png.py
//
// The mark: a Q whose tail is a flat baseline rule. The ring is one path that stops at the
// bottom centre; the amber rule picks up exactly where it ends and runs past the ring.
// Geometry lives in a 100 x 100 box. The wordmark is Poppins SemiBold (OFL) as outlines.
import fontkit from "@pdf-lib/fontkit";
import fs from "node:fs";

export const BRAND = { ink: "#121419", paper: "#F6F2EA", amber: "#FFB547", amberDeep: "#E08A00" };

const cx = 46, cy = 45, R = 28.25, r = 17.75, gap = 4;
const base = cy + R;                 // baseline: bottom of the ring = bottom of the rule
const barTop = cy + r;               // rule is exactly as thick as the ring
const cut = barTop - gap;            // ring stops this far above the rule
const f = (n: number) => +n.toFixed(2);
const ox = cx + Math.sqrt(R * R - (cut - cy) ** 2);
const ix = cx + Math.sqrt(r * r - (cut - cy) ** 2);
const RING = `M${f(ox)} ${f(cut)}A${R} ${R} 0 1 0 ${cx} ${f(base)}L${cx} ${f(barTop)}A${r} ${r} 0 1 1 ${f(ix)} ${f(cut)}Z`;
const BAR = { x: cx, y: barTop, w: 40, h: base - barTop };
// Visual centre of the mark inside its 100 box.
const SHIFT = { x: f(50 - (cx - R + cx + BAR.w) / 2), y: f(50 - (cy - R + base) / 2) };

/** The mark as SVG elements. `ring`/`bar` accept any CSS colour, including currentColor and var(). */
export function markElements(ring: string, bar: string) {
  return `<g transform="translate(${SHIFT.x} ${SHIFT.y})"><path d="${RING}" fill="${ring}"/><rect x="${BAR.x}" y="${f(BAR.y)}" width="${BAR.w}" height="${f(BAR.h)}" fill="${bar}"/></g>`;
}

const font: any = fontkit.create(fs.readFileSync("public/fonts/poppins/Poppins-SemiBold.ttf") as any);
/** Text as one outline path, baseline at y, `size` in px, tracking in em. */
function textPath(text: string, x: number, y: number, size: number, tracking = 0) {
  const run = font.layout(text);
  const s = size / font.unitsPerEm;
  let pen = 0;
  const parts: string[] = [];
  run.glyphs.forEach((g: any, i: number) => {
    const d = g.path.scale(s, -s).translate(x + pen, y).toSVG();
    parts.push(d);
    pen += run.positions[i].xAdvance * s + tracking * size;
  });
  return { d: parts.join(""), width: pen - tracking * size };
}

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>\n`;

const out = (p: string, s: string) => { fs.writeFileSync(p, s); console.log("wrote", p); };

const { ink, paper, amber, amberDeep } = BRAND;

// 1. App icon / avatar tiles.
const tile = (bg: string, fg: string, acc: string, rx = 22) => svg(100, 100, `<rect width="100" height="100" rx="${rx}" fill="${bg}"/>${markElements(fg, acc)}`);
out("brand/qelvo-icon-dark.svg", tile(ink, paper, amber));
out("brand/qelvo-icon-light.svg", tile(paper, ink, amberDeep));
// Square, no rounding: LinkedIn and GitHub crop avatars themselves.
out("brand/qelvo-avatar.svg", tile(ink, paper, amber, 0));
// Bare mark on transparent background.
out("brand/qelvo-mark-dark.svg", svg(100, 100, markElements(paper, amber)));
out("brand/qelvo-mark-light.svg", svg(100, 100, markElements(ink, amberDeep)));
out("public/favicon.svg", tile(ink, paper, amber));

// 2. Horizontal logo: mark + wordmark. The amber rule sits exactly on the wordmark's baseline.
const MARK_BASE = base + SHIFT.y;
let lockupGeo = {};
function lockupBody(fg: string, acc: string) {
  const k = 1.12, B = 80, size = 64;
  const tx = 6 - (cx - R + SHIFT.x) * k, ty = B - MARK_BASE * k;
  const markRight = tx + (cx + BAR.w + SHIFT.x) * k;
  const word = textPath("qelvo", markRight + 14, B, size, -0.02);
  const W = Math.ceil(markRight + 14 + word.width + 6);
  lockupGeo = { W, k, tx: f(tx), ty: f(ty), wordX: f(markRight + 14), B };
  return { W, H: 100, body: `<g transform="translate(${f(tx)} ${f(ty)}) scale(${k})">${markElements(fg, acc)}</g><path d="${word.d}" fill="${fg}"/>` };
}
function lockup(fg: string, acc: string) {
  const l = lockupBody(fg, acc);
  return svg(l.W, l.H, l.body);
}
out("brand/qelvo-logo-dark.svg", lockup(paper, amber));
out("brand/qelvo-logo-light.svg", lockup(ink, amberDeep));

// 3. Social banners (text as outlines so they render identically everywhere).
const TAG = "Typeset, not templated. Free and open source.";
function banner(W: number, H: number, scale: number) {
  const l = lockupBody(paper, amber);
  const x0 = (W - l.W * scale) / 2, y0 = H / 2 - 62 * scale;
  const tagSize = 13 * scale;
  const t = textPath(TAG, 0, 0, tagSize);
  const tag = textPath(TAG, (W - t.width) / 2, y0 + 136 * scale, tagSize);
  const grid = Array.from({ length: Math.ceil(W / 48) + 1 }, (_, i) => `M${i * 48} 0V${H}`).join("")
    + Array.from({ length: Math.ceil(H / 48) + 1 }, (_, i) => `M0 ${i * 48}H${W}`).join("");
  return svg(W, H, `<rect width="${W}" height="${H}" fill="${ink}"/><path d="${grid}" stroke="#1C1F27" stroke-width="1"/>`
    + `<g transform="translate(${f(x0)} ${f(y0)}) scale(${scale})">${l.body}</g>`
    + `<path d="${tag.d}" fill="#9AA0AE"/>`);
}
out("brand/qelvo-linkedin-banner.svg", banner(1584, 396, 1.75));
out("brand/qelvo-github-social.svg", banner(1280, 640, 2.5));
out("brand/qelvo-og.svg", banner(1200, 630, 2.4));

// 4. The same geometry for the app (theme colours are applied in src/ui/icons.tsx).
const word = textPath("qelvo", 0, 0, 64, -0.02);
out("src/ui/brand.gen.ts", `// Generated by scripts/brand.ts. Do not edit by hand.
export const MARK = { ring: ${JSON.stringify(RING)}, bar: ${JSON.stringify({ x: BAR.x, y: f(BAR.y), w: BAR.w, h: f(BAR.h) })}, shift: ${JSON.stringify(SHIFT)} };
/** Horizontal lockup in a W x 100 box: mark transform and where the wordmark baseline starts. */
export const LOCKUP = ${JSON.stringify(lockupGeo)};
/** "qelvo" in Poppins SemiBold, 64px, baseline at y = 0. */
export const WORDMARK = { d: ${JSON.stringify(word.d)}, width: ${f(word.width)} };
`);
