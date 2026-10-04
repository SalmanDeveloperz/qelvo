// Diagnostics smoke test: npx tsx scripts/parse-errors.ts
import { SAMPLES } from "../src/model/samples";
import { parse, serialize } from "../src/source/latex";

const code = serialize(SAMPLES.modern()).code;
const lineOf = (src: string, needle: string) => src.split("\n").findIndex((l) => l.includes(needle)) + 1;
const show = (label: string, src: string) => console.log(label.padEnd(22), JSON.stringify(parse(src).diagnostics));

const broken = code.replace("\\entry{Hywiz", "\\entry{{Hywiz");
show(`unclosed (line ${lineOf(broken, "\\entry{{Hywiz")})`, broken);
show("bad template", code.replace("\\template{modern}", "\\template{fancy}"));
show("bad pages", code.replace("\\pages{1}", "\\pages{4}"));
show("unknown command", code.replace("\\end{document}", "\\foo{bar}\n\\end{document}"));
show("item before section", "\\name{A}\n\\item stray\n\\section{Skills}\n\\skill{X}{Y}\n");
