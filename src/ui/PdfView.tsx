import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Box, CompileResult } from "../engine/client";
import { drawPage, openPdf } from "./pdf";
import { IFit, IMinus, IPlus } from "./icons";

const PX = 96 / 72;

export function PdfView({ result, highlight, onLocate, target }: { result: CompileResult | null; highlight: string | null; onLocate: (src: string) => void; target: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(800);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [hover, setHover] = useState<Box | null>(null);
  const info = result?.info;
  const W = info?.width ?? 612;
  const H = info?.height ?? 792;
  const scale = zoom === "fit" ? Math.max(0.3, Math.min(2.2, (avail - 56) / (W * PX))) : zoom;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Render off-screen, then swap: the preview never blanks while you type.
  const renderSeq = useRef(0);
  useEffect(() => {
    if (!result) return;
    const seq = ++renderSeq.current;
    const t = setTimeout(async () => {
      const doc = await openPdf(result.pdf);
      const out: HTMLCanvasElement[] = [];
      for (let i = 0; i < doc.numPages; i++) {
        const c = document.createElement("canvas");
        // Render at the page's on-screen size (pt → CSS px) × device pixels, not in points:
        // rendering in points drew at 75% and let the browser upscale (blurry text).
        await drawPage(doc, i, c, W * scale * PX, 1.25);
        if (seq !== renderSeq.current) { doc.loadingTask.destroy(); return; }
        out.push(c);
      }
      doc.loadingTask.destroy();
      if (seq === renderSeq.current) setPages(out);
    }, 0);
    return () => clearTimeout(t);
  }, [result, scale, W]);

  const boxesByPage = useMemo(() => {
    const m = new Map<number, Box[]>();
    for (const b of result?.boxes ?? []) (m.get(b.page) ?? m.set(b.page, []).get(b.page)!).push(b);
    return m;
  }, [result]);

  const hit = (page: number, e: React.MouseEvent<HTMLDivElement>): Box | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / (scale * PX);
    const y = (e.clientY - r.top) / (scale * PX);
    const list = boxesByPage.get(page) ?? [];
    let best: Box | null = null;
    for (const b of list) {
      if (x >= b.x - 1.5 && x <= b.x + b.w + 1.5 && y >= b.y - 1.5 && y <= b.y + b.h + 1.5) {
        if (!best || b.w * b.h < best.w * best.h) best = b;
      }
    }
    return best;
  };

  const hl = highlight;
  const s = scale * PX;
  return (
    <div className="pane-body viewer" ref={scroller}>
      <div className="pages-wrap">
        {!result && <div className="empty-state">typesetting…</div>}
        {pages.map((canvas, i) => (
          <div
            key={i}
            className="pdf-page"
            style={{ width: W * s, height: H * s, cursor: hover?.page === i ? "pointer" : "default" }}
            onMouseMove={(e) => setHover(hit(i, e))}
            onMouseLeave={() => setHover(null)}
            onClick={(e) => { const b = hit(i, e); if (b) onLocate(b.src); }}
          >
            <div style={{ width: "100%", height: "100%" }} ref={(el) => { if (el && el.firstChild !== canvas) el.replaceChildren(canvas); }} />
            {hl && (boxesByPage.get(i) ?? []).filter((b) => b.src === hl || b.src.startsWith(hl + ".")).map((b, k) => (
              <div key={k} className="hl" style={{ left: (b.x - 1.5) * s, top: (b.y - 0.5) * s, width: (b.w + 3) * s, height: (b.h + 1) * s }} />
            ))}
            {hover?.page === i && <div className="hover" style={{ left: (hover.x - 1.5) * s, top: (hover.y - 0.5) * s, width: (hover.w + 3) * s, height: (hover.h + 1) * s }} />}
            {i >= target && (
              <div className="limit" style={{ top: 0 }}><span>beyond your {target}-page target</span></div>
            )}
            <div className="page-no">{i + 1} / {pages.length}</div>
          </div>
        ))}
      </div>
      <ZoomBar zoom={zoom} scale={scale} setZoom={setZoom} />
    </div>
  );
}

function ZoomBar({ zoom, scale, setZoom }: { zoom: number | "fit"; scale: number; setZoom: (z: number | "fit") => void }) {
  return (
    <div style={{ position: "sticky", bottom: 14, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div className="viewer-tools" style={{ pointerEvents: "auto", margin: 0, background: "rgba(19,21,27,.92)", border: "1px solid var(--line-2)", borderRadius: 10, padding: 3, backdropFilter: "blur(6px)" }}>
        <button className="icon-btn" title="Zoom out" onClick={() => setZoom(Math.max(0.4, scale / 1.15))}><IMinus /></button>
        <span className="zoom">{Math.round(scale * 100)}%</span>
        <button className="icon-btn" title="Zoom in" onClick={() => setZoom(Math.min(3, scale * 1.15))}><IPlus /></button>
        <button className={`icon-btn ${zoom === "fit" ? "on" : ""}`} title="Fit width" onClick={() => setZoom("fit")}><IFit /></button>
      </div>
    </div>
  );
}
