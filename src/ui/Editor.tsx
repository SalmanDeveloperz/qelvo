import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sharedCompiler, type CompileResult } from "../engine/client";
import { TEMPLATE_META as TEMPLATES } from "../engine/meta";
import { lint } from "../model/lint";
import type { PageTarget, Paper, TemplateId } from "../model/types";
import { store, useStore } from "../state";
import { CodePane, type CodeHandle } from "./CodePane";
import { FormPane } from "./FormPane";
import { PdfView } from "./PdfView";
import { download, fileBase } from "./pdf";
import { SITE } from "../site";
import { ThemePicker } from "./theme";
import { ICode, IDots, IDown, IDownload, IFile, IForm, IRedo, IUndo, IUp, IUpload, Logo } from "./icons";
import { applyMarkup } from "./FormPane";

type Tab = "visual" | "code";

interface Problem { severity: "error" | "warning" | "info"; message: string; path?: string; line?: number }

export function Editor() {
  const resume = useStore((s) => s.resume);
  const code = useStore((s) => s.code);
  const map = useStore((s) => s.map);
  const codeDiagnostics = useStore((s) => s.codeDiagnostics);
  const [tab, setTab] = useState<Tab>("visual");
  const [result, setResult] = useState<CompileResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const [leftPct, setLeftPct] = useState(() => (window.innerWidth > 1500 ? 46 : 50));
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [problemsOpen, setProblemsOpen] = useState(true);
  const codeRef = useRef<CodeHandle>(null);
  // Shared and never disposed: setup warms it up, and an idle worker costs nothing.
  const compiler = useMemo(() => sharedCompiler(), []);

  // Live compile, debounced lightly while typing; the first one runs straight away.
  const first = useRef(true);
  useEffect(() => {
    setBusy(true);
    const delay = first.current ? 0 : 90;
    first.current = false;
    const t = setTimeout(() => {
      compiler.compile(resume).then((r) => {
        if (!r) return;
        setResult(r);
        setCompileError(null);
        setBusy(false);
      }).catch((e: Error) => { setCompileError(e.message); setBusy(false); });
    }, delay);
    return () => clearTimeout(t);
  }, [resume, compiler]);

  // Nothing is saved anywhere: say so before the tab closes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (resume.name || resume.sections.some((s) => s.text || s.entries.length)) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [resume]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const downloadPdf = useCallback(async () => {
    // Always the freshest compile: the bytes you download are the bytes on screen.
    const r = (await compiler.compile(store.get().resume)) ?? result;
    if (!r) return;
    setResult(r);
    download(r.pdf, `${fileBase(store.get().resume.name)}.pdf`, "application/pdf");
    flash(`Downloaded · ${r.info.pageCount} page${r.info.pageCount > 1 ? "s" : ""} · ${(r.pdf.length / 1024).toFixed(0)} KB · real text, embedded fonts`);
  }, [compiler, result]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); downloadPdf(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "e") { e.preventDefault(); setTab((t) => (t === "code" ? "visual" : "code")); }
      // App-wide undo/redo (the code editor binds the same keys to the same store).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !(e.target as HTMLElement)?.closest?.(".cm-editor")) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) { e.preventDefault(); store.undo(); }
        else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); store.redo(); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [downloadPdf]);

  /** PDF click → the field (visual) or the line (code) that produced it. */
  const locate = useCallback((src: string) => {
    setFocusPath(src);
    if (tab === "code") {
      let p = src;
      while (p && !(p in store.get().map)) p = p.includes(".") ? p.slice(0, p.lastIndexOf(".")) : "";
      codeRef.current?.reveal(store.get().map[p] ?? 1);
      return;
    }
    let p = src;
    let el: HTMLElement | null = null;
    const find = (q: string) =>
      document.querySelector<HTMLElement>(`.form [data-path="${q}"]:is(input,textarea)`) ??
      document.querySelector<HTMLElement>(`.form [data-path="${q}.text"]`) ??
      document.querySelector<HTMLElement>(`.form [data-path="${q}"]`);
    while (p && !(el = find(p))) p = p.includes(".") ? p.slice(0, p.lastIndexOf(".")) : "";
    if (!el) return;
    const target = el.matches("input,textarea,select") ? el : el.querySelector<HTMLElement>("input,textarea");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    if (target) {
      setTimeout(() => target.focus({ preventScroll: true }), 220);
      target.classList.remove("flash");
      void target.offsetWidth;
      target.classList.add("flash");
    }
  }, [tab]);

  const problems: Problem[] = useMemo(() => {
    const out: Problem[] = [];
    if (compileError) out.push({ severity: "error", message: `Typesetter: ${compileError}` });
    for (const d of codeDiagnostics) out.push({ severity: d.severity, message: d.message, line: d.line });
    const info = result?.info;
    if (info?.overflow) out.push({ severity: "warning", message: `Doesn't fit ${info.target} page${info.target > 1 ? "s" : ""} even with the tightest spacing allowed: it runs ${info.pageCount} pages. Trim older or weaker bullets, or choose ${info.target + 1} pages.` });
    else if (info && info.density > 0.02) out.push({ severity: "info", message: `Spacing tightened ${Math.round(info.density * 16)}% to land on ${info.target} page${info.target > 1 ? "s" : ""}. Cut a line or two to get the layout's natural rhythm back.` });
    if (info && !info.overflow && info.target > 1 && info.pageCount < info.target) out.push({ severity: "info", message: `Your content fills ${info.pageCount} page${info.pageCount > 1 ? "s" : ""}; you asked for ${info.target}. That's fine: don't pad it.` });
    for (const h of lint(resume)) out.push(h);
    return out;
  }, [codeDiagnostics, result, resume, compileError]);

  const counts = { error: problems.filter((p) => p.severity === "error").length, warning: problems.filter((p) => p.severity === "warning").length, info: problems.filter((p) => p.severity === "info").length };

  const onProblem = (p: Problem) => {
    if (p.line) { setTab("code"); setTimeout(() => codeRef.current?.reveal(p.line!), 30); }
    else if (p.path) locate(p.path);
  };

  const setMeta = (patch: Partial<{ template: TemplateId; pages: PageTarget; paper: Paper }>) => store.edit((r) => ({ ...r, ...patch }));
  const canUndo = useStore((s) => s.canUndo);
  const canRedo = useStore((s) => s.canRedo);
  /** B / I buttons: act on the focused field (visual) or the selection (code), keeping focus. */
  const format = (mark: "**" | "*") => {
    if (tab === "code") { codeRef.current?.wrap(mark === "**" ? "textbf" : "textit"); return; }
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) applyMarkup(el, mark);
    else flash("Click into a text field first, then press B or I (or Ctrl+B / Ctrl+I).");
  };

  // Divider drag
  const split = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    if (!drag) return;
    const mv = (e: PointerEvent) => {
      const r = split.current!.getBoundingClientRect();
      setLeftPct(Math.max(28, Math.min(72, ((e.clientX - r.left) / r.width) * 100)));
    };
    const up = () => setDrag(false);
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
  }, [drag]);

  const info = result?.info;
  const statusCls = compileError || counts.error ? "err" : busy ? "busy" : info?.overflow ? "warn" : "";
  const highlight = useMemo(() => {
    if (!focusPath || !result) return null;
    let p = focusPath;
    while (p && !result.boxes.some((b) => b.src === p || b.src.startsWith(p + "."))) p = p.includes(".") ? p.slice(0, p.lastIndexOf(".")) : "";
    return p || null;
  }, [focusPath, result]);

  return (
    <div className="editor" style={drag ? { userSelect: "none", cursor: "col-resize" } : undefined}>
      <header className="topbar">
        <button className="btn ghost sm" style={{ padding: "0 4px" }} onClick={() => confirm("Leave the editor? Nothing is saved.") && store.go("landing")} title="Home"><Logo size={24} /></button>
        <span className="file"><IFile size={14} /> {fileBase(resume.name)}.tex</span>
        <span className="sep" />
        <label className="tsel"><span className="lbl">Layout</span>
          <select className="select" style={{ height: 30, width: 160, padding: "0 26px 0 10px", fontSize: 13 }} value={resume.template} onChange={(e) => setMeta({ template: e.target.value as TemplateId })}>
            {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => <option key={id} value={id}>{TEMPLATES[id].name}</option>)}
          </select>
        </label>
        <span className="tsel"><span className="lbl">Pages</span>
          <div className="seg">{([1, 2, 3] as const).map((n) => <button key={n} className={resume.pages === n ? "on" : ""} onClick={() => setMeta({ pages: n })}>{n}</button>)}</div>
        </span>
        <span className="tsel">
          <div className="seg">{(["letter", "a4"] as const).map((p) => <button key={p} className={resume.paper === p ? "on" : ""} onClick={() => setMeta({ paper: p })}>{p === "a4" ? "A4" : "Letter"}</button>)}</div>
        </span>
        <span className="sep" />
        <div className="seg" role="group" aria-label="History">
          <button title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => store.undo()}><IUndo size={14} /></button>
          <button title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={() => store.redo()}><IRedo size={14} /></button>
        </div>
        <span className="grow" />
        <span className={`status ${statusCls}`} title={info ? `layout + PDF in ${info.ms.toFixed(0)} ms` : ""}>
          <i className="led" />
          {busy ? "compiling" : compileError ? "error" : info ? `${info.pageCount}/${info.target} page${info.target > 1 ? "s" : ""} · ${Math.round(info.lastFill * 100)}% · ${info.ms.toFixed(0)} ms` : "…"}
        </span>
        <ThemePicker />
        <div className="menu-wrap">
          <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setMenu(!menu)} title="More"><IDots /></button>
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => { setMenu(false); download(store.get().code, `${fileBase(resume.name)}.tex`, "text/x-tex"); }}><ICode size={15} /> Download source (.tex)<span className="hint">{SITE.name}</span></button>
              <button onClick={() => { setMenu(false); download(JSON.stringify(store.get().resume, null, 2), `${fileBase(resume.name)}.json`, "application/json"); }}><IFile size={15} /> Download data (.json)</button>
              <hr />
              <button onClick={() => { setMenu(false); if (confirm("Import another resume? This replaces the current one.")) store.go("setup"); }}><IUpload size={15} /> Import another file…</button>
            </div>
          )}
        </div>
        <button className="btn primary" onClick={downloadPdf} title="Ctrl/⌘ + S"><IDownload size={16} /> Download PDF</button>
      </header>

      <div className="split" ref={split} style={{ gridTemplateColumns: `${leftPct}% 0px 1fr` }}>
        <section className="pane left">
          <div className="pane-head">
            <div className="tabs">
              <button className={tab === "visual" ? "on" : ""} onClick={() => setTab("visual")}><IForm size={14} /> Visual</button>
              <button className={tab === "code" ? "on" : ""} onClick={() => setTab("code")}><ICode size={14} /> Code</button>
            </div>
            <div className="seg fmt" role="group" aria-label="Formatting">
              <button title="Bold (Ctrl+B)" onMouseDown={(e) => e.preventDefault()} onClick={() => format("**")}><b>B</b></button>
              <button title="Italic (Ctrl+I)" onMouseDown={(e) => e.preventDefault()} onClick={() => format("*")}><i style={{ fontFamily: "var(--serif)", fontSize: 15 }}>I</i></button>
            </div>
            <span className="hint-chip" style={{ marginLeft: "auto" }}><span className="kbd">Ctrl</span><span className="kbd">E</span> switch</span>
          </div>
          <div className="pane-body" style={{ overflow: tab === "code" ? "hidden" : "auto" }}>
            {tab === "visual" ? <FormPane onFocus={setFocusPath} /> : <CodePane ref={codeRef} code={code} diagnostics={codeDiagnostics} onChange={(c) => store.editCode(c)} />}
          </div>
          <div className="problems">
            <div className="problems-head" onClick={() => setProblemsOpen(!problemsOpen)}>
              {problemsOpen ? <IDown size={13} /> : <IUp size={13} />} PROBLEMS
              <span className="count">
                <span className="c-err">{counts.error} err</span>
                <span className="c-warn">{counts.warning} warn</span>
                <span className="c-info">{counts.info} tips</span>
              </span>
              {map && <span className="faint" style={{ marginLeft: "auto" }}>click a line in the PDF to jump to it</span>}
            </div>
            {problemsOpen && problems.length > 0 && (
              <div className="problems-list">
                {problems.map((p, i) => (
                  <button key={i} className="prob" onClick={() => onProblem(p)}>
                    <span className={`sev ${p.severity}`}>{p.severity === "warning" ? "warn" : p.severity === "error" ? "error" : "tip"}</span>
                    <span>{p.message}</span>
                    {p.line && <span className="loc">l.{p.line}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
        <div className={`divider ${drag ? "drag" : ""}`} onPointerDown={(e) => { e.preventDefault(); setDrag(true); }} />
        <section className="pane">
          <div className="pane-head">
            <span className="mono faint" style={{ fontSize: 12 }}>{TEMPLATES[resume.template].name} · {resume.paper === "a4" ? "A4" : "US Letter"}</span>
            <span className="hint-chip" style={{ marginLeft: "auto" }}>preview = download, byte for byte</span>
          </div>
          <PdfView result={result} highlight={highlight} onLocate={locate} target={resume.pages} />
        </section>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
