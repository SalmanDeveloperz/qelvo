// Get the editor ready before anyone asks for it. The landing page never pays for this:
// code is fetched when the browser is idle (and only on a decent connection), and the
// typesetter starts compiling once someone is in setup, where the editor is a click away.
import type { PageTarget, Paper, TemplateId } from "../model/types";

let code = false;
let editor: typeof import("./Editor") | null = null;
/** Load the editor module once; later renders use it directly instead of suspending. */
export const loadEditor = () => import("./Editor").then((m) => (editor = m));
export const loadedEditor = () => editor;
const slow = () => {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData || /(^|-)2g$/.test(c.effectiveType ?? ""));
};

/** Download the editor's code: its chunk, pdf.js, and pdf.js's worker. */
export function warmCode() {
  if (code) return;
  code = true;
  void loadEditor();
  // Loading the module starts pdf.js's shared worker.
  void import("../import/pdfjs");
}

/**
 * Everything in warmCode, plus a compile of this layout's sample with the chosen length and
 * paper: the worker and fonts get hot, and "Open the reference sample" reuses the result.
 */
export function warmEditor(template: TemplateId, pages: PageTarget, paper: Paper) {
  warmCode();
  void Promise.all([import("../engine/client"), import("../model/samples")]).then(([c, s]) => {
    void c.sharedCompiler().compile({ ...s.SAMPLES[template](), pages, paper }).catch(() => {});
  });
}

/** On the landing page: fetch the code once the page is idle, unless the connection is slow. */
export function warmWhenIdle() {
  if (slow()) return;
  const go = () => warmCode();
  const ric = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  window.setTimeout(() => (ric ? ric(go, { timeout: 4000 }) : go()), 2500);
}
