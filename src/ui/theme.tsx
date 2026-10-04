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

/** A compact swatch button that opens the five themes. */
export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId>(() => (document.documentElement.dataset.theme as ThemeId) || initialTheme());
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState<{ id: ThemeId; n: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!pop) return;
    // Restart the bounce on the same element (re-adding the class after a reflow).
    const b = btn.current;
    if (b) { b.classList.remove("boing"); void b.offsetWidth; b.classList.add("boing"); }
    const t = window.setTimeout(() => setPop(null), 1900);
    return () => window.clearTimeout(t);
  }, [pop]);
  const pick = (id: ThemeId) => {
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
  return (
    <div className="theme-picker" ref={ref}>
      <button ref={btn} className="theme-btn" onClick={() => setOpen(!open)} title={`Theme: ${cur.label}`} aria-label="Change theme">
        <Swatch s={cur.swatch} />
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {THEMES.map((t) => (
            <button key={t.id} role="menuitemradio" aria-checked={t.id === theme} className={t.id === theme ? "on" : ""} onClick={() => pick(t.id)}>
              <Swatch s={t.swatch} /> {t.label}
            </button>
          ))}
        </div>
      )}
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
