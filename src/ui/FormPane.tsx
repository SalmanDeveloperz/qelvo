import { memo, useLayoutEffect, useRef, useState } from "react";
import { FA } from "../engine/fa";
import { PROFILE_KINDS, TEMPLATE_META as TEMPLATES } from "../engine/meta";
import { ROLE_TITLE, ROLE_TYPE, bullet, contact, entry, item, section, skill } from "../model/factory";
import type { ColumnPref, Contact, ContactKind, Entry, Resume, Section, SectionRole } from "../model/types";
import { move, setIn, store, updateList, useStore } from "../state";
import { nameWords, resetNameStyle, toggleNameWord } from "./nameStyle";
import { IChevron, ICopy, IDown, ILink, IPlus, ITrash, IUp, IX } from "./icons";

type Focus = (path: string | null) => void;

const AUTO_SIZE = typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content");

// ── Primitive field ───────────────────────────────────────────────────

function Field({ path, value, label, placeholder, multiline, className, onFocus, mono }: {
  path: string; value: string; label?: string; placeholder?: string; multiline?: boolean; className?: string; onFocus: Focus; mono?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    // CSS sizes it where supported; measuring every textarea in JS forces a layout per field.
    if (!el || AUTO_SIZE) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  const change = (v: string) => store.edit((r) => {
    const next = setIn(r, path, v);
    // Typing ** into the name opts it out of the template's default weights.
    return path === "name" && /\*/.test(v) && r.nameStyle !== "custom" ? { ...next, nameStyle: "custom" } : next;
  }, path);
  const common = {
    "data-path": path,
    "data-markup": mono ? undefined : "1",
    placeholder,
    value,
    spellCheck: !mono,
    onFocus: () => onFocus(path),
    onBlur: () => onFocus(null),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (mono || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k !== "b" && k !== "i") return;
      e.preventDefault();
      if (path === "name") toggleNameAtCaret(e.currentTarget, k === "b" ? "bold" : "italic");
      else applyMarkup(e.currentTarget, k === "b" ? "**" : "*");
    },
    style: mono ? { fontFamily: "var(--mono)", fontSize: 12.5 } : undefined,
  };
  const input = multiline ? (
    <textarea ref={ref} rows={1} className={`textarea ${className ?? ""}`} {...common} onChange={(e) => change(e.target.value)} />
  ) : (
    <input className={`input ${className ?? ""}`} {...common} onChange={(e) => change(e.target.value)} />
  );
  if (!label) return input;
  return (
    <div className="field">
      <label>{label}</label>
      {input}
    </div>
  );
}

/**
 * Toggle **bold** / *italic* around the selection of a form field (or insert an empty
 * pair at the caret). Works from Ctrl/⌘+B / +I and from the B / I toolbar buttons.
 */
