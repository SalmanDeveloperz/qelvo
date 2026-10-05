import { useEffect, useRef, useState } from "react";
import { TEMPLATE_META as TEMPLATES } from "../engine/meta";
import { contact, emptyResume, entry, section, skill } from "../model/factory";
import { SAMPLES } from "../model/samples";
import type { ContactKind, PageTarget, Paper, Resume, TemplateId } from "../model/types";
import type { Stage } from "../import";
import type { ImportMode } from "../import/schema";
import { store } from "../state";
import { IArrowLeft, IArrowRight, ICheck, IFile, IPen, ISpark, IUpload, IWarn, Wordmark } from "./icons";
import { SITE } from "../site";
import { ThemePicker } from "./theme";
import { Thumb } from "./Thumb";
import { warmEditor } from "./warm";

let preset: TemplateId | null = null;
/** Landing → Setup with a layout already chosen (the user clicked it in the gallery). */
export const presetTemplate = (id: TemplateId) => { preset = id; };

const ORDER: TemplateId[] = ["modern", "blueprint", "classic", "academic"];
const TAGS: Record<TemplateId, string> = { classic: "1 column", academic: "2 columns", modern: "2 columns", blueprint: "1 column" };

export function Setup() {
  const [step, setStep] = useState(0);
  const [template, setTemplate] = useState<TemplateId>(() => { const t = preset ?? "modern"; preset = null; return t; });
  const [pages, setPages] = useState<PageTarget>(1);
  const [paper, setPaper] = useState<Paper>("letter");

  // The editor is a couple of clicks away: get its code, the typesetter and this layout's fonts ready.
  useEffect(() => warmEditor(template, pages, paper), [template, pages, paper]);
  const steps = ["Layout", "Length", "Content"];
  return (
    <div>
      <nav className="nav">
        <button className="brand btn ghost" style={{ padding: 0 }} onClick={() => store.go("landing")}><Wordmark height={30} /></button>
        <div className="stepper">
          {steps.map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              {i > 0 && <span className="bar" />}
              <span className={`dot ${i === step ? "on" : i < step ? "done" : ""}`} onClick={() => i < step && setStep(i)}>
                {i < step ? <ICheck size={13} /> : <span>{i + 1}</span>} {s}
              </span>
            </span>
          ))}
        </div>
        <div className="nav-right" style={{ minWidth: 120, justifyContent: "flex-end" }}><ThemePicker /></div>
      </nav>
      <main className="setup">
        {step === 0 && (
          <>
            <h2>Pick a look you like.</h2>
            <p className="sub">Every one of these is strict: margins, sizes and rhythm stay put no matter what you write. Not sure? Pick any. You can switch later and your words come along.</p>
            <div className="cards">
              {ORDER.map((id) => (
                <button key={id} className={`tcard ${template === id ? "on" : ""}`} onClick={() => setTemplate(id)} onDoubleClick={() => { setTemplate(id); setStep(1); }}>
                  <div className="shot"><div className="paper"><Thumb id={id} width={236} /></div></div>
                  <div className="meta">
                    <h3>{TEMPLATES[id].name} <span className="check">{template === id && <ICheck size={13} />}</span></h3>
                    <p>{TEMPLATES[id].tagline}</p>
                    <div style={{ marginTop: 10 }}><span className="tag">{TAGS[id]}</span></div>
                  </div>
                </button>
              ))}
            </div>
            <div className="setup-foot">
              <span className="muted" style={{ fontSize: 13 }}>Tip: double-click a layout to choose it and continue.</span>
              <button className="btn primary lg" onClick={() => setStep(1)}>Continue <IArrowRight /></button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>How long should it be?</h2>
            <p className="sub">We'll land on exactly this many pages, nudging the spacing a little if we have to. We won't shrink your words to ant size to get there 🐜</p>
            <div className="pages">
              {([
                [1, "One page", "Students, new grads, most engineers under ~8 years.", "What most recruiters expect. The six-second skim happens here."],
                [2, "Two pages", "Senior / staff engineers, managers, 8+ years.", "Room for scope and impact without cutting real work."],
                [3, "Three pages", "Academic CVs, research, publications-heavy roles.", "Only when the extra pages carry papers, patents or talks."],
              ] as const).map(([n, t, who, why]) => (
                <button key={n} className={`pcard ${pages === n ? "on" : ""}`} onClick={() => setPages(n)} onDoubleClick={() => { setPages(n); setStep(2); }}>
                  <div className="stack">
                    {Array.from({ length: n }).map((_, i) => <i key={i} style={{ left: 8 + i * 30, transform: `rotate(${(i - (n - 1) / 2) * 5}deg)`, zIndex: 3 - i }} />)}
                  </div>
                  <h3>{t}</h3>
                  <div className="who">{who}</div>
                  <div className="why">{why}</div>
                </button>
              ))}
            </div>
            <div className="paper-pick">
              Paper
              <div className="seg">
                <button className={paper === "letter" ? "on" : ""} onClick={() => setPaper("letter")}>US Letter</button>
                <button className={paper === "a4" ? "on" : ""} onClick={() => setPaper("a4")}>A4</button>
              </div>
              <span className="faint">Letter for US/Canada roles, A4 almost everywhere else.</span>
            </div>
            <div className="setup-foot">
              <button className="btn ghost" onClick={() => setStep(0)}><IArrowLeft /> Back</button>
              <button className="btn primary lg" onClick={() => setStep(2)}>Continue <IArrowRight /></button>
            </div>
          </>
        )}

        {step === 2 && <ContentStep template={template} pages={pages} paper={paper} back={() => setStep(1)} />}
      </main>
    </div>
  );
}

