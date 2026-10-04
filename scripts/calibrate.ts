// Regression check against the original PDFs the templates were calibrated on.
//   npm run calibrate            (expects fixtures/*.pdf: the originals, git-ignored)
// Renders each sample, then diffs every line's baseline and x position with scripts/compare.py.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { REFERENCE as SAMPLES } from "../src/model/samples";
import { ALL_FONTS, compile, renderPdf } from "../src/engine";
import { nodeBook } from "./node-fonts";
import { withPrivate } from "./private";

const PAIRS: [keyof typeof SAMPLES, string][] = [
  ["modern", "fixtures/Salman_Resume 2.pdf"],
  ["academic", "fixtures/Resume 3.pdf"],
  ["classic", "fixtures/Muhammad_Salman 1.pdf"],
  ["blueprint", "fixtures/template4.pdf"],
];

fs.mkdirSync("out", { recursive: true });
const book = nodeBook();
await book.load(ALL_FONTS);
for (const [id, original] of PAIRS) {
  const r = withPrivate(SAMPLES[id]());
  const c = compile(r, book);
  fs.writeFileSync(`out/${id}.pdf`, await renderPdf(r, book, c));
  if (!fs.existsSync(original)) { console.log(`${id}: rendered (no original at ${original} to compare)`); continue; }
  const report = execFileSync("python", ["scripts/compare.py", original, `out/${id}.pdf`, `out/${id}-overlay.png`], { encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
  const flagged = report.split("\n").filter((l) => l.startsWith("!!")).length;
  console.log(`${id.padEnd(9)} ${report.trim().split("\n").pop()}  flagged=${flagged}  (overlay: out/${id}-overlay.png)`);
}
