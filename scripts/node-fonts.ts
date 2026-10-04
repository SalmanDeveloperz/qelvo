import fs from "node:fs";
import path from "node:path";
import { FontBook } from "../src/engine/fonts";
export const nodeBook = () => new FontBook(async (p) => new Uint8Array(fs.readFileSync(path.join("public/fonts", p))));
