// Render the calibration fixtures to PDFs: npx tsx scripts/render.ts [outDir]
import fs from "node:fs";
import { REFERENCE as SAMPLES } from "../src/model/samples";
import { ALL_FONTS, compile, renderPdf } from "../src/engine";
import { nodeBook } from "./node-fonts";
const out = process.argv[2] ?? "out";
fs.mkdirSync(out, { recursive: true });
const book = nodeBook();
await book.load(ALL_FONTS);
for (const [id, make] of Object.entries(SAMPLES)) {
  const r = make();
  const c = compile(r, book);
  const bytes = await renderPdf(r, book, c);
  fs.writeFileSync(`${out}/${id}.pdf`, bytes);
  console.log(id, `pages=${c.pageCount} density=${c.density.toFixed(3)} fill=${c.lastFill.toFixed(2)} ${c.ms.toFixed(1)}ms ${bytes.length}B`);
}
