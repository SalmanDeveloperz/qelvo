// Render every sample in every template: npx tsx scripts/cross.ts outDir
import fs from "node:fs";
import { REFERENCE as SAMPLES } from "../src/model/samples";
import { ALL_FONTS, compile, renderPdf } from "../src/engine";
import { nodeBook } from "./node-fonts";
import type { TemplateId } from "../src/model/types";
const out = process.argv[2] ?? "out";
fs.mkdirSync(out, { recursive: true });
const book = nodeBook();
await book.load(ALL_FONTS);
for (const src of Object.keys(SAMPLES) as TemplateId[]) for (const t of ["classic", "academic", "modern", "blueprint"] as TemplateId[]) {
  if (src === t) continue;
  const r = { ...SAMPLES[src](), template: t };
  const c = compile(r, book);
  fs.writeFileSync(`${out}/${src}_as_${t}.pdf`, await renderPdf(r, book, c));
  console.log(`${src} → ${t}: pages=${c.pageCount} density=${c.density.toFixed(3)} overflow=${c.overflow} fill=${c.lastFill.toFixed(2)}`);
}
