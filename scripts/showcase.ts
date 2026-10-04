// Render the gallery showcase in every template: npx tsx scripts/showcase.ts outDir
import fs from "node:fs";
import { SAMPLES } from "../src/model/samples";
import { ALL_FONTS, compile, renderPdf } from "../src/engine";
import { nodeBook } from "./node-fonts";
const out = process.argv[2] ?? "out/showcase";
fs.mkdirSync(out, { recursive: true });
const book = nodeBook();
await book.load(ALL_FONTS);
for (const [id, make] of Object.entries(SAMPLES)) {
  const r = make();
  const c = compile(r, book);
  fs.writeFileSync(`${out}/${id}.pdf`, await renderPdf(r, book, c));
  console.log(id, `pages=${c.pageCount} density=${c.density.toFixed(2)} overflow=${c.overflow}`);
}
