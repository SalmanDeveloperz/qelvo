import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./styles.css";
import { App } from "./App";
import { applyTheme, initialTheme } from "./ui/theme";
import { boot, startAutosave } from "./persist/autosave";
import { store } from "./state";
import { loadEditor } from "./ui/warm";

// Before first paint, so there is no flash of the wrong theme.
applyTheme(initialTheme());

// Open a shared link, or the draft you were editing, before the first render (a few ms),
// so a reload or a pasted link never flashes the landing page first.
startAutosave();
await boot();
// Going straight to the editor: have its code ready so there's no "opening…" flash.
if (store.get().screen === "editor") await loadEditor();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
