import { REFERENCE as SAMPLES } from "../src/model/samples";
import { parse, serialize } from "../src/source/latex";
const strip = (r: any) => JSON.parse(JSON.stringify(r, (k, v) => (k === "id" ? undefined : v)));
let ok = true;
for (const [id, make] of Object.entries(SAMPLES)) {
  const r = make();
  const a = serialize(r);
  const p = parse(a.code);
  const b = serialize(p.resume);
  const same = JSON.stringify(strip(r)) === JSON.stringify(strip(p.resume));
  console.log(id, "lines", a.code.split("\n").length, "diags", p.diagnostics.length, "model-equal", same, "code-equal", a.code === b.code);
  if (!same) {
    const x = JSON.stringify(strip(r), null, 1).split("\n"), y = JSON.stringify(strip(p.resume), null, 1).split("\n");
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) { console.log(" first diff @", i, x[i], "<>", y[i]); break; }
    ok = false;
  }
  p.diagnostics.forEach((d) => console.log("  ", d));
  if (id === "modern") console.log(a.code.split("\n").slice(0, 48).join("\n"));
}
process.exit(ok ? 0 : 1);
