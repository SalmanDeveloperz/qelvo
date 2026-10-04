import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { EditorSelection, EditorState, Transaction, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { defaultKeymap, indentWithTab, toggleComment } from "@codemirror/commands";
import { HighlightStyle, StreamLanguage, bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, snippetCompletion, type CompletionContext } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { lintGutter, setDiagnostics, type Diagnostic as CmDiagnostic } from "@codemirror/lint";
import { tags as t } from "@lezer/highlight";
import type { Diagnostic } from "../source/latex";
import { store } from "../state";

/** Ctrl/⌘+B / +I: wrap the selection (or the word at the caret) in \textbf{…} / \textit{…}; again to unwrap. */
function wrapCommand(cmd: string) {
  return (view: EditorView) => {
    const open = "\\" + cmd + "{";
    view.dispatch(view.state.changeByRange((range) => {
      let { from, to } = range;
      const doc = view.state.doc;
      if (from === to) {
        const w = view.state.wordAt(from);
        if (w) ({ from, to } = w);
      }
      const before = doc.sliceString(Math.max(0, from - open.length), from);
      const after = doc.sliceString(to, to + 1);
      if (before === open && after === "}") {
        return { changes: [{ from: from - open.length, to: from }, { from: to, to: to + 1 }], range: EditorSelection.range(from - open.length, to - open.length) };
      }
      return { changes: [{ from, insert: open }, { from: to, insert: "}" }], range: EditorSelection.range(from + open.length, to + open.length) };
    }));
    return true;
  };
}

export interface CodeHandle {
  reveal(line: number): void;
  wrap(cmd: "textbf" | "textit"): void;
}

const hl = HighlightStyle.define([
  { tag: t.tagName, color: "var(--accent)" },
  { tag: t.bracket, color: "var(--muted)" },
  { tag: t.comment, color: "var(--faint)", fontStyle: "italic" },
  { tag: t.atom, color: "var(--info)" },
  { tag: t.keyword, color: "var(--syn-kw)" },
  { tag: t.number, color: "var(--ok)" },
  { tag: t.string, color: "var(--ok)" },
  { tag: t.special(t.variableName), color: "var(--info)" },
]);

const theme = EditorView.theme(
  {
    "&": { color: "var(--text-2)", backgroundColor: "var(--panel)", height: "100%" },
    ".cm-content": { caretColor: "var(--accent)", padding: "14px 0 200px" },
    ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "color-mix(in srgb, var(--accent) 24%, transparent) !important" },
    ".cm-gutters": { backgroundColor: "var(--panel)", color: "var(--faint)", border: "none", paddingRight: "6px" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--text-2)" },
    ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--text) 4%, transparent)" },
    ".cm-line": { padding: "0 18px 0 8px" },
    ".cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--accent) 18%, transparent)", outline: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)" },
    ".cm-tooltip": { backgroundColor: "var(--panel-3)", border: "1px solid var(--line-2)", borderRadius: "8px", overflow: "hidden" },
    ".cm-tooltip-autocomplete > ul > li": { padding: "4px 10px !important", fontFamily: "var(--mono)" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)", color: "var(--text)" },
    ".cm-completionDetail": { color: "var(--muted)", fontStyle: "normal", marginLeft: "10px" },
    ".cm-diagnostic-error": { borderLeft: "3px solid var(--err)" },
    ".cm-diagnostic-warning": { borderLeft: "3px solid var(--warn)" },
    ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy var(--err) 1px", textUnderlineOffset: "3px" },
    ".cm-lintRange-warning": { backgroundImage: "none", textDecoration: "underline wavy var(--warn) 1px", textUnderlineOffset: "3px" },
    ".cm-searchMatch": { backgroundColor: "color-mix(in srgb, var(--info) 25%, transparent)" },
    ".cm-panels": { backgroundColor: "var(--panel-2)", color: "var(--text-2)", borderTop: "1px solid var(--line)" },
    ".cm-placeholder": { color: "var(--faint)" },
  },
  { dark: true },
);

