
type PdfJs = typeof import("../import/pdfjs");
let pdfjsP: Promise<PdfJs> | null = null;
export const loadPdfJs = () => (pdfjsP ??= import("../import/pdfjs"));

/** Render one page of a PDF into a canvas at a given CSS width (crisp on HiDPI). */
/**
 * Render one page into a canvas sized for `cssWidth` CSS pixels. `oversample` adds resolution
 * beyond the screen's own (crisp hairlines and small type, and headroom for browser zoom),
 * capped so a page never exceeds ~16 megapixels.
 */
export async function drawPage(doc: import("pdfjs-dist").PDFDocumentProxy, index: number, canvas: HTMLCanvasElement, cssWidth: number, oversample = 1) {
  const page = await doc.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 3) * oversample;
  const want = (cssWidth / base.width) * dpr;
  const scale = Math.min(want, Math.sqrt(16e6 / (base.width * base.height)));
  const vp = page.getViewport({ scale });
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // "print" intent renders without requestAnimationFrame, so background tabs still finish.
  await page.render({ canvas, canvasContext: ctx, viewport: vp, intent: "print" } as any).promise;
}

export async function openPdf(bytes: Uint8Array) {
  const pdfjs = await loadPdfJs();
  // pdf.js takes ownership of the buffer; hand it a copy.
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
}

export function download(bytes: Uint8Array | string, filename: string, type: string) {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const fileBase = (name: string) => (name.trim() || "Resume").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "") + "_Resume";
