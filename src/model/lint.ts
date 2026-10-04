// Resume "compiler warnings": the things a hiring manager or an ATS trips over.
// Advice only: nothing here rewrites the user's words.
import { plain } from "./inline";
import type { Resume } from "./types";

export interface Hint {
  path: string;
  severity: "warning" | "info";
  message: string;
}

const WEAK = /^(responsible for|worked on|helped( with)?|assisted( with| in)?|participated in|involved in|tasked with|duties included|in charge of|handled)\b/i;
const FIRST_PERSON = /\b(I|me|my|myself)\b/;
const BUZZ = /\b(synerg\w*|rockstar|ninja|guru|passionate|hard[- ]working|go-getter|team player|detail[- ]oriented|results[- ]driven)\b/i;
const BAD_RANGE = /\b(\d{4})\s*[-–—]\s*(\w)|\b(\d{4})[–—-](\w)/;

export function lint(r: Resume): Hint[] {
  const out: Hint[] = [];
  if (!r.name.trim()) out.push({ path: "name", severity: "warning", message: "Add your name. It's the first thing a recruiter reads." });
  const kinds = new Set(r.contacts.filter((c) => c.text.trim()).map((c) => c.kind));
  if (!kinds.has("email")) out.push({ path: "contacts", severity: "warning", message: "No email address. Recruiters can't reply to a resume without one." });
  if (!kinds.has("phone")) out.push({ path: "contacts", severity: "info", message: "No phone number. Many recruiters call before they email." });
  r.contacts.forEach((c, i) => {
    if (c.kind === "email" && c.text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.text.trim())) out.push({ path: `contacts.${i}`, severity: "warning", message: `“${c.text}” doesn't look like an email address.` });
    if (/^http:\/\//i.test(c.url)) out.push({ path: `contacts.${i}`, severity: "info", message: "Use https:// links. Some ATS portals strip plain http." });
  });

  r.sections.forEach((s, si) => {
    const p = `sections.${si}`;
    if (s.type === "summary") {
      const words = plain(s.text).split(/\s+/).filter(Boolean).length;
      if (words > 75) out.push({ path: `${p}.text`, severity: "info", message: `Summary is ${words} words. 40–60 words is read; 90 is skimmed.` });
      if (FIRST_PERSON.test(plain(s.text))) out.push({ path: `${p}.text`, severity: "info", message: "Summaries read stronger without “I/my”. Lead with what you do." });
      if (BUZZ.test(plain(s.text))) out.push({ path: `${p}.text`, severity: "info", message: `“${BUZZ.exec(plain(s.text))![0]}” is filler to most reviewers: show it with a fact instead.` });
    }
    if (s.type !== "entries") return;
    s.entries.forEach((e, ei) => {
      const ep = `${p}.entries.${ei}`;
      const where = e.title || s.title;
      if (e.date && BAD_RANGE.test(e.date) && !/\s–\s/.test(e.date)) out.push({ path: `${ep}.date`, severity: "info", message: `${where}: write date ranges as “May 2023 -- Sep 2023” (renders as an en dash with spaces).` });
      if (s.role === "experience" && !e.date.trim()) out.push({ path: `${ep}.date`, severity: "warning", message: `${where}: no dates. Reviewers assume the worst about undated roles.` });
      let numbers = 0;
      e.bullets.forEach((b, bi) => {
        const bp = `${ep}.bullets.${bi}`;
        const t = plain(b.text).trim();
        if (!t) return;
        if (/\d/.test(t)) numbers++;
        const weak = WEAK.exec(t);
        if (weak) out.push({ path: bp, severity: "warning", message: `${where}: “${weak[0]}…” describes a duty, not a result. Lead with what you built or changed.` });
        if (FIRST_PERSON.test(t)) out.push({ path: bp, severity: "info", message: `${where}: drop “I/my” from bullets. The subject is implied.` });
        if (t.length > 260) out.push({ path: bp, severity: "info", message: `${where}: this bullet runs ${Math.ceil(t.length / 95)} lines. Split it, or keep the strongest half.` });
      });
      const live = e.bullets.filter((b) => plain(b.text).trim());
      if (s.role === "experience" && live.length >= 3 && numbers === 0) out.push({ path: ep, severity: "info", message: `${where}: no numbers in any bullet. One honest metric (users, latency, build time) is worth three adjectives.` });
      const periods = live.filter((b) => /\.\s*$/.test(plain(b.text))).length;
      if (periods && periods !== live.length) out.push({ path: ep, severity: "info", message: `${where}: some bullets end with a period and some don't: pick one.` });
    });
  });
  return out;
}
