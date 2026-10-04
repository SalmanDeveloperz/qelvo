// The reference PDFs carry real contact details; the samples in the repo use placeholders.
// fixtures/private.json (git-ignored) maps each placeholder to the real text, so local
// calibration and import tests still compare like with like. Without it, nothing changes.
import fs from "node:fs";
import type { Resume } from "../src/model/types";

const FILE = "fixtures/private.json";
const map: Record<string, string> = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};

export function withPrivate(r: Resume): Resume {
  let s = JSON.stringify(r);
  for (const [placeholder, real] of Object.entries(map)) s = s.split(placeholder).join(real);
  return JSON.parse(s);
}
