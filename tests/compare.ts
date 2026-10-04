// Field-level comparison of a parsed resume against ground truth.
import type { Resume } from "../src/model/types";

/** Flatten to "path → value" so every field is scored independently. */
export function flatten(r: Resume): Record<string, string> {
  const o: Record<string, string> = { name: r.name, headline: r.headline };
  // Contacts are a set: order on the page doesn't matter.
  for (const c of r.contacts) o[`contact:${c.kind}:${c.text.toLowerCase()}`] = c.url;
  r.sections.forEach((s, si) => {
    const p = `s${si}`;
    o[`${p}.title`] = `${s.title} [${s.role}/${s.type}]`;
    if (s.type === "summary") o[`${p}.text`] = s.text;
    if (s.type === "entries") s.entries.forEach((e, ei) => {
      for (const k of ["title", "subtitle", "date", "location", "meta", "link"] as const) o[`${p}.e${ei}.${k}`] = e[k];
      e.bullets.forEach((b, bi) => { o[`${p}.e${ei}.b${bi}`] = b.text; if (b.link) o[`${p}.e${ei}.b${bi}.link`] = b.link; });
    });
    if (s.type === "skills") s.skills.forEach((k, ki) => (o[`${p}.k${ki}`] = `${k.label}: ${k.value}`));
    if (s.type === "list") s.items.forEach((it, ii) => (o[`${p}.i${ii}`] = it.text + (it.link ? ` <${it.link}>` : "")));
  });
  for (const k of Object.keys(o)) if (o[k] === "" && !k.startsWith("contact:")) delete o[k];
  return o;
}

export interface Score { fields: number; correct: number; pct: number; diffs: string[] }

export function score(truth: Resume, got: Resume): Score {
  const a = flatten(truth);
  const b = flatten(got);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diffs: string[] = [];
  let ok = 0;
  for (const k of keys) {
    if ((a[k] ?? "") === (b[k] ?? "")) ok++;
    else diffs.push(`${k}\n      want «${(a[k] ?? "∅").slice(0, 90)}»\n      got  «${(b[k] ?? "∅").slice(0, 90)}»`);
  }
  return { fields: keys.size, correct: ok, pct: (100 * ok) / Math.max(1, keys.size), diffs };
}
