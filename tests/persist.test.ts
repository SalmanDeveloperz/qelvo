// Autosave and share links: round trips, hostile input, broken links, storage failures.
//   npx tsx tests/persist.test.ts
import { REFERENCE, SAMPLES } from "../src/model/samples";
import { contact, entry, section } from "../src/model/factory";
import { emptyResume } from "../src/model/factory";
import { LIMITS, sanitizeResume } from "../src/model/sanitize";
import type { Resume } from "../src/model/types";
import { normUrl } from "../src/engine/common";
import { ALL_FONTS, compile, renderPdf } from "../src/engine";
import { Drafts, MAX_DRAFTS, type KV } from "../src/persist/drafts";
import { compact, decodeShare, encodeShare, payloadFromHash } from "../src/persist/share";
import { nodeBook } from "../scripts/node-fonts";
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";

let pass = 0;
let fail = 0;
const ok = (name: string, cond: unknown, detail = "") => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`); }
};
const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deflate = async (s: string) => {
  const r = new Blob([s]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(r).arrayBuffer());
};
const payloadOf = async (json: string) => "1" + b64url(await deflate(json));

// ── Share: every sample survives a round trip exactly ─────────────────
const all = [...Object.values(SAMPLES), ...Object.values(REFERENCE)].map((f) => f());
for (const r of all) {
  const p = await encodeShare(r);
  const d = await decodeShare(p);
  ok(`roundtrip ${r.template} ${r.name}`, d.ok && compact(d.resume) === compact(r));
  ok(`link size ${r.template}`, p.length < 6000, `${p.length} chars`);
  ok(`link is url-safe ${r.template}`, /^[0-9A-Za-z_-]+$/.test(p));
}

// Unicode, markup, custom name weight, icon flags, every page/paper option.
const uni: Resume = {
  ...emptyResume(), template: "blueprint", pages: 3, paper: "a4", nameStyle: "custom",
  name: "**محمد** سلمان 张伟 Zoë 🚀", headline: "Ingeniería · *distribuida* [site](https://example.com)",
  contacts: [{ ...contact("github", "zoe"), icon: false }, { ...contact("twitter", "@zoe", "https://x.com/zoe"), icon: true }],
  sections: [section("experience", { entries: [entry({ title: "Acme – Ünïcode", date: "2020 – Present", bullets: ["Shipped **x** in 10 ms", ["With link", "https://a.b/c?d=e&f=g#h"]] })] })],
};
{
  const d = await decodeShare(await encodeShare(uni));
  ok("unicode + options roundtrip", d.ok && compact(d.resume) === compact(uni), d.ok ? compact(d.resume) : d.reason);
  ok("icon false survives", d.ok && d.resume.contacts[0].icon === false);
}

// Fresh ids on every decode (no ids travel in links).
{
  const r = all[0];
  const d = await decodeShare(await encodeShare(r));
  ok("ids regenerated", d.ok && d.resume.sections[0].id !== r.sections[0].id && !!d.resume.sections[0].id);
}

// ── Share: broken and hostile links never throw and never open junk ───
const bad: [string, string, string][] = [
  ["empty", "", "version"],
  ["unknown version", "9abc", "version"],
  ["not base64", "1@@@###", "corrupt"],
  ["random base64", "1" + "A".repeat(40), "corrupt"],
  ["truncated link", (await encodeShare(all[0])).slice(0, 900), "corrupt"],
];
for (const [name, p, want] of bad) {
  const d = await decodeShare(p);
  ok(`bad: ${name}`, !d.ok && d.reason === want, JSON.stringify(d).slice(0, 80));
}
{
  // A ~5 KB link that inflates to 5 MB: must stop at the cap, not allocate it all.
  const bomb = await payloadOf(JSON.stringify({ name: "x".repeat(5_000_000) }));
  ok("zip bomb link is small", bomb.length < 20_000, `${bomb.length}`);
  const d = await decodeShare(bomb);
  ok("zip bomb refused", !d.ok && d.reason === "too-large");
}
ok("oversized link refused", ((await decodeShare("1" + "A".repeat(300_000))) as { reason?: string }).reason === "too-large");
{
  const d = await decodeShare(await payloadOf(JSON.stringify({ hello: "world" })));
  ok("json that isn't a resume", !d.ok && d.reason === "not-a-resume");
}
{
  const d = await decodeShare(await payloadOf("[1,2,3]"));
  ok("array instead of resume", !d.ok && d.reason === "not-a-resume");
}
{
  const d = await decodeShare(await payloadOf('{"name": "x", "version": 2}'));
  ok("future document version refused", !d.ok && d.reason === "not-a-resume");
}
{
  // Prototype pollution through __proto__ / constructor keys.
  const evil = '{"name":"x","__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted2":"yes"}},"sections":[{"__proto__":{"p3":1},"role":"experience","type":"entries","entries":[{"title":"t","__proto__":{"p4":1}}]}]}';
  const d = await decodeShare(await payloadOf(evil));
  const probe = {} as Record<string, unknown>;
  ok("proto pollution: decoded", d.ok);
  ok("proto pollution: no global effect", probe.polluted === undefined && probe.polluted2 === undefined && probe.p3 === undefined && probe.p4 === undefined);
  ok("proto pollution: clean object", d.ok && Object.getPrototypeOf(d.resume) === Object.prototype && !("polluted" in d.resume));
}
{
  // Wrong types and unknown values are coerced to safe defaults.
  const weird = JSON.stringify({
    name: 42, headline: { x: 1 }, template: "evil", pages: 99, paper: "legal", nameStyle: "bold",
    contacts: [{ kind: "telegram", text: "t", url: 5, icon: "yes" }, "junk", null],
    sections: [{ type: "video", role: "hack", column: "left", title: ["a"], entries: "nope", skills: [{ label: 1, value: null }] }],
    extra: "ignored",
  });
  const d = await decodeShare(await payloadOf(weird));
  ok("weird types decode", d.ok);
  if (d.ok) {
    const r = d.resume;
    ok("weird: template/pages/paper defaults", r.template === "modern" && r.pages === 1 && r.paper === "letter");
    ok("weird: number name kept as text", r.name === "42");
    ok("weird: object headline dropped", r.headline === "");
    ok("weird: bad nameStyle dropped", r.nameStyle === undefined);
    ok("weird: junk contacts dropped", r.contacts.length === 1 && r.contacts[0].kind === "other" && r.contacts[0].url === "5" && r.contacts[0].icon === undefined);
    ok("weird: section coerced", r.sections[0].type === "entries" && r.sections[0].role === "custom" && r.sections[0].column === "auto" && r.sections[0].title === "" && r.sections[0].entries.length === 0);
    ok("weird: unknown keys gone", !("extra" in r));
  }
}
{
  // Caps: huge arrays and strings are cut, control characters stripped.
  const big = sanitizeResume({
    name: "a\u0000b\u0007c\u001bd\ne\tf" + "x".repeat(5000),
    contacts: Array.from({ length: 500 }, () => ({ kind: "email", text: "a@b.c" })),
    // One huge section (500 entries x 500 bullets) plus 499 small ones.
    sections: [
      { role: "experience", type: "entries", entries: Array.from({ length: 500 }, () => ({ title: "t", bullets: Array.from({ length: 500 }, () => ({ text: "b" })) })) },
      ...Array.from({ length: 499 }, () => ({ role: "skills", type: "skills" })),
    ],
  })!;
  ok("caps: contacts", big.contacts.length === LIMITS.contacts);
  ok("caps: sections", big.sections.length === LIMITS.sections);
  ok("caps: entries", big.sections[0].entries.length === LIMITS.entries);
  ok("caps: bullets", big.sections[0].entries[0].bullets.length === LIMITS.bullets);
  ok("caps: name length", big.name.length === LIMITS.line);
  ok("control chars stripped, \\n \\t kept", big.name.startsWith("abcd\ne\tf"));
}

// ── Links inside resumes can't become script or file URLs in the PDF ──
for (const [u, want] of [
  ["javascript:alert(1)", /^https:\/\//], [" JavaScript:alert(1)", /^https:\/\//], ["vbscript:x", /^https:\/\//],
  ["data:text/html,<script>", /^https:\/\//], ["file:///etc/passwd", /^https:\/\//],
  ["https://ok.example", /^https:\/\/ok\.example$/], ["mailto:a@b.co", /^mailto:/], ["tel:+15551234", /^tel:/], ["me@x.io", /^mailto:me@x\.io$/],
] as const) ok(`normUrl ${u}`, want.test(normUrl(u)), normUrl(u));
{
  const r = sanitizeResume({
    name: "Evil", contacts: [{ kind: "website", text: "site", url: "javascript:alert(document.cookie)" }],
    sections: [{ role: "experience", type: "entries", entries: [{ title: "[click](javascript:alert(1))", link: "javascript:alert(2)", bullets: [{ text: "x [y](data:text/html,boom)", link: "file:///etc/passwd" }] }] }],
  })!;
  const book = nodeBook();
  await book.load(ALL_FONTS);
  // Read the link annotations back properly (objects may be compressed, so no byte grepping).
  const doc = await PDFDocument.load(await renderPdf(r, book, compile(r, book)));
  const uris: string[] = [];
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    for (let i = 0; i < (annots?.size() ?? 0); i++) {
      const a = annots!.lookup(i, PDFDict);
      const uri = a.lookup(PDFName.of("A"), PDFDict)?.lookup(PDFName.of("URI"));
      if (uri instanceof PDFString || uri instanceof PDFHexString) uris.push(uri.decodeText());
    }
  }
  ok("pdf links found", uris.length >= 4, JSON.stringify(uris));
  ok("pdf links all http(s)/mailto/tel", uris.every((u) => /^(https?:\/\/|mailto:|tel:)/i.test(u)), JSON.stringify(uris));
  ok("pdf has no script/data/file link", !uris.some((u) => /^(javascript|vbscript|data|file):/i.test(u)), JSON.stringify(uris));
}

// ── payloadFromHash ────────────────────────────────────────────────────
ok("hash ok", payloadFromHash("#r=1abc_-") === "1abc_-");
ok("hash other", payloadFromHash("#layouts") === null);
ok("hash junk", payloadFromHash("#r=1<script>") === null);
ok("hash empty", payloadFromHash("") === null);

// ── Drafts storage ─────────────────────────────────────────────────────
class MemKV implements KV {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
{
  const kv = new MemKV();
  const d = new Drafts(kv);
  d.save("a1", all[0], 1000);
  d.save("b2", all[1], 2000);
  ok("drafts: list newest first", d.list().map((x) => x.id).join() === "b2,a1");
  ok("drafts: load equals saved", compact(d.load("a1")!) === compact(all[0]));
  ok("drafts: name from resume", d.list()[1].name === "Muhammad Salman");
  d.save("a1", all[2], 3000);
  ok("drafts: update moves to top", d.list()[0].id === "a1" && d.list().length === 2);
  d.setLast({ draftId: "a1", screen: "editor" });
  ok("drafts: last", d.last()?.draftId === "a1" && d.last()?.screen === "editor");
  d.remove("a1");
  ok("drafts: remove", d.list().length === 1 && d.load("a1") === null && d.last() === null);
  for (let i = 0; i < MAX_DRAFTS + 7; i++) d.save(`x${i}`, all[0], 10_000 + i);
  ok("drafts: capped", d.list().length === MAX_DRAFTS);
  ok("drafts: evicted keys deleted", [...kv.m.keys()].filter((k) => k.startsWith("qelvo:draft:v1:")).length === MAX_DRAFTS);
  ok("drafts: oldest evicted", d.load("b2") === null && d.load("x0") === null && !!d.load(`x${MAX_DRAFTS + 6}`));
  kv.setItem("qelvo:draft:v1:x36", "{not json");
  ok("drafts: corrupt entry → null", d.load("x36") === null);
  kv.setItem("qelvo:drafts:v1", '[{"id":"../../etc","updated":1},{"id":"ok1","updated":2,"name":5},"junk"]');
  ok("drafts: index validated", d.list().map((x) => x.id).join() === "ok1" && d.list()[0].name === "");
  kv.setItem("qelvo:last:v1", '{"draftId":7}');
  ok("drafts: bad last ignored", d.last() === null);
}
{
  const full: KV = { getItem: () => null, setItem: () => { throw new DOMException("quota", "QuotaExceededError"); }, removeItem: () => {} };
  let threw = false;
  try { new Drafts(full).save("q", all[0]); } catch { threw = true; }
  ok("drafts: quota error surfaces", threw);
  let threw2 = false;
  try { new Drafts(null).save("q", all[0]); } catch { threw2 = true; }
  ok("drafts: blocked storage surfaces", threw2 && new Drafts(null).list().length === 0 && new Drafts(null).load("q") === null);
}

console.log(`\n${fail ? `${fail} FAILED, ` : ""}${pass} passed`);
process.exit(fail ? 1 : 0);
