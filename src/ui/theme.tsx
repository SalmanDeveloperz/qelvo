import { useEffect, useRef, useState } from "react";

export type ThemeId = "dark" | "light" | "hacker" | "ocean" | "forest";

export const THEMES: { id: ThemeId; label: string; swatch: [string, string] }[] = [
  { id: "dark", label: "Dark", swatch: ["#13151b", "#ffb547"] },
  { id: "light", label: "Light", swatch: ["#fbfaf7", "#d97a00"] },
  { id: "hacker", label: "Hacker", swatch: ["#050505", "#ff2e3a"] },
  { id: "ocean", label: "Ocean", swatch: ["#0d1729", "#4da3ff"] },
  { id: "forest", label: "Forest", swatch: ["#0b1810", "#39d98a"] },
];

const KEY = "qelvo-theme";

/** One line of personality when you switch. Short enough to read in the second it's up. */
const VIBES: Record<ThemeId, [string, string]> = {
  dark: ["dark mode, it's giving focus", "🖤"],
  light: ["light mode, main character", "☀️"],
  hacker: ["hacker mode, we're in", "🔴"],
  ocean: ["ocean mode, zero stress", "🌊"],
  forest: ["forest mode, touch grass", "🌿"],
};

/** Stored choice, else the system's light/dark preference. Storage can be unavailable (private mode). */
export function initialTheme(): ThemeId {
  try {
    const v = localStorage.getItem(KEY) as ThemeId | null;
    if (v && THEMES.some((t) => t.id === v)) return v;
  } catch { /* ignore */ }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(t: ThemeId) {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", THEMES.find((x) => x.id === t)!.swatch[0]);
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
}

const HINTED = "qelvo-theme-hinted";
const hinted = () => { try { return localStorage.getItem(HINTED) === "1"; } catch { return true; } };
const markHinted = () => { try { localStorage.setItem(HINTED, "1"); } catch { /* ignore */ } };

/**
 * The five moods as a row of dots, so it's obvious there's more than one. `compact` (the
 * editor's crowded top bar) shows the current mood and opens the row on click. On a first
 * visit the dots do one small wave after a few seconds; it never happens again.
 */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeId>(() => (document.documentElement.dataset.theme as ThemeId) || initialTheme());
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState<{ id: ThemeId; n: number } | null>(null);
  const [hint, setHint] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pop) return;
    const t = window.setTimeout(() => setPop(null), 1900);
    return () => window.clearTimeout(t);
  }, [pop]);
  useEffect(() => {
    if (compact || hinted()) return;
    const show = window.setTimeout(() => { setHint(true); markHinted(); }, 4500);
    const hide = window.setTimeout(() => setHint(false), 9000);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [compact]);
  const pick = (id: ThemeId) => {
    markHinted();
    setHint(false);
    setTheme(id);
    setOpen(false);
    setPop((p) => ({ id, n: (p?.n ?? 0) + 1 }));
  };
  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const cur = THEMES.find((t) => t.id === theme)!;
  const dots = (
    <div className={`theme-dots ${hint ? "hint" : ""}`} role="radiogroup" aria-label="Colour mood">
      {THEMES.map((t, i) => (
        <button key={t.id} role="radio" aria-checked={t.id === theme} aria-label={`${t.label} mood`} data-label={t.label}
          className={`dot ${t.id === theme ? "on" : ""}`} style={{ "--i": i } as React.CSSProperties} onClick={() => pick(t.id)}>
          <Swatch s={t.swatch} />
        </button>
      ))}
    </div>
  );
  return (
    <div className={`theme-picker ${compact ? "compact" : ""}`} ref={ref}>
      {compact ? (
        <button className="theme-btn" onClick={() => setOpen(!open)} title={`Mood: ${cur.label}. Click for others`} aria-label="Change colour mood" aria-expanded={open}>
          <Swatch s={cur.swatch} />
        </button>
      ) : dots}
      {compact && open && <div className="theme-menu">{dots}</div>}
      {hint && <span className="theme-hint" aria-hidden>psst, five moods to pick from</span>}
      {pop && !open && (
        <div key={pop.n} className="theme-pop" role="status">
          <Swatch s={THEMES.find((t) => t.id === pop.id)!.swatch} />
          {VIBES[pop.id][0]} <span className="spark">{VIBES[pop.id][1]}</span>
        </div>
      )}
    </div>
  );
}

const Swatch = ({ s }: { s: [string, string] }) => (
  <span className="swatch" style={{ background: `linear-gradient(135deg, ${s[0]} 50%, ${s[1]} 50%)` }} />
);
