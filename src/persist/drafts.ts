// Drafts in the browser's localStorage: they stay until the user clears site data.
// Each draft is its own key (saving one never rewrites the others) plus a small index.
// Everything read back goes through sanitizeResume, so a corrupted or hand-edited entry
// is dropped instead of crashing the app. Nothing here ever leaves the device.
import { plain } from "../model/inline";
import { sanitizeResume } from "../model/sanitize";
import type { Resume, TemplateId } from "../model/types";

export interface DraftMeta {
  id: string;
  name: string;
  template: TemplateId;
  updated: number;
}

/** The subset of Storage we use, so tests can pass an in-memory one. */
export type KV = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const INDEX = "qelvo:drafts:v1";
const LAST = "qelvo:last:v1";
const draftKey = (id: string) => `qelvo:draft:v1:${id}`;
export const MAX_DRAFTS = 30;

export class Drafts {
  constructor(private kv: KV | null) {}

  /** Browser storage, or null when it's blocked (some private modes, disabled cookies). */
  static browser(): Drafts {
    try {
      const s = window.localStorage;
      const probe = "qelvo:probe";
      s.setItem(probe, "1");
      s.removeItem(probe);
      return new Drafts(s);
    } catch {
      return new Drafts(null);
    }
  }

  get available() { return this.kv !== null; }

  list(): DraftMeta[] {
    const raw = this.read(INDEX);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((d): d is DraftMeta => !!d && typeof d.id === "string" && /^[a-z0-9]{1,40}$/i.test(d.id) && typeof d.updated === "number")
      .map((d) => ({ id: d.id, name: typeof d.name === "string" ? d.name.slice(0, 120) : "", template: d.template, updated: d.updated }))
      .sort((a, b) => b.updated - a.updated);
  }

  load(id: string): Resume | null {
    return sanitizeResume(this.read(draftKey(id)));
  }

  /** Save (create or update). Throws when storage is unavailable or full, so callers can say so. */
  save(id: string, r: Resume, now = Date.now()) {
    if (!this.kv) throw new Error("storage unavailable");
    this.kv.setItem(draftKey(id), JSON.stringify(r));
    const meta: DraftMeta = { id, name: draftName(r), template: r.template, updated: now };
    const others = this.list().filter((d) => d.id !== id);
    const all = [meta, ...others];
    // Keep the most recent ones; the oldest beyond the cap go.
    for (const old of all.slice(MAX_DRAFTS)) this.kv.removeItem(draftKey(old.id));
    this.kv.setItem(INDEX, JSON.stringify(all.slice(0, MAX_DRAFTS)));
  }

  remove(id: string) {
    if (!this.kv) return;
    this.kv.removeItem(draftKey(id));
    this.kv.setItem(INDEX, JSON.stringify(this.list().filter((d) => d.id !== id)));
    if (this.last()?.draftId === id) this.kv.removeItem(LAST);
  }

  /** Where the user was, so a reload puts them back in the editor. */
  setLast(v: { draftId: string; screen: "editor" | "other" }) {
    try { this.kv?.setItem(LAST, JSON.stringify(v)); } catch { /* best effort */ }
  }

  last(): { draftId: string; screen: "editor" | "other" } | null {
    const v = this.read(LAST) as { draftId?: unknown; screen?: unknown } | null;
    return v && typeof v.draftId === "string" && (v.screen === "editor" || v.screen === "other") ? { draftId: v.draftId, screen: v.screen } : null;
  }

  private read(key: string): unknown {
    try {
      const s = this.kv?.getItem(key);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }
}

export function draftName(r: Resume): string {
  return plain(r.name).replace(/\s+/g, " ").trim().slice(0, 80) || "Untitled resume";
}

/** Short, URL-safe, unguessable enough for a local key. */
export function newDraftId(): string {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return a[0].toString(36) + a[1].toString(36);
}
