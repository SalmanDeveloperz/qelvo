import { lazy, Suspense } from "react";
import { useStore } from "./state";
import { Landing } from "./ui/Landing";
import { Setup } from "./ui/Setup";
import { loadEditor, loadedEditor } from "./ui/warm";
import { Notice } from "./ui/Share";

// The editor (CodeMirror, pdf.js viewer) loads only when someone heads for it. Once warm.ts
// has it, render it directly: suspending, even for a tick, makes React 19 hold the reveal ~300ms.
const LazyEditor = lazy(() => loadEditor().then((m) => ({ default: m.Editor })));

export function App() {
  return <><Screen /><Notice /></>;
}

function Screen() {
  const screen = useStore((s) => s.screen);
  if (screen === "editor") {
    const ready = loadedEditor();
    if (ready) return <ready.Editor />;
    return <Suspense fallback={<div className="empty-state" style={{ height: "100vh" }}>opening the editor…</div>}><LazyEditor /></Suspense>;
  }
  if (screen === "setup") return <Setup />;
  return <Landing />;
}
