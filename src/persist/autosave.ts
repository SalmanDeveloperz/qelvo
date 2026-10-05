// Autosave and startup. Watches the store and writes the current draft to the browser
// shortly after each change, and right away when the tab is hidden or closed. On startup it
// opens a shared link if there is one, or puts you back in the editor where you left off.
import { store } from "../state";
import { Drafts, newDraftId } from "./drafts";
import { compact, decodeShare, payloadFromHash } from "./share";

export const drafts = Drafts.browser();
const DELAY = 300;

let timer: ReturnType<typeof setTimeout> | undefined;

/** Write the current draft now. Safe to call any time. */
export function flush() {
  if (timer) { clearTimeout(timer); timer = undefined; }
  const s = store.get();
  if (!s.draftId || !drafts.available) return;
  try {
    drafts.save(s.draftId, s.resume);
    store.setSaveState("saved");
  } catch {
    store.setSaveState("error"); // most likely storage is full
  }
}

export function startAutosave() {
  if (!drafts.available) store.setSaveState("off");
  let { resume: lastResume, draftId: lastId, screen: lastScreen } = store.get();
  store.subscribe(() => {
    const s = store.get();
    if (s.draftId && (s.screen !== lastScreen || s.draftId !== lastId)) {
      drafts.setLast({ draftId: s.draftId, screen: s.screen === "editor" ? "editor" : "other" });
    }
    lastScreen = s.screen;
    if (!s.draftId || (s.resume === lastResume && s.draftId === lastId)) return;
    const switched = s.draftId !== lastId;
    lastResume = s.resume;
    lastId = s.draftId;
    if (!drafts.available) return;
    store.setSaveState("pending");
    if (timer) clearTimeout(timer);
    // A newly opened draft is saved at once; typing is batched.
    timer = setTimeout(flush, switched ? 0 : DELAY);
  });
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  // A share link pasted into an already-open tab only changes the hash.
  window.addEventListener("hashchange", () => {
    const p = payloadFromHash(location.hash);
    if (p) void openShared(p);
  });
}

const BROKEN: Record<string, string> = {
  version: "This share link was made by a newer version of Qelvo. Try reloading the page.",
  corrupt: "This share link is incomplete or damaged. Ask for the full link again; some apps cut long links short.",
  "too-large": "This share link is too large to be a resume, so it wasn't opened.",
  "not-a-resume": "This share link doesn't contain a resume.",
};

/** Open a resume from a share link as a draft of its own. The reader's other drafts are untouched. */
export async function openShared(payload: string) {
  const d = await decodeShare(payload);
  // Drop the payload from the address bar: a reload then simply reopens the saved draft.
  history.replaceState(null, "", location.pathname + location.search);
  if (!d.ok) { store.notify(BROKEN[d.reason]); return; }
  const key = compact(d.resume);
  for (const m of drafts.list()) {
    const r = drafts.load(m.id);
    if (r && compact(r) === key) {
      store.open(r, m.id, [], null, "You already have this resume in your drafts, so that's what opened.");
      store.go("editor");
      return;
    }
  }
  store.open(d.resume, newDraftId(), [], null, drafts.available
    ? "Opened a shared resume. It's now a draft in this browser; your other drafts are untouched."
    : "Opened a shared resume. This browser blocks storage, so changes won't be kept after you close the tab.");
  store.go("editor");
}

/** Decide the first screen: a shared link, the draft you were editing, or the landing page. */
export async function boot() {
  const payload = payloadFromHash(location.hash);
  if (payload) return openShared(payload);
  const last = drafts.last();
  if (last?.screen !== "editor") return;
  const r = drafts.load(last.draftId);
  if (r) {
    store.open(r, last.draftId);
    store.go("editor");
  }
}

/** Open a saved draft by id (from the drafts list or the landing page's "continue"). */
export function openDraft(id: string) {
  flush();
  const r = drafts.load(id);
  if (!r) return false;
  store.open(r, id);
  store.go("editor");
  return true;
}