export function applyMarkup(el: HTMLInputElement | HTMLTextAreaElement, mark: "**" | "*") {
  const path = el.dataset.path;
  if (!path || !el.dataset.markup) return;
  if (path === "name") return toggleNameAtCaret(el, mark === "**" ? "bold" : "italic");
  const v = el.value;
  let s = el.selectionStart ?? v.length;
  let e = el.selectionEnd ?? s;
  // Select the word under the caret when nothing is selected: what people expect from Ctrl+B.
  if (s === e) {
    while (s > 0 && /[\p{L}\p{N}_'-]/u.test(v[s - 1])) s--;
    while (e < v.length && /[\p{L}\p{N}_'-]/u.test(v[e])) e++;
  }
  const sel = v.slice(s, e);
  const n = mark.length;
  const isBoldWrap = (a: string, b: string) => (mark === "**" ? a.endsWith("**") && b.startsWith("**") : a.endsWith("*") && !a.endsWith("**") && b.startsWith("*") && !b.startsWith("**"));
  let next: string;
  let ns: number;
  let ne: number;
  if (isBoldWrap(v.slice(0, s), v.slice(e))) {
    next = v.slice(0, s - n) + sel + v.slice(e + n);
    ns = s - n;
    ne = e - n;
  } else if (sel.startsWith(mark) && sel.endsWith(mark) && sel.length >= 2 * n && (mark === "**" || !sel.startsWith("**"))) {
    next = v.slice(0, s) + sel.slice(n, -n) + v.slice(e);
    ns = s;
    ne = e - 2 * n;
  } else {
    next = v.slice(0, s) + mark + sel + mark + v.slice(e);
    ns = s + n;
    ne = e + n;
  }
  store.edit((r) => setIn(r, path, next));
  requestAnimationFrame(() => {
    const live = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-path="${path}"]`);
    if (!live) return;
    live.focus();
    live.setSelectionRange(ns, ne);
  });
}

/** The name's weight is per word: Ctrl+B flips the word under the caret. */
function toggleNameAtCaret(el: HTMLInputElement | HTMLTextAreaElement, what: "bold" | "italic") {
  const before = el.value.slice(0, el.selectionStart ?? 0).replace(/\*+/g, "");
  const index = before.trimStart().split(/\s+/).length - 1;
  store.edit((r) => (index < nameWords(r).length ? toggleNameWord(r, index, what) : r));
}

// ── Labels that follow the section's meaning ─────────────────────────

const L: Record<SectionRole, { title: string; tph: string; sub: string; sph: string; meta: string; mph: string; link: string; add: string }> = {
  experience: { title: "Company", tph: "Stripe", sub: "Role", sph: "Backend Engineer", meta: "Team or stack (optional)", mph: "Payments · Go, Postgres", link: "Link", add: "Add role" },
  education: { title: "School", tph: "University of Waterloo", sub: "Degree", sph: "BSc Computer Science", meta: "GPA / honours", mph: "GPA: 3.8/4.0", link: "Link", add: "Add school" },
  projects: { title: "Project", tph: "pgwatch", sub: "One-liner (optional)", sph: "Postgres query profiler", meta: "Tech stack", mph: "Rust, Postgres, React", link: "Repo or demo URL", add: "Add project" },
  opensource: { title: "Organisation", tph: "Kubernetes", sub: "Your role", sph: "Contributor", meta: "Repositories", mph: "kubernetes/kubectl", link: "Link to your PRs", add: "Add contribution" },
  awards: { title: "Award", tph: "ICPC Regional Finalist", sub: "What it was for", sph: "Top 3% of 4,000 teams", meta: "Issuer (optional)", mph: "ACM", link: "Link", add: "Add award" },
  certifications: { title: "Certificate", tph: "AWS Solutions Architect", sub: "Issuer", sph: "Amazon Web Services", meta: "Credential ID", mph: "", link: "Verify URL", add: "Add certificate" },
  custom: { title: "Title", tph: "", sub: "Subtitle", sph: "", meta: "Details", mph: "", link: "Link", add: "Add item" },
  summary: { title: "", tph: "", sub: "", sph: "", meta: "", mph: "", link: "", add: "" },
  coursework: { title: "", tph: "", sub: "", sph: "", meta: "", mph: "", link: "", add: "" },
  skills: { title: "", tph: "", sub: "", sph: "", meta: "", mph: "", link: "", add: "" },
};

const ROLE_OPTIONS: SectionRole[] = ["summary", "experience", "opensource", "projects", "education", "skills", "awards", "certifications", "coursework", "custom"];

const CONTACT_KINDS: { k: ContactKind; label: string; ph: string; url: string }[] = [
  { k: "email", label: "Email", ph: "you@example.com", url: "mailto:…" },
  { k: "phone", label: "Phone", ph: "+1 415 555 0134", url: "" },
  { k: "location", label: "Location", ph: "Berlin, Germany", url: "" },
  { k: "linkedin", label: "LinkedIn", ph: "in/handle", url: "https://linkedin.com/in/handle" },
  { k: "github", label: "GitHub", ph: "handle", url: "https://github.com/handle" },
  { k: "twitter", label: "X / Twitter", ph: "@handle", url: "https://x.com/handle" },
  { k: "website", label: "Website", ph: "handle.dev", url: "https://handle.dev" },
  { k: "other", label: "Other", ph: "", url: "" },
];

// ── Pane ─────────────────────────────────────────────────────────────

export const FormPane = memo(function FormPane({ onFocus }: { onFocus: Focus }) {
  const r = useStore((s) => s.resume);
  const notes = useStore((s) => s.importNotes);
  const via = useStore((s) => s.importVia);
  const twoCol = TEMPLATES[r.template].twoColumn;
  return (
    <div className="form">
      {notes.length > 0 && (
        <div className="notes">
          <h4>
            {via === "ai" ? "Imported with AI: what changed" : "Imported offline. Please review"}
            <button className="icon-btn" onClick={() => store.dismissNotes()} title="Dismiss"><IX size={14} /></button>
          </h4>
          <ul>{notes.slice(0, 14).map((n, i) => <li key={i}>{n}</li>)}</ul>
        </div>
      )}
      <HeaderCard r={r} onFocus={onFocus} />
      {r.sections.map((s, i) => (
        <SectionCard key={s.id} s={s} i={i} n={r.sections.length} twoCol={twoCol} onFocus={onFocus} />
      ))}
      <AddSection />
      <div className="markup-hint"><span className="kbd">Ctrl</span>+<span className="kbd">B</span> bold · <span className="kbd">Ctrl</span>+<span className="kbd">I</span> italic in any text field · links: <b>[text](https://url)</b> · <b>--</b> for an en dash · <span className="kbd">Ctrl</span>+<span className="kbd">Z</span> / <span className="kbd">Y</span> undo, redo</div>
    </div>
  );
});

function HeaderCard({ r, onFocus }: { r: Resume; onFocus: Focus }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`card ${open ? "open" : ""}`}>
      <div className="card-head">
        <button className="icon-btn chev" onClick={() => setOpen(!open)}><IChevron /></button>
        <span style={{ fontWeight: 600, flex: 1 }}>Header</span>
      </div>
      {open && (
        <div className="card-body">
          <Field path="name" value={r.name} label="Name" placeholder="Your full name" className="name" onFocus={onFocus} />
          <NameWeight r={r} />
          <Field path="headline" value={r.headline} label="Headline (optional)" placeholder="e.g. Backend Engineer · Distributed Systems" onFocus={onFocus} />
          <div className="field">
            <label>Contact line</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {r.contacts.map((c, i) => (
                <div className="contact-row" key={c.id} data-path={`contacts.${i}`}>
                  <select className="select" value={c.kind} onChange={(e) => store.edit((x) => setIn(x, `contacts.${i}.kind`, e.target.value))}>
                    {CONTACT_KINDS.map((k) => <option key={k.k} value={k.k}>{k.label}</option>)}
                  </select>
                  <IconToggle c={c} i={i} defaultOn={TEMPLATES[r.template].profileIcons && PROFILE_KINDS.has(c.kind)} />
                  <Field path={`contacts.${i}.text`} value={c.text} placeholder={CONTACT_KINDS.find((k) => k.k === c.kind)?.ph || "Shown text"} onFocus={() => onFocus(`contacts.${i}`)} />
                  <Field path={`contacts.${i}.url`} value={c.url} placeholder={CONTACT_KINDS.find((k) => k.k === c.kind)?.url || "Link (optional)"} onFocus={() => onFocus(`contacts.${i}`)} mono />
                  <div style={{ display: "flex" }}>
                    <button className="icon-btn danger" title="Remove" onClick={() => store.edit((x) => updateList(x, "contacts", (a) => a.filter((_, j) => j !== i)))}><IX size={14} /></button>
                  </div>
                </div>
              ))}
              <div className="add-row">
                {CONTACT_KINDS.filter((k) => k.k !== "other").map((k) => (
                  <button key={k.k} className="add-btn" onClick={() => store.edit((x) => updateList(x, "contacts", (a) => [...a, contact(k.k, "", "")]))}><IPlus size={13} /> {k.label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NameWeight({ r }: { r: Resume }) {
  const words = nameWords(r);
  if (!words.length) return null;
  return (
    <div className="weight-row">
      <span className="weight-lbl">Weight</span>
      {words.map((w, i) => (
        <button key={i} className={`wchip ${w.bold ? "on" : ""}`} aria-pressed={w.bold} title={w.bold ? "Bold: click for regular" : "Regular: click for bold"}
          style={{ fontWeight: w.bold ? 700 : 400, fontStyle: w.italic ? "italic" : "normal" }}
          onClick={() => store.edit((x) => toggleNameWord(x, i))}>{w.text}</button>
      ))}
      {r.nameStyle === "custom"
        ? <button className="linkish" onClick={() => store.edit(resetNameStyle)}>Use template default</button>
        : <span className="faint" style={{ fontSize: 12 }}>template default</span>}
    </div>
  );
}

/** Kind → the drawing shown in the PDF (Font Awesome Free, CC BY 4.0). */
const KIND_GLYPH: Record<ContactKind, string> = {
  linkedin: "linkedin", github: "github", twitter: "x-twitter", location: "location-dot",
  phone: "phone6", email: "envelope6", website: "globe6", other: "link6",
};

export function Glyph({ kind, size = 14 }: { kind: ContactKind; size?: number }) {
  const [w, h, d] = FA[KIND_GLYPH[kind]];
  return <svg width={size} height={size} viewBox={`0 0 ${w} ${h}`} fill="currentColor" aria-hidden><path d={d} /></svg>;
}

function IconToggle({ c, i, defaultOn }: { c: Contact; i: number; defaultOn: boolean }) {
  const on = c.icon ?? defaultOn;
  const label = CONTACT_KINDS.find((k) => k.k === c.kind)?.label ?? "contact";
  const flip = () => store.edit((x) => updateList(x, "contacts", (a) => a.map((y, j) => {
    if (j !== i) return y;
    const next = !on;
    const { icon: _, ...rest } = y;
    return next === defaultOn ? rest : { ...rest, icon: next };
  })));
  return (
    <button className={`icon-tog ${on ? "on" : ""}`} role="checkbox" aria-checked={on} onClick={flip}
      title={on ? `${label} icon shown in the PDF: click to hide` : `Show the ${label} icon in the PDF`}>
      <span className="box">{on && <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden><path d="M2 6.5 5 9.2 10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</span>
      <Glyph kind={c.kind} />
    </button>
  );
}

function SectionCard({ s, i, n, twoCol, onFocus }: { s: Section; i: number; n: number; twoCol: boolean; onFocus: Focus }) {
  const [open, setOpen] = useState(true);
  const p = `sections.${i}`;
  const edit = (fn: (sec: Section) => Section) => store.edit((r) => setIn(r, p, fn(r.sections[i])));
  return (
    <div className={`card ${open ? "open" : ""}`} data-path={p}>
      <div className="card-head">
        <button className="icon-btn chev" onClick={() => setOpen(!open)}><IChevron /></button>
        <input className="ttl" data-path={`${p}.title`} value={s.title} onFocus={() => onFocus(`${p}.title`)} onBlur={() => onFocus(null)}
          onChange={(e) => edit((x) => ({ ...x, title: e.target.value }))} />
        <select className="select pill-sel" value={s.role} title="What this section is (drives layout)"
          onChange={(e) => { const role = e.target.value as SectionRole; edit((x) => ({ ...x, role, type: x.type === ROLE_TYPE[x.role] ? ROLE_TYPE[role] : x.type })); }}>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r === "opensource" ? "open source" : r}</option>)}
        </select>
        {twoCol && (
          <select className="select pill-sel" value={s.column} title="Column" onChange={(e) => edit((x) => ({ ...x, column: e.target.value as ColumnPref }))}>
            <option value="auto">auto column</option>
            <option value="main">left column</option>
            <option value="side">right column</option>
          </select>
        )}
        <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => store.edit((r) => ({ ...r, sections: move(r.sections, i, -1) }))}><IUp /></button>
        <button className="icon-btn" title="Move down" disabled={i === n - 1} onClick={() => store.edit((r) => ({ ...r, sections: move(r.sections, i, 1) }))}><IDown /></button>
        <button className="icon-btn danger" title="Delete section" onClick={() => confirm(`Delete “${s.title}”?`) && store.edit((r) => ({ ...r, sections: r.sections.filter((_, j) => j !== i) }))}><ITrash /></button>
      </div>
      {open && (
        <div className="card-body">
          {s.type === "summary" && <Field path={`${p}.text`} value={s.text} multiline placeholder="Two or three sentences: what you build, what you're strongest at, one proof point." onFocus={onFocus} />}
          {s.type === "skills" && <SkillsBody s={s} p={p} onFocus={onFocus} />}
          {s.type === "list" && <ListBody s={s} p={p} onFocus={onFocus} />}
          {s.type === "entries" && <EntriesBody s={s} p={p} onFocus={onFocus} />}
        </div>
      )}
    </div>
  );
}

function SkillsBody({ s, p, onFocus }: { s: Section; p: string; onFocus: Focus }) {
  return (
    <>
      {s.skills.map((k, ki) => (
        <div className="skill-row" key={k.id}>
          <Field path={`${p}.skills.${ki}.label`} value={k.label} placeholder="Languages" onFocus={onFocus} />
          <Field path={`${p}.skills.${ki}.value`} value={k.value} multiline placeholder="Go, Python, TypeScript" onFocus={onFocus} />
          <div style={{ display: "flex" }}>
            <button className="icon-btn" disabled={ki === 0} onClick={() => store.edit((r) => updateList(r, `${p}.skills`, (a) => move(a, ki, -1)))}><IUp /></button>
            <button className="icon-btn danger" onClick={() => store.edit((r) => updateList(r, `${p}.skills`, (a) => a.filter((_, j) => j !== ki)))}><IX size={14} /></button>
          </div>
        </div>
      ))}
      <div className="add-row"><button className="add-btn" onClick={() => store.edit((r) => updateList(r, `${p}.skills`, (a) => [...a, skill()]))}><IPlus size={13} /> Add skill row</button></div>
    </>
  );
}

function ListBody({ s, p, onFocus }: { s: Section; p: string; onFocus: Focus }) {
  return (
    <>
      {s.items.map((it, ii) => (
        <div className="list-row" key={it.id}>
          <Field path={`${p}.items.${ii}.text`} value={it.text} placeholder="Item" onFocus={onFocus} />
          <Field path={`${p}.items.${ii}.link`} value={it.link} placeholder="Link (optional), shown as an icon" mono onFocus={() => onFocus(`${p}.items.${ii}`)} />
          <div style={{ display: "flex" }}>
            <button className="icon-btn" disabled={ii === 0} onClick={() => store.edit((r) => updateList(r, `${p}.items`, (a) => move(a, ii, -1)))}><IUp /></button>
            <button className="icon-btn danger" onClick={() => store.edit((r) => updateList(r, `${p}.items`, (a) => a.filter((_, j) => j !== ii)))}><IX size={14} /></button>
          </div>
        </div>
      ))}
      <div className="add-row"><button className="add-btn" onClick={() => store.edit((r) => updateList(r, `${p}.items`, (a) => [...a, item()]))}><IPlus size={13} /> Add item</button></div>
    </>
  );
}

function EntriesBody({ s, p, onFocus }: { s: Section; p: string; onFocus: Focus }) {
  const lab = L[s.role] ?? L.custom;
  return (
    <>
      {s.entries.map((e, ei) => (
        <EntryCard key={e.id} e={e} ep={`${p}.entries.${ei}`} ei={ei} n={s.entries.length} p={p} lab={lab} onFocus={onFocus} />
      ))}
      <div className="add-row">
        <button className="add-btn" onClick={() => store.edit((r) => updateList(r, `${p}.entries`, (a) => [...a, entry({ bullets: s.role === "education" || s.role === "awards" ? [] : [""] })]))}><IPlus size={13} /> {lab.add}</button>
      </div>
    </>
  );
}

function EntryCard({ e, ep, ei, n, p, lab, onFocus }: { e: Entry; ep: string; ei: number; n: number; p: string; lab: (typeof L)[SectionRole]; onFocus: Focus }) {
  const [showLinks, setShowLinks] = useState(() => e.bullets.some((b) => b.link));
  return (
    <div className="entry" data-path={ep}>
      <div className="entry-head">
        <span className="idx">#{ei + 1}</span>
        <span className="grow" />
        <button className={`icon-btn ${showLinks ? "on" : ""}`} title="Bullet link icons" onClick={() => setShowLinks(!showLinks)} style={showLinks ? { color: "var(--accent)" } : undefined}><ILink size={15} /></button>
        <button className="icon-btn" title="Duplicate" onClick={() => store.edit((r) => updateList(r, `${p}.entries`, (a) => { const c = structuredClone(a[ei]); c.id += "c"; c.bullets.forEach((b: { id: string }) => (b.id += "c")); a.splice(ei + 1, 0, c); return a; }))}><ICopy size={15} /></button>
        <button className="icon-btn" title="Move up" disabled={ei === 0} onClick={() => store.edit((r) => updateList(r, `${p}.entries`, (a) => move(a, ei, -1)))}><IUp /></button>
        <button className="icon-btn" title="Move down" disabled={ei === n - 1} onClick={() => store.edit((r) => updateList(r, `${p}.entries`, (a) => move(a, ei, 1)))}><IDown /></button>
        <button className="icon-btn danger" title="Delete" onClick={() => store.edit((r) => updateList(r, `${p}.entries`, (a) => a.filter((_, j) => j !== ei)))}><ITrash /></button>
      </div>
      <div className="grid2">
        <Field path={`${ep}.title`} value={e.title} label={lab.title} placeholder={lab.tph} onFocus={onFocus} />
        <Field path={`${ep}.subtitle`} value={e.subtitle} label={lab.sub} placeholder={lab.sph} onFocus={onFocus} />
      </div>
      <div className="grid3">
        <Field path={`${ep}.meta`} value={e.meta} label={lab.meta} placeholder={lab.mph} onFocus={onFocus} />
        <Field path={`${ep}.date`} value={e.date} label="Dates" placeholder="Jan 2024 -- Present" onFocus={onFocus} />
        <Field path={`${ep}.location`} value={e.location} label="Location" placeholder="Remote" onFocus={onFocus} />
      </div>
      <Field path={`${ep}.link`} value={e.link} label={lab.link} placeholder="https://github.com/you/repo (shown as an icon)" mono onFocus={onFocus} />
      <div className="bullets">
        {e.bullets.map((b, bi) => (
          <div className="bullet-row" key={b.id}>
            <span className="mark">•</span>
            <Field path={`${ep}.bullets.${bi}.text`} value={b.text} multiline placeholder="Built / cut / shipped X, which did Y (with a real number if you have one)" onFocus={() => onFocus(`${ep}.bullets.${bi}`)} />
            <div className="tools">
              <button className="icon-btn" title="Move up" disabled={bi === 0} onClick={() => store.edit((r) => updateList(r, `${ep}.bullets`, (a) => move(a, bi, -1)))}><IUp size={14} /></button>
              <button className="icon-btn" title="Move down" disabled={bi === e.bullets.length - 1} onClick={() => store.edit((r) => updateList(r, `${ep}.bullets`, (a) => move(a, bi, 1)))}><IDown size={14} /></button>
              <button className="icon-btn danger" title="Delete bullet" onClick={() => store.edit((r) => updateList(r, `${ep}.bullets`, (a) => a.filter((_, j) => j !== bi)))}><IX size={14} /></button>
            </div>
            {showLinks && (
              <div className="link-row">
                <Field path={`${ep}.bullets.${bi}.link`} value={b.link} placeholder="Icon link at the end of this bullet (optional)" mono onFocus={() => onFocus(`${ep}.bullets.${bi}`)} />
              </div>
            )}
          </div>
        ))}
        <div className="add-row" style={{ paddingLeft: 22 }}>
          <button className="add-btn" onClick={() => store.edit((r) => updateList(r, `${ep}.bullets`, (a) => [...a, bullet()]))}><IPlus size={13} /> Bullet</button>
        </div>
      </div>
    </div>
  );
}

/** Where a new section belongs: Summary on top, then the conventional order: not always last. */
const CANON: SectionRole[] = ["summary", "experience", "opensource", "projects", "skills", "education", "awards", "certifications", "coursework", "custom"];
function insertionIndex(sections: Section[], role: SectionRole): number {
  const rank = CANON.indexOf(role);
  if (role === "summary") return 0;
  // After the last existing section that conventionally comes before this one.
  if (role === "custom") return sections.length;
  let at = -1;
  sections.forEach((s, i) => { if (CANON.indexOf(s.role) <= rank) at = i; });
  return at + 1;
}

function AddSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="menu-wrap" style={{ alignSelf: "flex-start" }}>
      <button className="add-btn" style={{ height: 34, padding: "0 14px" }} onClick={() => setOpen(!open)}><IPlus size={14} /> Add section</button>
      {open && (
        <div className="menu" style={{ left: 0, right: "auto" }} onMouseLeave={() => setOpen(false)}>
          {ROLE_OPTIONS.map((role) => (
            <button key={role} onClick={() => {
              setOpen(false);
              const init = role === "skills" ? { skills: [skill()] } : role === "coursework" || role === "certifications" ? { items: [item()] } : role === "summary" ? {} : { entries: [entry({ bullets: [""] })] };
              const sec = section(role, init);
              let at = 0;
              store.edit((r) => {
                at = insertionIndex(r.sections, role);
                const sections = [...r.sections];
                sections.splice(at, 0, sec);
                return { ...r, sections };
              });
              // Jump to the new section and put the caret in its first field.
              setTimeout(() => {
                const card = document.querySelector<HTMLElement>(`.form [data-path="sections.${at}"]`);
                card?.scrollIntoView({ block: "center", behavior: "smooth" });
                card?.querySelector<HTMLElement>(".card-body input, .card-body textarea")?.focus({ preventScroll: true });
              }, 60);
            }}>
              {ROLE_TITLE[role]}<span className="hint">{ROLE_TYPE[role]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
