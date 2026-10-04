import fs from "node:fs";
import fontkit from "@pdf-lib/fontkit";
const f: any = fontkit.create(fs.readFileSync("public/fonts/ssp/SourceSansPro-Regular.ttf") as any);
const H = f.layout("H").glyphs[0].bbox;
const scH = f.layout("h", { smcp: true }).glyphs[0];
const capH = f.layout("H").glyphs[0];
console.log("cap", H.maxY, "sc", scH.bbox.maxY, "ratio", (scH.bbox.maxY / H.maxY).toFixed(3), "adv sc h", scH.advanceWidth, "cap H adv", capH.advanceWidth);
