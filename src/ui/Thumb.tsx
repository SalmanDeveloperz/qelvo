import { useEffect, useRef } from "react";
import type { TemplateId } from "../model/types";
import { THUMB_RATIO, THUMB_WIDTHS } from "./thumbs.gen";

/**
 * A template's showcase page, pre-rendered by `npm run thumbs` (scripts/thumbs.ts). Static
 * images mean the landing and setup pages never load the typesetter or pdf.js.
 */
export function Thumb({ id, width, onReady, priority, lazy }: {
  id: TemplateId; width: number; onReady?: () => void; priority?: boolean; lazy?: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);
  // Report ready only once decoded, so a cross-fade never reveals a half-painted page.
  const ready = (img: HTMLImageElement) => { if (onReady) void img.decode().then(onReady, onReady); };
  // A cached image can finish before React attaches onLoad.
  useEffect(() => { const img = ref.current; if (img?.complete && img.naturalWidth) ready(img); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const src = (w: number) => `/thumbs/${id}-${w}.webp`;
  return (
    <img
      ref={ref}
      src={src(THUMB_WIDTHS[0])}
      srcSet={THUMB_WIDTHS.map((w) => `${src(w)} ${w}w`).join(", ")}
      sizes={`${width}px`}
      width={width}
      height={Math.round(width * THUMB_RATIO[id])}
      alt={`${id} template preview`}
      decoding="async"
      loading={lazy ? "lazy" : "eager"}
      fetchPriority={priority ? "high" : "auto"}
      onLoad={(e) => ready(e.currentTarget)}
      draggable={false}
      style={{ display: "block", width, height: "auto", background: "#fff" }}
    />
  );
}
