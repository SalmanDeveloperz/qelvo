// pdf.js, wired for Vite (browser): loaded lazily so the landing page stays light.
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const getDocument = pdfjs.getDocument;
export type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
