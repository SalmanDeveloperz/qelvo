// Import accuracy suite: real resumes + a generated corpus of layouts.
//   npx tsx tests/import.test.ts [filter] [-v]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { extractPdf } from "../src/import/extract";
import { parseHeuristic } from "../src/import/heuristic";
import { toResume } from "../src/import";
import { sampleAcademic, sampleBlueprintRef, sampleClassic, sampleModern } from "../src/model/samples";
import type { Resume } from "../src/model/types";
import { nodePdf } from "./node-pdf";
import { score } from "./compare";
import { withPrivate } from "../scripts/private";

interface Case { name: string; file: string; truth: () => Resume; min: number }

/** The original Resume 1 has a typo ("May 2023– Sep 2023"); the importer is expected to fix it. */
const classicFixed = () => {
  const r = sampleClassic();
  r.sections[1].entries[2].date = "May 2023 – Sep 2023";
  return r;
};

const cases: Case[] = [
  { name: "real: Salman_Resume 2 (ReportLab, 2-col)", file: "fixtures/Salman_Resume 2.pdf", truth: sampleModern, min: 100 },
  { name: "real: Resume 3 (LaTeX, 2-col)", file: "fixtures/Resume 3.pdf", truth: sampleAcademic, min: 100 },
  { name: "real: Muhammad_Salman 1 (LaTeX, 1-col)", file: "fixtures/Muhammad_Salman 1.pdf", truth: classicFixed, min: 100 },
  { name: "real: Template 4 (LaTeX, Source Sans)", file: "fixtures/template4.pdf", truth: sampleBlueprintRef, min: 100 },
];

// Private real-world cases: fixtures/truth/<name>.ts exporting a truth function, next to
// fixtures/<name>.pdf. fixtures/ is git-ignored, so people's resumes never reach the repo.
const privateDir = "fixtures/truth";
if (fs.existsSync(privateDir)) {
  for (const f of fs.readdirSync(privateDir).filter((x) => x.endsWith(".ts")).sort()) {
    const base = f.replace(/\.ts$/, "");
    const mod = await import(pathToFileURL(path.resolve(privateDir, f)).href);
    const truth = (mod[base] ?? mod.default) as (() => Resume) | undefined;
    if (truth) cases.push({ name: `private: ${base}`, file: `fixtures/${base}.pdf`, truth, min: 100 });
  }
}

// Generated corpus: tests/corpus/*.pdf|docx with a sibling *.json truth (see tests/gen_corpus.py).
const corpusDir = "tests/corpus";
if (fs.existsSync(corpusDir)) {
  for (const f of fs.readdirSync(corpusDir).filter((x) => /\.(pdf|docx)$/.test(x)).sort()) {
    const truthFile = path.join(corpusDir, f.replace(/\.(pdf|docx)$/, ".json"));
    if (!fs.existsSync(truthFile)) continue;
    cases.push({ name: `corpus: ${f}`, file: path.join(corpusDir, f), truth: () => JSON.parse(fs.readFileSync(truthFile, "utf8")), min: 100 });
  }
}

const filter = process.argv.slice(2).find((a) => !a.startsWith("-"));
const verbose = process.argv.includes("-v");
let failed = 0;
let total = 0;
let correct = 0;
for (const c of cases) {
  if (filter && !c.name.includes(filter)) continue;
  if (!fs.existsSync(c.file)) { console.log(`skip  ${c.name} (missing ${c.file})`); continue; }
  const buf = fs.readFileSync(c.file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const x = c.file.endsWith(".docx") ? await (await import("../src/import/docx")).extractDocx(ab) : await extractPdf(ab, nodePdf);
  const got = toResume(parseHeuristic(x), { template: "modern", pages: 1, paper: "letter" });
  const s = score(withPrivate(c.truth()), got);
  total += s.fields;
  correct += s.correct;
  const pass = s.pct >= c.min - 1e-9;
  if (!pass) failed++;
  console.log(`${pass ? "pass" : "FAIL"}  ${s.pct.toFixed(1).padStart(5)}%  ${String(s.correct).padStart(3)}/${String(s.fields).padEnd(3)}  ${c.name}`);
  if (!pass || verbose) for (const d of s.diffs.slice(0, verbose ? 60 : 12)) console.log(`      · ${d}`);
}
console.log(`\n${failed ? `${failed} FAILED` : "all passed"}: ${correct}/${total} fields (${((100 * correct) / Math.max(1, total)).toFixed(2)}%)`);
process.exit(failed ? 1 : 0);
