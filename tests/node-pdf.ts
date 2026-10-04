// pdf.js under Node for tests (same extraction code as the browser).
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
export const nodePdf = pdfjs as any;
