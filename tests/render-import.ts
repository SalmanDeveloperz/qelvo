// Import a resume file and render it in every template:  npx tsx tests/render-import.ts file.pdf outDir
import fs from "node:fs";
import { extractPdf } from "../src/import/extract";
import { parseHeuristic } from "../src/import/heuristic";
import { toResume } from "../src/import";
import { ALL_FONTS, compile, renderPdf } from "../src/engine";
import { nodeBook } from "../scripts/node-fonts";
import { nodePdf } from "./node-pdf";
const [file, out = "out"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = fs.readFileSync(file);
const x = file.endsWith(".docx") ? await (await import("../src/import/docx")).extractDocx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) : await extractPdf(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), nodePdf);
const book = nodeBook();
await book.load(ALL_FONTS);
for (const t of ["modern", "academic", "classic"] as const) {
  for (const pages of [1, 2] as const) {
    const r = toResume(parseHeuristic(x), { template: t, pages, paper: "a4" });
    const c = compile(r, book);
    fs.writeFileSync(`${out}/${t}-${pages}p.pdf`, await renderPdf(r, book, c));
    console.log(`${t} target=${pages}: pages=${c.pageCount} density=${c.density.toFixed(2)} overflow=${c.overflow}`);
  }
}
