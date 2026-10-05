// Share links that carry the resume inside them: https://qelvo.app/#r=1<data>
//
// Everything after "#" stays in the browser: it isn't sent to the server, so it never shows
// up in hosting logs, and there's no database to leak. The link is the document.
//
// Format v1: "1" + base64url(deflate-raw(compact JSON)). Ids and empty fields are left out
// (the reader rebuilds them), which with deflate keeps a full page resume to a few KB.
import { sanitizeResume } from "../model/sanitize";
import type { Resume } from "../model/types";

export const SHARE_PARAM = "r";
const VERSION = "1";
/** Compressed payload cap. A long two-page resume is ~6 KB. */
const MAX_LINK_CHARS = 200_000;
/** Decompressed cap, so a tiny link can't expand into gigabytes (a "zip bomb"). */
const MAX_JSON_BYTES = 1_000_000;

/** JSON without ids, empty strings, empty lists or unset options. Order is kept, so it's stable. */
export function compact(r: Resume): string {
  return JSON.stringify(r, function (this: unknown, k, v) {
    if (Array.isArray(this)) return v;
    if (k === "id") return undefined;
    if (v === "" || v === undefined || (Array.isArray(v) && v.length === 0)) return undefined;
    return v;
  });
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Error("too large"); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The fragment payload for a resume (without "#r="). */
export async function encodeShare(r: Resume): Promise<string> {
  const json = new TextEncoder().encode(compact(r));
  return VERSION + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export type Decoded = { ok: true; resume: Resume } | { ok: false; reason: "version" | "corrupt" | "too-large" | "not-a-resume" };

/** Decode a payload from someone else's link. Never throws; never trusts the content. */
export async function decodeShare(payload: string): Promise<Decoded> {
  if (payload.length > MAX_LINK_CHARS) return { ok: false, reason: "too-large" };
  if (payload[0] !== VERSION) return { ok: false, reason: "version" };
  let text: string;
  try {
    const raw = await pipe(fromBase64Url(payload.slice(1)), new DecompressionStream("deflate-raw"), MAX_JSON_BYTES);
    text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch (e) {
    return { ok: false, reason: (e as Error).message === "too large" ? "too-large" : "corrupt" };
  }
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, reason: "corrupt" }; }
  const resume = sanitizeResume(data);
  return resume ? { ok: true, resume } : { ok: false, reason: "not-a-resume" };
}

/** Full link for a resume, on whatever origin the app runs (localhost now, your domain later). */
export async function shareUrl(r: Resume, origin = location.origin): Promise<string> {
  return `${origin}/#${SHARE_PARAM}=${await encodeShare(r)}`;
}

/** The payload in a location hash like "#r=1abc", or null. */
export function payloadFromHash(hash: string): string | null {
  const m = /^#r=([0-9][A-Za-z0-9_-]*)$/.exec(hash.trim());
  return m ? m[1] : null;
}
