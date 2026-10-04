// The "code" side of the editor: a small, LaTeX-flavoured source language that
// round-trips losslessly with the Resume model.
//
//   \entry{Organisation}{Role}{Dates}{Location}
//     \meta{tech stack / repos / GPA}
//     \url{https://…}
//     \item Bullet text with \textbf{bold} and \href{url}{links} \linkicon{https://…}
//
// Structural commands must start a line; anything else continues the previous
// paragraph or bullet. Errors carry line numbers, like a compiler log.
import { ROLE_TITLE, ROLE_TYPE, bullet, contact, entry, item, roleFromTitle, section, skill } from "../model/factory";
import { parseInline } from "../model/inline";
import type { ColumnPref, ContactKind, Entry, Paper, Resume, Section, SectionRole, TemplateId } from "../model/types";

export interface Diagnostic {
  line: number; // 1-based
  severity: "error" | "warning";
  message: string;
}

/** Field path → 1-based line in the source (for click-to-locate). */
export type LineMap = Record<string, number>;

// ── Serialisation ─────────────────────────────────────────────────────

const ESC: Record<string, string> = {
  "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", "_": "\\_", "{": "\\{", "}": "\\}",
  "~": "\\textasciitilde{}", "^": "\\textasciicircum{}",
};

function escText(s: string): string {
  return s
    .replace(/[\\&%$#_{}~^]/g, (c) => ESC[c])
    .replace(/—/g, "---")
    .replace(/–/g, "--");
}

/** URLs keep their characters; only TeX-active ones that would break parsing are escaped. */
function escUrl(u: string): string {
  return u.replace(/[%#{}\\]/g, (c) => "\\" + c);
}

/** Inline markup (**b**, *i*, [t](u)) → LaTeX. */
export function markupToLatex(src: string): string {
  let out = "";
  for (const r of parseInline(src)) {
    let t = escText(r.text);
    if (r.italic) t = `\\textit{${t}}`;
    if (r.bold) t = `\\textbf{${t}}`;
    if (r.url) t = `\\href{${escUrl(r.url)}}{${t}}`;
    out += t;
  }
  return out;
}

const CONTACT_CMD: Record<ContactKind, string> = {
  phone: "phone", email: "email", location: "location", linkedin: "linkedin", github: "github", twitter: "twitter", website: "website", other: "contact",
};

export function serialize(r: Resume): { code: string; map: LineMap } {
  const lines: string[] = [];
  const map: LineMap = {};
  const push = (s: string, path?: string) => {
    lines.push(s);
    if (path) map[path] = lines.length;
  };
  push("% ───────────────────────────────────────────────────────────────");
  push("%  resume.tex  ·  Qelvo");
  push("%  Edit anything. The PDF on the right recompiles as you type.");
  push("%  \\entry{Organisation}{Role / Degree}{Dates}{Location}");
  push("%  inline: \\textbf{bold}  \\textit{italic}  \\href{url}{text}");
  push("% ───────────────────────────────────────────────────────────────");
  push(`\\template{${r.template}}${pad(r.template)}% modern | blueprint | classic | academic`);
  push(`\\pages{${r.pages}}${pad(String(r.pages))}% target page count: 1, 2 or 3`);
  push(`\\paper{${r.paper}}${pad(r.paper)}% letter | a4`);
  push("");
  push(r.nameStyle === "custom" ? `\\name[custom]{${markupToLatex(r.name)}}` : `\\name{${escText(r.name)}}`, "name");
  if (r.headline.trim()) push(`\\headline{${markupToLatex(r.headline)}}`, "headline");
  r.contacts.forEach((c, i) => {
    const cmd = CONTACT_CMD[c.kind];
    const autoUrl = c.kind === "email" ? `mailto:${c.text}` : "";
    const urlArg = c.url && c.url !== autoUrl ? `{${escUrl(c.url)}}` : "";
    const iconOpt = c.icon === true ? "[icon]" : c.icon === false ? "[noicon]" : "";
    push(`\\${cmd}${iconOpt}{${escText(c.text)}}${urlArg}`, `contacts.${i}`);
  });
  push("");
  push("\\begin{document}");
  r.sections.forEach((s, si) => {
    const p = `sections.${si}`;
    push("");
    const opts: string[] = [];
    if (roleFromTitle(s.title) !== s.role) opts.push(s.role);
    if (s.column !== "auto") opts.push(s.column);
    push(`\\section${opts.length ? `[${opts.join(",")}]` : ""}{${escText(s.title)}}`, `${p}.title`);
    map[p] = lines.length;
    switch (s.type) {
      case "summary":
        for (const para of (s.text || "").split(/\n{2,}/)) push(markupToLatex(para.trim()), `${p}.text`);
        break;
      case "skills":
        s.skills.forEach((k, ki) => {
          push(`\\skill{${markupToLatex(k.label)}}{${markupToLatex(k.value)}}`, `${p}.skills.${ki}.label`);
          map[`${p}.skills.${ki}.value`] = lines.length;
          map[`${p}.skills.${ki}`] = lines.length;
        });
        break;
      case "list":
        s.items.forEach((it, ii) => {
          push(`\\listitem${it.link ? `[${escUrl(it.link)}]` : ""}{${markupToLatex(it.text)}}`, `${p}.items.${ii}.text`);
          map[`${p}.items.${ii}`] = lines.length;
        });
        break;
      case "entries":
        s.entries.forEach((e, ei) => serializeEntry(e, `${p}.entries.${ei}`, push, map, lines));
        break;
    }
  });
  push("");
  push("\\end{document}");
  return { code: lines.join("\n") + "\n", map };
}

function serializeEntry(e: Entry, p: string, push: (s: string, path?: string) => void, map: LineMap, lines: string[]) {
  const args = [e.title, e.subtitle, e.date, e.location].map(markupToLatex);
  push(`\\entry{${args.join("}{")}}`, `${p}.title`);
  for (const f of ["subtitle", "date", "location"]) map[`${p}.${f}`] = lines.length;
  map[p] = lines.length;
  if (e.meta.trim()) push(`  \\meta{${markupToLatex(e.meta)}}`, `${p}.meta`);
  if (e.link.trim()) push(`  \\url{${escUrl(e.link)}}`, `${p}.link`);
  e.bullets.forEach((b, bi) => {
    push(`  \\item ${markupToLatex(b.text)}${b.link ? ` \\linkicon{${escUrl(b.link)}}` : ""}`, `${p}.bullets.${bi}`);
  });
}

const pad = (s: string) => " ".repeat(Math.max(1, 12 - s.length));

// ── Parsing ───────────────────────────────────────────────────────────

const STRUCT = new Set([
  "template", "pages", "paper", "name", "headline", "phone", "email", "linkedin", "github", "twitter", "location", "website", "contact",
  "section", "entry", "meta", "url", "item", "skill", "listitem", "begin", "end",
]);

const ROLES = new Set<SectionRole>(Object.keys(ROLE_TITLE) as SectionRole[]);

interface Cursor { src: string; i: number; line: number }

/** Strip a % comment (not \%) from a line. */
function stripComment(line: string): string {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\\") { i++; continue; }
    if (line[i] === "%") return line.slice(0, i);
  }
  return line;
}

function readGroup(c: Cursor, open: string, close: string): string | null {
  if (c.src[c.i] !== open) return null;
  let depth = 0;
  const start = c.i + 1;
  for (; c.i < c.src.length; c.i++) {
    const ch = c.src[c.i];
    if (ch === "\\") { c.i++; continue; }
    if (ch === "\n") c.line++;
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) { c.i++; return c.src.slice(start, c.i - 1); }
  }
  return null;
}

function skipWs(c: Cursor, newlines = false) {
  while (c.i < c.src.length && (c.src[c.i] === " " || c.src[c.i] === "\t" || (newlines && c.src[c.i] === "\n"))) {
    if (c.src[c.i] === "\n") c.line++;
    c.i++;
  }
}

/** LaTeX inline → markup. Collects warnings for commands we don't understand. */
export function latexToMarkup(raw: string, line: number, diags: Diagnostic[], extract?: { linkicon?: string }): string {
  let out = "";
  const c: Cursor = { src: raw, i: 0, line };
  while (c.i < raw.length) {
    const ch = raw[c.i];
    if (ch === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(raw.slice(c.i));
      if (!m) { c.i++; continue; }
      const name = m[1];
      c.i += m[0].length;
      if (name.length === 1 && !/[A-Za-z]/.test(name)) {
        out += name === "\\" ? " " : name === "," ? " " : "&%$#_{}~^*[]".includes(name) ? (("*[]".includes(name) ? "\\" : "") + name) : name;
        continue;
      }
      const sym: Record<string, string> = { textbackslash: "\\", textasciitilde: "~", textasciicircum: "^", textbar: "|", textbullet: "•", ldots: "…", dots: "…", LaTeX: "LaTeX", TeX: "TeX", newline: " ", hfill: " ", quad: " ", qquad: " " };
      if (name in sym) { if (raw[c.i] === "{" && raw[c.i + 1] === "}") c.i += 2; out += sym[name]; continue; }
      skipWs(c);
      const a = readGroup(c, "{", "}");
      if (name === "textbf" || name === "bf") out += `**${latexToMarkup(a ?? "", c.line, diags)}**`;
      else if (name === "textit" || name === "emph" || name === "it") out += `*${latexToMarkup(a ?? "", c.line, diags)}*`;
      else if (name === "href") {
        const t = (skipWs(c), readGroup(c, "{", "}"));
        out += `[${latexToMarkup(t ?? a ?? "", c.line, diags)}](${unescUrl(a ?? "")})`;
      } else if (name === "linkicon") {
        if (extract) extract.linkicon = unescUrl(a ?? "");
      } else if (name === "underline" || name === "textrm" || name === "textsf" || name === "textnormal" || name === "mbox" || name === "small" || name === "textsc") {
        out += latexToMarkup(a ?? "", c.line, diags);
      } else if (name === "url") {
        const u = unescUrl(a ?? "");
        out += `[${u}](${u})`;
      } else {
        diags.push({ line: c.line, severity: "warning", message: `Unknown command \\${name}: kept its text.` });
        if (a !== null) out += latexToMarkup(a, c.line, diags);
      }
      continue;
    }
    if (ch === "{" || ch === "}") { c.i++; continue; }
    if (ch === "~") { out += " "; c.i++; continue; }
    if (ch === "*" || ch === "[" || ch === "]") { out += "\\" + ch; c.i++; continue; }
    out += ch;
    c.i++;
  }
  return out
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/``/g, "“")
    .replace(/''/g, "”")
    .replace(/\s+/g, " ")
    .trim();
}

const unescUrl = (u: string) => u.trim().replace(/\\([%#{}\\_&])/g, "$1");

export interface ParseResult {
  resume: Resume;
  diagnostics: Diagnostic[];
  map: LineMap;
}

/** Parse source into a Resume. `base` supplies ids so the form keeps focus across edits. */
export function parse(code: string, base?: Resume): ParseResult {
  const diags: Diagnostic[] = [];
  const map: LineMap = {};
  const r: Resume = { version: 1, template: "modern", pages: 1, paper: "letter", name: "", headline: "", contacts: [], sections: [] };
  const rawLines = code.split(/\r?\n/);
  const lines = rawLines.map(stripComment);
  // Join lines into one string for brace scanning, keeping line numbers.
  const joined = lines.join("\n");
  const c: Cursor = { src: joined, i: 0, line: 1 };

  let sec: Section | null = null;
  let ent: Entry | null = null;
  /** Where free text currently flows: a summary paragraph or the last bullet. */
  let flow: { kind: "summary" | "bullet"; buf: string[]; line: number } | null = null;
  const sectionKinds = new Map<Section, Set<string>>();

  const closeFlow = () => {
    if (!flow) return;
    const extract: { linkicon?: string } = {};
    const text = latexToMarkup(flow.buf.join(" "), flow.line, diags, extract);
    if (flow.kind === "summary" && sec) {
      sec.text = sec.text ? `${sec.text}\n\n${text}` : text;
      map[`sections.${r.sections.length - 1}.text`] ??= flow.line;
    } else if (flow.kind === "bullet" && ent) {
      const b = ent.bullets[ent.bullets.length - 1];
      b.text = text;
      if (extract.linkicon) b.link = extract.linkicon;
    }
    flow = null;
  };

  const arg = (required = true): string | null => {
    skipWs(c);
    const opened = c.line;
    const wasBrace = c.src[c.i] === "{";
    const a = readGroup(c, "{", "}");
    if (a === null && wasBrace) {
      // Runaway argument: report where the brace was opened, not where the file ended.
      diags.push({ line: opened, severity: "error", message: "Missing }. The { on this line is never closed." });
      c.line = opened;
    } else if (a === null && required) diags.push({ line: c.line, severity: "error", message: "Expected {…} argument." });
    return a;
  };
  const optArg = (): string | null => {
    skipWs(c);
    return c.src[c.i] === "[" ? readGroup(c, "[", "]") : null;
  };
  const markup = (s: string | null, line: number) => latexToMarkup(s ?? "", line, diags);

  while (c.i < joined.length) {
    // At the start of a line.
    const lineStart = c.i;
    const startLine = c.line;
    skipWs(c);
    const m = /^\\([A-Za-z]+)/.exec(joined.slice(c.i, c.i + 40));
    const lineEnd = () => {
      // Move to the next line; trailing junk after a structural command is a warning.
      const nl = joined.indexOf("\n", c.i);
      const rest = joined.slice(c.i, nl < 0 ? joined.length : nl).trim();
      if (rest) diags.push({ line: c.line, severity: "warning", message: `Ignored trailing text “${rest.slice(0, 30)}”.` });
      c.i = nl < 0 ? joined.length : nl + 1;
      c.line++;
    };
    if (m && STRUCT.has(m[1])) {
      const cmd = m[1];
      c.i += m[0].length;
      const L = startLine;
      switch (cmd) {
        case "template": {
          const v = (arg() ?? "").trim() as TemplateId;
          if (v === "classic" || v === "academic" || v === "modern" || v === "blueprint") r.template = v;
          else diags.push({ line: L, severity: "error", message: `Unknown template “${v}”: use modern, blueprint, classic or academic.` });
          lineEnd();
          break;
        }
        case "pages": {
          const n = Number((arg() ?? "").trim());
          if (n === 1 || n === 2 || n === 3) r.pages = n;
          else diags.push({ line: L, severity: "error", message: "\\pages must be 1, 2 or 3." });
          lineEnd();
          break;
        }
        case "paper": {
          const v = (arg() ?? "").trim() as Paper;
          if (v === "letter" || v === "a4") r.paper = v;
          else diags.push({ line: L, severity: "error", message: "\\paper must be letter or a4." });
          lineEnd();
          break;
        }
        case "name": {
          closeFlow();
          // \name[custom]{…} (or any \textbf inside) = the markup decides which words are bold.
          const custom = (optArg() ?? "").trim() === "custom";
          const v = markup(arg(), L);
          if (custom || /\*/.test(v.replace(/\\\*/g, ""))) { r.nameStyle = "custom"; r.name = v; }
          else r.name = v;
          map.name = L;
          lineEnd();
          break;
        }
        case "headline":
          r.headline = markup(arg(), L);
          map.headline = L;
          lineEnd();
          break;
        case "phone": case "email": case "linkedin": case "github": case "twitter": case "location": case "website": case "contact": {
          const kind = (cmd === "contact" ? "other" : cmd) as ContactKind;
          // \github[icon]{…} / \phone[noicon]{…}: an explicit icon choice; no option = template default.
          const opt = (optArg() ?? "").trim();
          const text = markup(arg(), L);
          const url = arg(false);
          const ct = contact(kind, text, url !== null ? unescUrl(url) : kind === "email" ? `mailto:${text}` : "");
          if (opt === "icon") ct.icon = true;
          else if (opt === "noicon") ct.icon = false;
          else if (opt) diags.push({ line: L, severity: "warning", message: `Unknown option “${opt}”: use [icon] or [noicon].` });
          map[`contacts.${r.contacts.length}`] = L;
          r.contacts.push(ct);
          lineEnd();
          break;
        }
        case "begin": case "end": {
          const env = arg();
          if (env !== "document") diags.push({ line: L, severity: "warning", message: `Environment “${env}” isn't needed here: ignored.` });
          closeFlow();
          if (cmd === "end") { sec = null; ent = null; }
          lineEnd();
          break;
        }
        case "section": {
          closeFlow();
          const opts = (optArg() ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
          const title = markup(arg(), L).replace(/\*\*/g, "");
          let role = roleFromTitle(title);
          let column: ColumnPref = "auto";
          for (const o of opts) {
            if (o === "main" || o === "side" || o === "auto") column = o;
            else if (ROLES.has(o as SectionRole)) role = o as SectionRole;
            else diags.push({ line: L, severity: "warning", message: `Unknown section option “${o}”.` });
          }
          sec = section(role, { title, column });
          sec.type = ROLE_TYPE[role];
          sectionKinds.set(sec, new Set());
          ent = null;
          map[`sections.${r.sections.length}.title`] = L;
          map[`sections.${r.sections.length}`] = L;
          r.sections.push(sec);
          lineEnd();
          break;
        }
        case "entry": {
          closeFlow();
          if (!sec) { diags.push({ line: L, severity: "error", message: "\\entry must come after a \\section." }); lineEnd(); break; }
          const a = [arg(), arg(false), arg(false), arg(false)].map((x) => markup(x, L));
          ent = entry({ title: a[0], subtitle: a[1], date: a[2], location: a[3] });
          sectionKinds.get(sec)!.add("entries");
          const p = `sections.${r.sections.length - 1}.entries.${sec.entries.length}`;
          for (const f of ["", ".title", ".subtitle", ".date", ".location"]) map[p + f] = L;
          sec.entries.push(ent);
          lineEnd();
          break;
        }
        case "meta": case "url": {
          closeFlow();
          if (!ent || !sec) { diags.push({ line: L, severity: "error", message: `\\${cmd} must follow an \\entry.` }); lineEnd(); break; }
          const v = arg();
          if (cmd === "meta") ent.meta = markup(v, L);
          else ent.link = unescUrl(v ?? "");
          map[`sections.${r.sections.length - 1}.entries.${sec.entries.length - 1}.${cmd === "meta" ? "meta" : "link"}`] = L;
          lineEnd();
          break;
        }
        case "item": {
          closeFlow();
          if (!sec) { diags.push({ line: L, severity: "error", message: "\\item must come after a \\section." }); lineEnd(); break; }
          if (!ent) {
            // Bullets straight under a section: give them an untitled entry.
            ent = entry();
            sec.entries.push(ent);
            sectionKinds.get(sec)!.add("entries");
          }
          ent.bullets.push(bullet());
          map[`sections.${r.sections.length - 1}.entries.${sec.entries.length - 1}.bullets.${ent.bullets.length - 1}`] = L;
          const nl = joined.indexOf("\n", c.i);
          const rest = joined.slice(c.i, nl < 0 ? joined.length : nl);
          flow = { kind: "bullet", buf: [rest], line: L };
          c.i = nl < 0 ? joined.length : nl + 1;
          c.line++;
          break;
        }
        case "skill": {
          closeFlow();
          if (!sec) { diags.push({ line: L, severity: "error", message: "\\skill must come after a \\section." }); lineEnd(); break; }
          const label = markup(arg(), L);
          const value = markup(arg(false), L);
          sectionKinds.get(sec)!.add("skills");
          const p = `sections.${r.sections.length - 1}.skills.${sec.skills.length}`;
          map[p] = map[`${p}.label`] = map[`${p}.value`] = L;
          sec.skills.push(skill(label, value));
          lineEnd();
          break;
        }
        case "listitem": {
          closeFlow();
          if (!sec) { diags.push({ line: L, severity: "error", message: "\\listitem must come after a \\section." }); lineEnd(); break; }
          const link = optArg();
          const text = markup(arg(), L);
          sectionKinds.get(sec)!.add("list");
          const p = `sections.${r.sections.length - 1}.items.${sec.items.length}`;
          map[p] = map[`${p}.text`] = L;
          sec.items.push(item(text, link ? unescUrl(link) : ""));
          lineEnd();
          break;
        }
      }
      continue;
    }
    // Plain content line.
    c.i = lineStart;
    const nl = joined.indexOf("\n", c.i);
    const text = joined.slice(c.i, nl < 0 ? joined.length : nl);
    c.i = nl < 0 ? joined.length : nl + 1;
    c.line++;
    if (!text.trim()) {
      if (flow?.kind === "summary") closeFlow(); // blank line ends a paragraph
      continue;
    }
    if (/^\s*\\[A-Za-z]/.test(text) && !/^\s*\\(textbf|textit|emph|href|url|underline)\b/.test(text)) {
      const name = /^\s*\\([A-Za-z]+)/.exec(text)![1];
      if (!flow) { diags.push({ line: startLine, severity: "warning", message: `Unknown command \\${name}: line ignored.` }); continue; }
    }
    if (flow) { flow.buf.push(text); continue; }
    if (!sec) { diags.push({ line: startLine, severity: "warning", message: "Text outside a section is ignored: add a \\section first." }); continue; }
    flow = { kind: "summary", buf: [text], line: startLine };
    sectionKinds.get(sec)!.add("summary");
  }
  closeFlow();

  // A section's type follows what it actually contains.
  for (const s of r.sections) {
    const kinds = sectionKinds.get(s)!;
    if (kinds.size === 1) s.type = [...kinds][0] as Section["type"];
    else if (kinds.size > 1) diags.push({ line: map[`sections.${r.sections.indexOf(s)}`] ?? 1, severity: "warning", message: `“${s.title}” mixes ${[...kinds].join(" and ")}: only the ${s.type} part is shown.` });
  }
  if (!r.name.trim()) diags.push({ line: 1, severity: "warning", message: "No \\name{…}: your resume has no header." });
  if (base) carryIds(base, r);
  return { resume: r, diagnostics: diags, map };
}

/** Keep stable ids from the previous model so React keys (and focus) survive re-parsing. */
function carryIds(prev: Resume, next: Resume) {
  next.contacts.forEach((c, i) => { if (prev.contacts[i]) c.id = prev.contacts[i].id; });
  next.sections.forEach((s, si) => {
    const ps = prev.sections[si];
    if (!ps) return;
    s.id = ps.id;
    s.entries.forEach((e, ei) => {
      const pe = ps.entries[ei];
      if (!pe) return;
      e.id = pe.id;
      e.bullets.forEach((b, bi) => { if (pe.bullets[bi]) b.id = pe.bullets[bi].id; });
    });
    s.skills.forEach((k, ki) => { if (ps.skills[ki]) k.id = ps.skills[ki].id; });
    s.items.forEach((it, ii) => { if (ps.items[ii]) it.id = ps.items[ii].id; });
  });
}