const STAGES: { key: Stage; label: string }[] = [
  { key: "reading", label: "Opening your file" },
  { key: "layout", label: "Finding your dates, links and bullets" },
  { key: "ai", label: "Putting every section in its place" },
  { key: "done", label: "Typesetting it nicely" },
];

function ContentStep({ template, pages, paper, back }: { template: TemplateId; pages: PageTarget; paper: Paper; back: () => void }) {
  const [mode, setMode] = useState<ImportMode>("exact");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<{ stage: Stage; file: string; fallback?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quick, setQuick] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const run = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setError("That file is over 10 MB, and a resume shouldn't be. Export it again without embedded images."); return; }
    setError(null);
    setBusy({ stage: "reading", file: file.name });
    try {
      const { importFile } = await import("../import");
      const res = await importFile(file, {
        mode, pages, template, paper,
        onStage: (stage, detail) => setBusy((b) => ({ stage, file: file.name, fallback: stage === "local" ? detail : b?.fallback })),
      });
      store.load(res.resume, res.notes, res.via);
      store.go("editor");
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  const sample = () => {
    const r = SAMPLES[template]();
    store.load({ ...r, pages, paper });
    store.go("editor");
  };

  if (quick) return <QuickStart template={template} pages={pages} paper={paper} back={() => setQuick(false)} />;

  const stageIdx = busy ? Math.max(0, STAGES.findIndex((s) => s.key === (busy.stage === "local" ? "ai" : busy.stage))) : -1;
  return (
    <>
      <h2>Now, bring your story.</h2>
      <p className="sub">Upload the resume you already have and it lands in <b style={{ color: "var(--text)" }}>{TEMPLATES[template].name}</b>, {pages} page{pages > 1 ? "s" : ""}, every bullet and link intact. Or start clean with just the essentials.</p>
      <div className="sources">
        {busy ? (
          <div className="progress">
            <div className="mono faint" style={{ fontSize: 12, marginBottom: 10 }}>{busy.file}</div>
            {STAGES.map((s, i) => (
              <div key={s.key} className={`row ${i === stageIdx ? "on" : i < stageIdx ? "done" : ""}`}>
                <span className="st">{i < stageIdx ? <ICheck size={15} color="var(--ok)" /> : i === stageIdx ? <span className="spinner" /> : "·"}</span>
                {s.key === "ai" && busy.stage === "local" && busy.fallback ? "AI unavailable, so the offline parser is reading it" : s.label}
              </div>
            ))}
            {busy.stage === "ai" && <div className="faint" style={{ fontSize: 12.5, marginTop: 12 }}>Reading carefully takes 20–60 seconds. Accuracy over speed.</div>}
          </div>
        ) : (
          <div
            className={`drop ${over ? "over" : ""}`}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) run(f); }}
          >
            <div>
              <IUpload size={30} color="var(--accent)" />
              <h3>Drop your old resume here 📄</h3>
              <p>or click to find it. Messy ones welcome.</p>
              <div className="types"><span>PDF</span><span>DOCX</span><span>TXT</span></div>
              {SITE.aiImport && <div className="mode" onClick={(e) => e.stopPropagation()}>
                <button className={`radio ${mode === "exact" ? "on" : ""}`} onClick={() => setMode("exact")}>
                  <i className="r" /><div><b>Keep my wording</b><span>Exact transcription. Only fixes broken line wraps and stray icon glyphs.</span></div>
                </button>
                <button className={`radio ${mode === "ats" ? "on" : ""}`} onClick={() => setMode("ats")}>
                  <i className="r" /><div><b>ATS polish</b><span>Stronger verbs, consistent tense and punctuation, standard headings. Never adds facts or numbers.</span></div>
                </button>
              </div>}
            </div>
            <input ref={input} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
          </div>
        )}
        <div className="side-opts">
          <button className="opt" onClick={() => setQuick(true)} disabled={!!busy}>
            <h4><IPen size={15} /> &nbsp;Start fresh ✏️</h4>
            <p>Six quick fields for the top of the page, then fill in the rest with the PDF updating next to you. Empty sections stay out of the PDF.</p>
          </button>
          <button className="opt" onClick={sample} disabled={!!busy}>
            <h4><IFile size={15} /> &nbsp;Peek at a sample 👀</h4>
            <p>The real resume this layout was measured against. A nice way to poke around before writing your own.</p>
          </button>
          <div className="opt" style={{ cursor: "default" }}>
            <h4><ISpark size={15} /> &nbsp;What happens to my file? 🔒</h4>
            {SITE.aiImport
              ? <p>Layout extraction runs in your browser. For structuring, the text (and the PDF itself) is sent once to Claude and not stored by this app. Without an AI key, an offline parser is used instead.</p>
              : <p>Nothing gets uploaded. Your file is read and typeset right here in this tab, and your draft is saved only in this browser. Not on our servers. We don't even have any.</p>}
          </div>
        </div>
      </div>
      {error && <div className="err-box"><IWarn size={14} /> {error}</div>}
      <div className="setup-foot">
        <button className="btn ghost" onClick={back} disabled={!!busy}><IArrowLeft /> Back</button>
        <span />
      </div>
    </>
  );
}

