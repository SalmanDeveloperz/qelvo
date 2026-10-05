import { useEffect, useRef, useState } from "react";
import { flush, drafts, openDraft } from "../persist/autosave";
import { shareUrl } from "../persist/share";
import { store, useStore } from "../state";
import { ICheck, ICopy, ILink, ITrash, IWarn, IX } from "./icons";

/**
 * Copy the share link to the clipboard inside the click itself. Safari only allows clipboard
 * writes during the user's gesture, so the (async) link goes in as a promised ClipboardItem.
 */
function copyLink(link: Promise<string>): Promise<void> {
  const clip = navigator.clipboard;
  if (!clip) return Promise.reject(new Error("no clipboard"));
  if (typeof ClipboardItem !== "undefined" && clip.write) {
    return clip.write([new ClipboardItem({ "text/plain": link.then((t) => new Blob([t], { type: "text/plain" })) })])
      .catch(() => link.then((t) => clip.writeText(t)));
  }
  return link.then((t) => clip.writeText(t));
}

export function ShareButton() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState<"yes" | "no" | "pending">("pending");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);

  const share = () => {
    const link = shareUrl(store.get().resume);
    setOpen(true);
    setUrl("");
    setCopied("pending");
    copyLink(link).then(() => setCopied("yes"), () => setCopied("no"));
    link.then(setUrl);
  };

  return (
    <div className="share-wrap" ref={box}>
      <button className="btn" onClick={share} title="Copy a link that opens this resume anywhere"><ILink size={15} /> <span className="share-lbl">Share</span></button>
      {open && (
        <div className="share-pop" role="dialog" aria-label="Share link">
          <div className="share-head">
            <b>{copied === "yes" ? <><ICheck size={14} /> Link copied</> : "Share a copy"}</b>
            <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close"><IX size={14} /></button>
          </div>
          <div className="share-row">
            <input className="input mono" readOnly value={url || "making the link…"} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
            <button className="btn sm" disabled={!url} onClick={() => copyLink(Promise.resolve(url)).then(() => setCopied("yes"), () => setCopied("no"))}><ICopy size={13} /> Copy</button>
          </div>
          {copied === "no" && <p className="share-warn"><IWarn size={13} /> Your browser blocked the clipboard. Select the link above and copy it.</p>}
          <p className="share-note">
            The resume is inside the link itself, so nothing is uploaded and the link works on any device. Anyone who opens it
            gets their own copy; their edits never change yours. It includes your contact details, so share it the way you'd share the PDF.
          </p>
          {url && <p className="share-meta mono">{(url.length / 1024).toFixed(1)} KB link · <a href={url} target="_blank" rel="noreferrer">test it in a new tab</a></p>}
        </div>
      )}
    </div>
  );
}

const ago = (t: number) => {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} day${d > 1 ? "s" : ""} ago` : new Date(t).toLocaleDateString();
};
export { ago };

/** "Saved" / "Saving…" in the top bar, so nobody has to wonder. */
export function SaveBadge() {
  const st = useStore((s) => s.saveState);
  const label = { saved: "Saved", pending: "Saving…", error: "Not saved: storage is full", off: "Not saved: storage is blocked" }[st];
  const tip = st === "saved" || st === "pending"
    ? "Saved in this browser, on this device. It stays until you clear this site's data. Download the .json from the ⋯ menu for a copy you control."
    : "This browser isn't letting Qelvo save. Download the PDF or .json before closing the tab.";
  return <span className={`save-badge ${st}`} title={tip} aria-live="polite">{st === "saved" ? <ICheck size={13} /> : st === "pending" ? <i className="save-dot" /> : <IWarn size={13} />}{label}</span>;
}

export function DraftsDialog({ onClose }: { onClose: () => void }) {
  const current = useStore((s) => s.draftId);
  const [, bump] = useState(0);
  useEffect(() => { flush(); bump((n) => n + 1); }, []);
  const list = drafts.list();
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label="Your drafts" onMouseDown={(e) => e.stopPropagation()}>
        <div className="share-head"><b>Your drafts</b><button className="icon-btn" onClick={onClose} aria-label="Close"><IX size={14} /></button></div>
        <p className="share-note">Saved in this browser only. Up to 30 are kept; the oldest go first.</p>
        {!drafts.available && <p className="share-warn"><IWarn size={13} /> This browser blocks storage, so drafts can't be kept.</p>}
        <div className="draft-list">
          {list.map((d) => (
            <div key={d.id} className={`draft ${d.id === current ? "on" : ""}`}>
              <button className="draft-open" onClick={() => { if (d.id !== current) openDraft(d.id); onClose(); }}>
                <b>{d.name}</b><span>{d.id === current ? "open now · " : ""}{ago(d.updated)}</span>
              </button>
              <button className="icon-btn danger" title="Delete draft" disabled={d.id === current}
                onClick={() => { if (confirm(`Delete “${d.name}”? This can't be undone.`)) { drafts.remove(d.id); bump((n) => n + 1); } }}><ITrash size={14} /></button>
            </div>
          ))}
          {!list.length && <p className="share-note">No drafts yet.</p>}
        </div>
        <div className="modal-foot"><button className="btn" onClick={() => { onClose(); store.go("setup"); }}>New resume</button></div>
      </div>
    </div>
  );
}

/** App-wide notice (shared link opened, broken link...). */
export function Notice() {
  const notice = useStore((s) => s.notice);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => store.notify(null), 7000);
    return () => clearTimeout(t);
  }, [notice]);
  if (!notice) return null;
  return <div className="toast notice" role="status" onClick={() => store.notify(null)}>{notice}</div>;
}
