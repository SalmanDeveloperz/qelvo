// Debug: print extracted segments of a PDF.  npx tsx tests/dump.ts file.pdf
import fs from "node:fs";
import { extractPdf } from "../src/import/extract";
import { nodePdf } from "./node-pdf";
const buf = fs.readFileSync(process.argv[2]);
const x = await extractPdf(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), nodePdf);
console.log("columns:", x.columns, "pages:", x.pages);
for (const s of x.segs) console.log(`p${s.page} c${s.col} y${s.y.toFixed(1).padStart(6)} x${s.x0.toFixed(0).padStart(4)}-${s.x1.toFixed(0).padStart(3)} ${s.size.toFixed(1)}${s.bold ? "B" : " "}${s.italic ? "I" : " "} | ${s.text.slice(0, 110)}${s.right ? "  >>> " + s.right.text : ""}`);