const QUICK: { key: string; label: string; kind?: ContactKind; ph: string; full?: boolean }[] = [
  { key: "name", label: "Full name", ph: "Ada Lovelace", full: true },
  { key: "email", label: "Email", kind: "email", ph: "ada@example.com" },
  { key: "phone", label: "Phone", kind: "phone", ph: "+1 415 555 0134" },
  { key: "location", label: "City, Country", kind: "location", ph: "London, UK" },
  { key: "linkedin", label: "LinkedIn", kind: "linkedin", ph: "linkedin.com/in/ada" },
  { key: "github", label: "GitHub / portfolio", kind: "github", ph: "github.com/ada" },
];

function QuickStart({ template, pages, paper, back }: { template: TemplateId; pages: PageTarget; paper: Paper; back: () => void }) {
  const [v, setV] = useState<Record<string, string>>({});
  const go = () => {
    const r: Resume = { ...emptyResume(), template, pages, paper, name: (v.name ?? "").trim() };
    r.contacts = QUICK.filter((q) => q.kind && v[q.key]?.trim()).map((q) => {
      const raw = v[q.key].trim();
      const url = q.kind === "email" ? `mailto:${raw}` : q.kind === "linkedin" || q.kind === "github" ? (raw.startsWith("http") ? raw : `https://${raw.replace(/^\/+/, "")}`) : "";
      const text = q.kind === "linkedin" ? raw.replace(/^https?:\/\/(www\.)?linkedin\.com\//, "").replace(/\/$/, "") : q.kind === "github" ? raw.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\/$/, "") : raw;
      return contact(q.kind!, text, url);
    });
    r.sections = [
      section("summary"),
      section("experience", { entries: [entry({ bullets: ["", ""] })] }),
      section("projects", { entries: [entry({ bullets: [""] })] }),
      section("skills", { skills: [skill("Languages"), skill("Frameworks"), skill("Tools")] }),
      section("education", { entries: [entry()] }),
    ];
    store.load(r);
    store.go("editor");
  };
  return (
    <>
      <h2>Let's start with you.</h2>
      <p className="sub">Just the top of the page for now. Everything else happens in the editor, with your PDF updating right beside you.</p>
      <div className="opt" style={{ cursor: "default", maxWidth: 720 }}>
        <div className="quick">
          {QUICK.map((q) => (
            <div key={q.key} className={`field ${q.full ? "full" : ""}`}>
              <label>{q.label}</label>
              <input className={`input ${q.key === "name" ? "name" : ""}`} placeholder={q.ph} value={v[q.key] ?? ""} autoFocus={q.key === "name"}
                onChange={(e) => setV({ ...v, [q.key]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && go()} />
            </div>
          ))}
        </div>
      </div>
      <div className="setup-foot">
        <button className="btn ghost" onClick={back}><IArrowLeft /> Back</button>
        <button className="btn primary lg" onClick={go}>Open the editor <IArrowRight /></button>
      </div>
    </>
  );
}