const SNIPPETS = [
  snippetCompletion("\\section{${Title}}", { label: "\\section", detail: "new section" }),
  snippetCompletion("\\section[side]{${Title}}", { label: "\\section[side]", detail: "right column" }),
  snippetCompletion("\\entry{${Organisation}}{${Role}}{${Mon YYYY -- Present}}{${City, Country}}", { label: "\\entry", detail: "{org}{role}{dates}{place}" }),
  snippetCompletion("\\item ${}", { label: "\\item", detail: "bullet" }),
  snippetCompletion("\\meta{${tech stack / repos / GPA}}", { label: "\\meta", detail: "entry detail" }),
  snippetCompletion("\\url{${https://}}", { label: "\\url", detail: "entry link (icon)" }),
  snippetCompletion("\\skill{${Label}}{${A, B, C}}", { label: "\\skill", detail: "{label}{items}" }),
  snippetCompletion("\\listitem{${text}}", { label: "\\listitem", detail: "list item" }),
  snippetCompletion("\\textbf{${}}", { label: "\\textbf", detail: "bold" }),
  snippetCompletion("\\textit{${}}", { label: "\\textit", detail: "italic" }),
  snippetCompletion("\\href{${https://}}{${text}}", { label: "\\href", detail: "link" }),
  snippetCompletion("\\linkicon{${https://}}", { label: "\\linkicon", detail: "icon at bullet end" }),
  snippetCompletion("\\template{${modern}}", { label: "\\template", detail: "modern | blueprint | classic | academic" }),
  snippetCompletion("\\pages{${1}}", { label: "\\pages", detail: "1 | 2 | 3" }),
  snippetCompletion("\\paper{${letter}}", { label: "\\paper", detail: "letter | a4" }),
  snippetCompletion("\\name{${Full Name}}", { label: "\\name" }),
  snippetCompletion("\\headline{${Backend Engineer}}", { label: "\\headline", detail: "optional title" }),
  snippetCompletion("\\email{${you@example.com}}", { label: "\\email" }),
  snippetCompletion("\\phone{${+1 555 0100}}", { label: "\\phone" }),
  snippetCompletion("\\location{${City, Country}}", { label: "\\location" }),
  snippetCompletion("\\linkedin{${in/handle}}{${https://linkedin.com/in/handle}}", { label: "\\linkedin" }),
  snippetCompletion("\\github{${handle}}{${https://github.com/handle}}", { label: "\\github" }),
  snippetCompletion("\\website{${example.dev}}{${https://example.dev}}", { label: "\\website" }),
];

function complete(ctx: CompletionContext) {
  const w = ctx.matchBefore(/\\[A-Za-z[\]]*/);
  if (!w || (w.from === w.to && !ctx.explicit)) return null;
  return { from: w.from, options: SNIPPETS, validFor: /^\\[A-Za-z[\]]*$/ };
}

export const CodePane = forwardRef<CodeHandle, { code: string; diagnostics: Diagnostic[]; onChange: (code: string) => void }>(function CodePane({ code, diagnostics, onChange }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const applying = useRef(false);

  useEffect(() => {
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      bracketMatching(),
      closeBrackets(),
      highlightSelectionMatches(),
      autocompletion({ override: [complete], icons: false }),
      lintGutter(),
      StreamLanguage.define(stex),
      syntaxHighlighting(hl),
      EditorView.lineWrapping,
      placeholder("% start with \\name{…}"),
      theme,
      // One undo history for the whole app: Ctrl+Z here also undoes edits made in the form.
      keymap.of([
        { key: "Mod-z", run: () => (store.undo(), true), preventDefault: true },
        { key: "Mod-y", run: () => (store.redo(), true), preventDefault: true },
        { key: "Mod-Shift-z", run: () => (store.redo(), true), preventDefault: true },
        { key: "Mod-b", run: wrapCommand("textbf"), preventDefault: true },
        { key: "Mod-i", run: wrapCommand("textit"), preventDefault: true },
      ]),
      keymap.of([...closeBracketsKeymap, ...completionKeymap, ...searchKeymap, { key: "Mod-/", run: toggleComment }, indentWithTab, ...defaultKeymap]),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !applying.current) onChangeRef.current(u.state.doc.toString());
      }),
    ];
    view.current = new EditorView({ state: EditorState.create({ doc: code, extensions }), parent: host.current! });
    return () => view.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External updates (form edits, toolbar) arrive as a minimal replace so the cursor and scroll stay put.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (cur === code) return;
    let a = 0;
    while (a < cur.length && a < code.length && cur[a] === code[a]) a++;
    let b = 0;
    while (b < cur.length - a && b < code.length - a && cur[cur.length - 1 - b] === code[code.length - 1 - b]) b++;
    applying.current = true;
    v.dispatch({ changes: { from: a, to: cur.length - b, insert: code.slice(a, code.length - b) }, annotations: Transaction.addToHistory.of(false) });
    applying.current = false;
  }, [code]);

  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const doc = v.state.doc;
    const diags: CmDiagnostic[] = diagnostics
      .filter((d) => d.line >= 1 && d.line <= doc.lines)
      .map((d) => {
        const line = doc.line(d.line);
        return { from: line.from, to: Math.max(line.from, line.to), severity: d.severity, message: d.message };
      });
    v.dispatch(setDiagnostics(v.state, diags));
  }, [diagnostics, code]);

  useImperativeHandle(ref, () => ({
    wrap(cmd) {
      const v = view.current;
      if (!v) return;
      wrapCommand(cmd)(v);
      v.focus();
    },
    reveal(n: number) {
      const v = view.current;
      if (!v) return;
      const line = v.state.doc.line(Math.max(1, Math.min(n, v.state.doc.lines)));
      v.dispatch({ selection: { anchor: line.from, head: line.to }, effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
      v.focus();
    },
  }));

  return <div className="code-host" ref={host} />;
});
