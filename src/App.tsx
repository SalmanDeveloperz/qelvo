import { lazy, Suspense } from "react";
import { useStore } from "./state";
import { Landing } from "./ui/Landing";
import { Setup } from "./ui/Setup";

// The editor (CodeMirror, pdf.js viewer) loads only when someone actually opens it.
const Editor = lazy(() => import("./ui/Editor").then((m) => ({ default: m.Editor })));

export function App() {
  const screen = useStore((s) => s.screen);
  if (screen === "editor") return <Suspense fallback={<div className="empty-state" style={{ height: "100vh" }}>opening the editor…</div>}><Editor /></Suspense>;
  if (screen === "setup") return <Setup />;
  return <Landing />;
}
