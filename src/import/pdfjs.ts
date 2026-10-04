// pdf.js, wired for Vite (browser): loaded lazily so the landing page stays light.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
// One worker for every document, started as soon as this module loads (setup warms it up),
// so the editor's first page doesn't wait for pdf.js to boot.
if (typeof Worker !== "undefined") {
  try { pdfjs.GlobalWorkerOptions.workerPort = new Worker(workerUrl, { type: "module" }); } catch { /* falls back to workerSrc */ }
}

export const getDocument = pdfjs.getDocument;
export { workerUrl };
export type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
