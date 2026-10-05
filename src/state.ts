// App state: one Resume, its source code, and which side last edited it.
// Form edits regenerate the code; code edits re-parse into the model. Drafts are
// saved to the browser by src/persist/autosave.ts, which watches this store.
import { useSyncExternalStore } from "react";
import { emptyResume } from "./model/factory";
import type { Resume } from "./model/types";
import { newDraftId } from "./persist/drafts";
import { parse, serialize, type Diagnostic, type LineMap } from "./source/latex";

export type Screen = "landing" | "setup" | "editor";

export interface State {
  screen: Screen;
  resume: Resume;
  code: string;
  map: LineMap;
  codeDiagnostics: Diagnostic[];
  /** Notes from the importer (what changed, what was unclear). */
  importNotes: string[];
  importVia: "ai" | "local" | null;
  /** Depth of the undo / redo stacks (for the toolbar buttons). */
  canUndo: number;
  canRedo: number;
  /** Which saved draft this document is. null = nothing worth saving yet (landing, setup). */
  draftId: string | null;
  /** Autosave status, shown in the editor's top bar. */
  saveState: "saved" | "pending" | "error" | "off";
  /** A one-off message for the editor to show (e.g. "Opened a shared resume"). */
  notice: string | null;
}

const initial = emptyResume();
let state: State = {
  screen: "landing",
  resume: initial,
  ...withCode(initial),
  codeDiagnostics: [],
  importNotes: [],
  importVia: null,
  canUndo: 0,
  canRedo: 0,
  draftId: null,
  saveState: "saved",
  notice: null,
};
const listeners = new Set<() => void>();

// ── Undo / redo ──────────────────────────────────────────────────────
// Every change to the document is undoable: form fields, toolbar, code. Typing
// into the same field within ~1.2s coalesces into one step, like a text editor.
interface Snapshot { resume: Resume; code: string; map: LineMap; codeDiagnostics: Diagnostic[] }
const past: Snapshot[] = [];
const future: Snapshot[] = [];
let lastKey = "";
let lastAt = 0;
const snap = (): Snapshot => ({ resume: state.resume, code: state.code, map: state.map, codeDiagnostics: state.codeDiagnostics });
function record(key: string) {
  const now = Date.now();
  if (key && key === lastKey && now - lastAt < 1200) { lastAt = now; return; }
  past.push(snap());
  if (past.length > 300) past.shift();
  future.length = 0;
  lastKey = key;
  lastAt = now;
}
const depth = () => ({ canUndo: past.length, canRedo: future.length });

function withCode(r: Resume) {
  const { code, map } = serialize(r);
  return { code, map };
}

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const store = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  go(screen: Screen) {
    set({ screen });
    window.scrollTo({ top: 0 });
  },
  /** Start a new document (import, sample, from scratch). It becomes a new draft. */
  load(resume: Resume, notes: string[] = [], via: State["importVia"] = null) {
    this.open(resume, newDraftId(), notes, via);
  },
  /** Open a document as a specific draft (restoring one, or a shared link). */
  open(resume: Resume, draftId: string, notes: string[] = [], via: State["importVia"] = null, notice: string | null = null) {
    past.length = 0;
    future.length = 0;
    lastKey = "";
    set({ resume, ...withCode(resume), codeDiagnostics: [], importNotes: notes, importVia: via, canUndo: 0, canRedo: 0, draftId, notice });
  },
  setSaveState(saveState: State["saveState"]) {
    if (state.saveState !== saveState) set({ saveState });
  },
  notify(notice: string | null) {
    set({ notice });
  },
  /**
   * Edit from the visual form or toolbar. `key` groups keystrokes into one undo
   * step (pass the field path); omit it for discrete actions (add, delete, move).
   */
  edit(fn: (r: Resume) => Resume, key = "") {
    const resume = fn(state.resume);
    if (resume === state.resume) return;
    record(key);
    set({ resume, ...withCode(resume), codeDiagnostics: [], ...depth() });
  },
  /**
   * Edit from the code editor. Keeps the last good model while the source has errors.
   * `fromHistory` = the editor's own undo/redo produced this text (don't record it twice).
   */
  editCode(code: string, fromHistory = false) {
    if (code === state.code) return;
    if (!fromHistory) record("code");
    const res = parse(code, state.resume);
    const errors = res.diagnostics.some((d) => d.severity === "error");
    set({ code, map: res.map, codeDiagnostics: res.diagnostics, ...(errors ? {} : { resume: res.resume }), ...depth() });
  },
  undo() {
    const s = past.pop();
    if (!s) return false;
    future.push(snap());
    lastKey = "";
    set({ ...s, ...depth() });
    return true;
  },
  redo() {
    const s = future.pop();
    if (!s) return false;
    past.push(snap());
    lastKey = "";
    set({ ...s, ...depth() });
    return true;
  },
  dismissNotes() {
    set({ importNotes: [], importVia: null });
  },
};

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(state));
}

// ── Immutable path updates: setIn(resume, "sections.2.entries.0.title", "Acme") ──

export function getIn(obj: unknown, path: string): unknown {
  return path.split(".").reduce<any>((o, k) => (o == null ? o : o[k]), obj);
}

export function setIn<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const rec = (o: any, i: number): any => {
    const k = keys[i];
    const copy = Array.isArray(o) ? [...o] : { ...o };
    copy[k] = i === keys.length - 1 ? value : rec(o?.[k], i + 1);
    return copy;
  };
  return rec(obj, 0);
}

/** Apply fn to the array at path. */
export function updateList<T>(obj: T, path: string, fn: (a: any[]) => any[]): T {
  return setIn(obj, path, fn([...(getIn(obj, path) as any[])]));
}

export const move = <X,>(a: X[], i: number, d: -1 | 1): X[] => {
  const j = i + d;
  if (j < 0 || j >= a.length) return a;
  const b = [...a];
  [b[i], b[j]] = [b[j], b[i]];
  return b;
};

// Dev-only handle for debugging in the console (stripped from production builds).
if (import.meta.env.DEV) (globalThis as any).__qelvo = { store };
