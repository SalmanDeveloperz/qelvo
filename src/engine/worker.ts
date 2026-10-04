/// <reference lib="webworker" />
// Typesetting + PDF writing off the main thread.
import { FontBook } from "./fonts";
import { TEMPLATES, compile, renderPdf } from "./index";
import type { Resume } from "../model/types";

export interface Box { page: number; x: number; y: number; w: number; h: number; src: string }
export interface CompileInfo { pageCount: number; target: number; density: number; overflow: boolean; lastFill: number; ms: number; width: number; height: number }
export type WorkerIn = { id: number; resume: Resume };
export type WorkerOut =
  | { id: number; ok: true; pdf: Uint8Array; info: CompileInfo; boxes: Box[] }
  | { id: number; ok: false; error: string };

const book = new FontBook(async (p) => {
  const res = await fetch(new URL(`/fonts/${p}`, self.location.origin));
  if (!res.ok) throw new Error(`Font ${p}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
});

self.onmessage = async (ev: MessageEvent<WorkerIn>) => {
  const { id, resume } = ev.data;
  try {
    const t0 = performance.now();
    await book.load(TEMPLATES[resume.template].fonts);
    const c = compile(resume, book);
    const pdf = await renderPdf(resume, book, c);
    const boxes: Box[] = [];
    c.layout.pages.forEach((p, pi) => {
      for (const it of p.items) {
        if (it.t !== "text" || !it.src) continue;
        const w = book.width(it.font, it.text, it.size, it.shaping);
        boxes.push({ page: pi, x: it.x, y: it.y - it.size * 0.8, w, h: it.size * 1.05, src: it.src });
      }
    });
    const info: CompileInfo = {
      pageCount: c.pageCount, target: c.target, density: c.density, overflow: c.overflow, lastFill: c.lastFill,
      ms: performance.now() - t0, width: c.layout.width, height: c.layout.height,
    };
    (self as unknown as Worker).postMessage({ id, ok: true, pdf, info, boxes } satisfies WorkerOut, [pdf.buffer]);
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: e instanceof Error ? e.message : String(e) } satisfies WorkerOut);
  }
};
