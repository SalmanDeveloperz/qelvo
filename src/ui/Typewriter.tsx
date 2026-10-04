import { useEffect, useState } from "react";

/**
 * Types each line character by character, holds it, erases it, then moves on. The jitter
 * on each keystroke keeps it from looking like a metronome. With reduced motion, lines
 * swap whole instead of being typed.
 */
export function useTypewriter(lines: readonly string[], { type = 42, erase = 18, hold = 2300, gap = 380 } = {}) {
  const [pos, setPos] = useState({ line: 0, chars: 0 });
  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let line = 0;
    let chars = 0;
    let phase: "type" | "erase" = "type";
    let timer = 0;
    const tick = () => {
      const full = lines[line];
      if (phase === "type") {
        chars = still ? full.length : chars + 1;
        setPos({ line, chars });
        if (chars < full.length) timer = window.setTimeout(tick, type * (0.6 + Math.random() * 0.9));
        else { phase = "erase"; timer = window.setTimeout(tick, hold); }
        return;
      }
      chars = still ? 0 : chars - 1;
      if (chars > 0) { setPos({ line, chars }); timer = window.setTimeout(tick, erase); return; }
      line = (line + 1) % lines.length;
      phase = "type";
      setPos({ line, chars: 0 });
      timer = window.setTimeout(tick, gap);
    };
    timer = window.setTimeout(tick, 500);
    return () => window.clearTimeout(timer);
  }, [lines, type, erase, hold, gap]);
  return { line: pos.line, text: lines[pos.line].slice(0, pos.chars) };
}
