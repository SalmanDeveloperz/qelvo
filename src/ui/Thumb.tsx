import { useEffect, useRef, useState } from "react";
import type { TemplateId } from "../model/types";
import { drawPage, openPdf, samplePdf } from "./pdf";

/** A live-rendered first page of a template's showcase sample (Letter or A4, whichever it uses). */
export function Thumb({ id, width, onReady }: { id: TemplateId; width: number; onReady?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [ratio, setRatio] = useState(792 / 612);
  useEffect(() => {
    let dead = false;
    (async () => {
      const bytes = await samplePdf(id);
      const doc = await openPdf(bytes);
      if (dead || !ref.current) return;
      await drawPage(doc, 0, ref.current, width, 1.25);
      if (dead) return;
      setRatio(ref.current.height / ref.current.width);
      setReady(true);
      onReady?.();
    })().catch(() => {});
    return () => { dead = true; };
  }, [id, width]);
  return (
    <canvas
      ref={ref}
      style={{ width, height: width * ratio, opacity: ready ? 1 : 0, transition: "opacity .4s", background: "#fff" }}
      aria-label={`${id} template preview`}
    />
  );
}
