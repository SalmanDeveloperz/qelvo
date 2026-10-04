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
  const ref = useRef<HTMLDivElement>(null);
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
      <button className="theme-btn" onClick={() => setOpen(!open)} title={`Theme: ${cur.label}`} aria-label="Change theme">
        <Swatch s={cur.swatch} />
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {THEMES.map((t) => (
            <button key={t.id} role="menuitemradio" aria-checked={t.id === theme} className={t.id === theme ? "on" : ""} onClick={() => { setTheme(t.id); setOpen(false); }}>
              <Swatch s={t.swatch} /> {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Swatch = ({ s }: { s: [string, string] }) => (
  <span className="swatch" style={{ background: `linear-gradient(135deg, ${s[0]} 50%, ${s[1]} 50%)` }} />
);
