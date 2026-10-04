// Offline resume parser. Turns extracted layout into structured data using the
// cues a person reads with: type size and weight, indentation, bullet glyphs,
// date shapes, and the vocabulary of roles, organisations, schools and degrees.
//
// Pipeline: lines → header (name, headline, contacts, untitled summary)
//           → sections (headings learned from the document's own style)
//           → per section: summary | list | skills rows | entry blocks.
import { ROLE_TYPE, roleFromTitle } from "../model/factory";
import type { ContactKind, SectionRole } from "../model/types";
import type { Extracted, Seg } from "./extract";
import type { ImportedResume } from "./schema";

type Section = ImportedResume["sections"][number];
type Entry = Section["entries"][number];

// ── Dates ─────────────────────────────────────────────────────────────
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const SEASON = "(?:spring|summer|fall|autumn|winter)";
const POINT = `(?:${MONTH},?\\s*'?\\d{2,4}|${SEASON}\\s+\\d{4}|\\d{1,2}[/.-]\\d{4}|\\d{4}[/.-]\\d{1,2}|(?:19|20)\\d{2})`;
const OPEN = "(?:present|current(?:ly)?|now|ongoing|today|date)";
const SEP = "\\s*(?:[–—-]+|\\bto\\b|\\buntil\\b|\\btill\\b|\\s)\\s*";
export const DATE_RE = new RegExp(`(?:(?:since|from)\\s+)?${POINT}(?:${SEP}(?:${POINT}|${OPEN}))?`, "i");
const RANGE_RE = new RegExp(`(?:(?:since|from)\\s+)?${POINT}${SEP}(?:${POINT}|${OPEN})\\b`, "i");

/** "May 2022: July 2024" / "July 2024 Present" / "2019-current" → "May 2022 – July 2024", "July 2024 – Present". */
export function normDate(s: string): string {
  let t = s.trim().replace(/\s+/g, " ");
  const m = new RegExp(`^(?:(?:since|from)\\s+)?(${POINT})${SEP}(${POINT}|${OPEN})$`, "i").exec(t);
  if (m) t = `${m[1]} – ${m[2]}`;
  else if (/^(since|from)\s+/i.test(t)) t = `${t.replace(/^(since|from)\s+/i, "")} – Present`;
  return t.replace(/\b(present|current(?:ly)?|now|ongoing|today)\b/gi, "Present").replace(/\s+/g, " ").trim();
}

/** True when the date is the point of the text ("Mar 2025", "Jan 2020 – Present, Remote"), not a year inside a name. */
function datedText(t: string): boolean {
  if (!t) return false;
  const m = findDate(t);
  return !!m && (RANGE_RE.test(m[0]) || /present/i.test(m[0]) || m[0].length >= t.replace(/[(),]/g, "").trim().length * 0.6);
}

/** Find a date (prefer a full range) inside a fragment. */
function findDate(t: string): RegExpExecArray | null {
  if (!t) return null;
  return RANGE_RE.exec(t) ?? DATE_RE.exec(t);
}

// ── Vocabulary ────────────────────────────────────────────────────────
const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}.+#&/ -]/gu, " ").split(/\s+/).filter(Boolean);
const set = (s: string) => new Set(s.split(" "));
const ROLE_W = set(
  "engineer engineering developer analyst intern internship manager lead architect consultant specialist associate assistant administrator admin designer scientist researcher officer director head coordinator executive technician tester qa sqa programmer devops sre owner founder co-founder cofounder cto ceo cfo coo vp president trainee apprentice fellow contributor maintainer collaborator mentor instructor teacher lecturer professor tutor representative accountant writer editor supervisor operator member volunteer ambassador student senior junior principal staff partner freelance freelancer contractor advisor strategist marketer recruiter nurse nursing physician doctor pharmacist therapist paramedic dentist surgeon cashier clerk receptionist chef cook driver agent banker auditor lawyer paralegal attorney technologist sales",
);
const ORG_W = set(
  "inc inc. llc ltd ltd. limited pvt private corp corp. corporation company co co. technologies technology solutions systems labs lab studios studio group holdings foundation bank hospital agency consulting consultancy partners ventures gmbh plc international global services digital networks media enterprises industries institute organization organisation association society council ministry department government",
);
const SCHOOL_W = set("university universiti universidad college institute school academy polytechnic campus faculty iit nust lums comsats uet");
const DEGREE_RE = /\b(bachelor'?s?|master'?s?|ph\.?\s?d|doctorate|diploma|associate degree|b\.?\s?s\.?c?s?|b\.?\s?sc|m\.?\s?s\.?c?s?|m\.?\s?sc|mba|b\.?\s?a|m\.?\s?a|b\.?\s?e|b\.?\s?tech|m\.?\s?tech|bcs|mcs|bscs|mscs|intermediate|matric(?:ulation)?|f\.?\s?sc|f\.?\s?a|ics|i\.?\s?com|a[- ]levels?|o[- ]levels?|hssc|ssc|high school|gcse|igcse|major|minor|honou?rs)\b/i;
const GPA_RE = /\(?\s*\b(c?gpa|grade|percentage|marks|score)\b\s*[:\-]?\s*[\d.]+(?:\s*\/\s*[\d.]+)?\s*%?\s*\)?|\(?\b[\d.]+\s*\/\s*4(?:\.0+)?\b\s*(?:c?gpa)?\)?|\b\d{2,3}(?:\.\d+)?\s*%/i;
const COUNTRY = /\b(pakistan|india|bangladesh|usa|u\.s\.a?|united states|uk|u\.k|united kingdom|england|canada|germany|france|netherlands|uae|dubai|saudi arabia|ksa|qatar|australia|new zealand|singapore|malaysia|ireland|spain|italy|sweden|norway|denmark|finland|poland|turkey|egypt|nigeria|kenya|china|japan|korea|brazil|mexico|portugal|switzerland|austria|belgium)\b/i;
const CITY = /\b(lahore|karachi|islamabad|rawalpindi|faisalabad|multan|peshawar|quetta|london|berlin|paris|amsterdam|dublin|toronto|vancouver|new york|san francisco|seattle|austin|boston|chicago|bangalore|bengaluru|mumbai|delhi|hyderabad|dubai|riyadh|doha|singapore|sydney|melbourne|tokyo|remote)\b/i;
const US_STATE = /,\s*(?:[A-Z]{2})$/;

const score = (t: string, w: Set<string>) => words(t).filter((x) => w.has(x.replace(/[.,]$/, ""))).length;
const roleScore = (t: string) => score(t, ROLE_W);
const orgScore = (t: string) => score(t, ORG_W) + score(t, SCHOOL_W) + (/\s@\s/.test(t) ? 1 : 0);
const knownPlace = (t: string) => COUNTRY.test(t) || CITY.test(t) || /^[A-Z]{2}$/.test(t.trim()) || /^(ontario|quebec|punjab|sindh|california|texas|bavaria|england|scotland|wales)$/i.test(t.trim());
const placeWords = (t: string) => /^[\p{Lu}][\p{L}.'-]*(?:\s+[\p{Lu}][\p{L}.'-]*){0,2}$/u.test(t.trim());
/** "Austin, TX", "Lahore, Pakistan", "Toronto, Ontario, Canada", "Remote": but not "Deloitte, London, UK". */
const isLocation = (t: string) => {
  const s = t.trim().replace(/^\(|\)$/g, "");
  if (!s || s.length > 48 || /\d{3}/.test(s)) return false;
  if (/^(remote|hybrid|on[- ]?site|work from home|wfh)$/i.test(s)) return true;
  if (roleScore(s) || score(s, ORG_W) || score(s, SCHOOL_W)) return false;
  const parts = s.split(/\s*,\s*/).filter(Boolean);
  if (parts.length === 1) return knownPlace(s) && s.split(/\s+/).length <= 4;
  if (!parts.every(placeWords) || parts.some((p) => /^(remote|hybrid)$/i.test(p))) return false;
  if (parts.length === 2) return knownPlace(parts[1]) || (CITY.test(parts[0]) && placeWords(parts[1]));
  return parts.length === 3 && CITY.test(parts[0]) && knownPlace(parts[2]);
};
/** Split a trailing place off "Org, City, Country" / "Org, Remote". */
function tailPlace(t: string): { head: string; place: string } | null {
  const parts = t.split(/\s*,\s*/);
  for (const k of [2, 1]) {
    if (parts.length <= k) continue;
    const place = parts.slice(-k).join(", ");
    if (isLocation(place) || (k === 1 && /^(remote|hybrid|on[- ]?site)$/i.test(place))) return { head: parts.slice(0, -k).join(", "), place };
  }
  return null;
}
const HONOURS = /\b(distinction|merit|first[- ]class(?: honou?rs)?|second[- ]class(?: honou?rs)?|upper second(?:[- ]class)?|2:1|summa cum laude|magna cum laude|cum laude|with honou?rs|dean'?s list)\b/i;

// ── Line helpers ──────────────────────────────────────────────────────
const LINK_MARK = /\s*⟨link: ([^⟩]+)⟩/g;
const strip = (t: string) => t.replace(LINK_MARK, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
/** Text with inline **bold** kept (bullets and summaries carry emphasis), link markers removed. */
const rich = (t: string) => t.replace(LINK_MARK, "").replace(/\*\*\s*\*\*/g, " ").replace(/\s+/g, " ").trim().replace(/^(\*\*)?\s*$/, "");
const linksIn = (t: string) => [...t.matchAll(LINK_MARK)].map((m) => m[1]);
const BULLET = /^\s*(?:[•●▪◦○■□♦◆➢➤►▸✓✔❖⦿⁃∙·*]|[-–—](?=\s))\s*/;
const isUpper = (t: string) => t === t.toUpperCase() && /[A-Z]{3}/.test(t);
const wordCount = (t: string) => t.split(/\s+/).filter(Boolean).length;

interface Line {
  seg: Seg;
  text: string; // with markers
  plain: string; // no markers
  bullet: boolean;
  bold: boolean;
  italic: boolean;
  size: number;
  x0: number;
  rightText: string; // right-aligned companion, plain
}

const HEADING_WORDS = new Set(("summary profile objective about me professional work experience experiences employment history career education academic " +
  "projects project personal selected key skills skill technical core competencies open source contributions contribution certifications " +
  "certificates certification licenses honors honours awards award achievements coursework relevant publications leadership volunteer " +
  "volunteering interests languages activities extracurricular references research teaching talks patents training tools technologies " +
  "and & of in highlights qualification qualifications courses internships internship contact contacts details information info " +
  "accomplishments expertise proficiencies strengths hobbies extra curricular overview background affiliations memberships").split(" "));

/** Every word is section vocabulary: "Technical Skills", "HONORS & AWARDS": not "9D Technologies". */
export function isHeadingVocab(t: string): boolean {
  const w = t.toLowerCase().replace(/[^a-z& ]/g, " ").split(/\s+/).filter(Boolean);
  return w.length > 0 && w.length <= 5 && w.every((x) => HEADING_WORDS.has(x)) && w.some((x) => !["and", "&", "of", "in", "me", "key", "details", "information", "info"].includes(x));
}

function sectionRole(title: string): SectionRole | "contact" {
  const t = title.toLowerCase();
  if (/\bcontact|personal (details|information|info)\b/.test(t)) return "contact";
  if (/qualification/.test(t)) return "education";
  if (/\btools?\b|proficienc|strengths|expertise/.test(t)) return "skills";
  if (/\binterests?\b|hobbies|languages/.test(t) && !/programming/.test(t)) return "custom";
  return roleFromTitle(title);
}

// ── Entry point ───────────────────────────────────────────────────────
export function parseHeuristic(x: Extracted): ImportedResume {
  const out: ImportedResume = { name: "", headline: "", contacts: [], sections: [], notes: ["Converted offline (no AI): give entry boundaries and dates a quick look."] };
  const lines: Line[] = x.segs
    .filter((s) => strip(s.text))
    .map((s) => {
      const plain = strip(s.text);
      return {
        seg: s, text: s.text, plain, bullet: BULLET.test(plain) && !/^[-–—]\s*\d/.test(plain),
        bold: s.bold || /^\*\*[^*]+\*\*$/.test(s.text.replace(LINK_MARK, "").trim()), italic: s.italic, size: s.size, x0: s.x0,
        rightText: s.right ? strip(s.right.text) : "",
      };
    });
  if (!lines.length) return out;

  // Body size = the size most characters are set in.
  const tally = new Map<number, number>();
  for (const l of lines) tally.set(Math.round(l.size * 2) / 2, (tally.get(Math.round(l.size * 2) / 2) ?? 0) + l.plain.length);
  const body = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];

  // Headings: learn this document's heading *style* from unmistakable headings, then accept
  // every line set in that style. A fixed size ratio can't work across documents.
  const headingText = (l: Line) => l.plain.replace(/[:\s]+$/, "");
  const headingLike = (l: Line) => {
    const t = headingText(l);
    return t.length >= 3 && t.length <= 42 && !l.bullet && !/[.,;]$/.test(t) && !l.rightText && !findDate(t) && !/@|https?:/.test(t) && l.size >= body * 0.95;
  };
  const styleKey = (l: Line) => `${Math.round(l.size * 2) / 2}|${l.bold}|${isUpper(headingText(l))}`;
  const votes = new Map<string, number>();
  for (const l of lines) if (headingLike(l) && isHeadingVocab(headingText(l))) votes.set(styleKey(l), (votes.get(styleKey(l)) ?? 0) + 1);
  const headingStyle = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const isHeadingRaw = (l: Line) => {
    if (!headingLike(l)) return false;
    if (headingStyle) return styleKey(l) === headingStyle && (isHeadingVocab(headingText(l)) || isUpper(headingText(l)) || l.size > body * 1.15);
    return (l.size >= body * 1.2 || l.bold) && isUpper(headingText(l)) && wordCount(headingText(l)) <= 4;
  };

  // Name: the largest text on page 1 (sidebars put it in odd places). When the file carries no
  // sizes (DOCX, pasted text), it's the first short line that isn't contact details or a heading.
  const p1 = lines.filter((l) => l.seg.page === 1 && l.plain.length <= 60 && !/@|\d{5}|https?:/.test(l.plain) && !isHeadingVocab(headingText(l)) && wordCount(l.plain) <= 6);
  const maxSize = Math.max(...p1.map((l) => l.size));
  const sizeSays = maxSize >= body * 1.25;
  const nameLine = sizeSays
    ? [...p1].sort((a, b) => b.size - a.size || a.seg.y - b.seg.y)[0]
    : p1.find((l) => lines.indexOf(l) <= 2 && !parseContactLine(l).length);
  const isHeading = (l: Line) => l !== nameLine && isHeadingRaw(l);
  if (nameLine) out.name = titleCaseName(nameLine.plain);

  // Header = everything before the first heading (minus the name).
  const firstH = lines.findIndex(isHeading);
  const cut = firstH < 0 ? Math.min(lines.length, 6) : firstH;
  const headLines = lines.slice(0, cut).filter((l) => l !== nameLine);
  const bodyLines = lines.slice(cut).filter((l) => l !== nameLine);
  const summaryBuf: string[] = [];
  for (const l of headLines) {
    const contacts = parseContactLine(l);
    if (contacts.length) { out.contacts.push(...contacts); continue; }
    const nearName = nameLine && l.seg.page === nameLine.seg.page && Math.abs(l.seg.y - nameLine.seg.y) < 70;
    if (!out.headline && !summaryBuf.length && wordCount(l.plain) <= 9 && !/[.!?]$/.test(l.plain) && (l.size >= body * 1.05 || l.bold || nearName)) {
      out.headline = l.plain;
      continue;
    }
    summaryBuf.push(l.plain);
  }

  // Sections.
  type Group = { title: string; role: SectionRole | "contact"; lines: Line[] };
  const groups: Group[] = [];
  let cur: Group | null = null;
  for (const l of bodyLines) {
    if (isHeading(l)) {
      cur = { title: tidyTitle(headingText(l)), role: sectionRole(headingText(l)), lines: [] };
      groups.push(cur);
    } else if (cur) cur.lines.push(l);
    else summaryBuf.push(l.plain);
  }
  for (const g of groups) {
    if (g.role === "contact") {
      for (const l of g.lines) out.contacts.push(...parseContactLine(l, true));
      continue;
    }
    const sec = buildSection(g.title, g.role, g.lines, body);
    if (sec) out.sections.push(sec);
  }
  // A paragraph before the first heading is a summary, titled or not.
  if (summaryBuf.length && !out.sections.some((s) => s.role === "summary")) {
    out.sections.unshift({ title: "Summary", role: "summary", type: "summary", text: joinWrapped(summaryBuf), entries: [], skills: [], items: [] });
  }
  out.contacts = dedupeContacts(out.contacts);
  return out;
}

// ── Header & contacts ─────────────────────────────────────────────────
const LABEL_RE = /^\s*(phone|mobile|cell|tel(?:ephone)?|contact(?: no\.?)?|whats\s?app|e-?mail|mail|linked\s?in|git\s?hub|twitter|x|portfolio|website|web|site|blog|address|location|city|lives? in|based in)\s*[:\-–]\s*/i;
const LABEL_KIND: Record<string, ContactKind> = {
  twitter: "twitter", x: "twitter", phone: "phone", mobile: "phone", cell: "phone", tel: "phone", telephone: "phone", contact: "phone", "contact no": "phone", "contact no.": "phone", whatsapp: "phone", "whats app": "phone",
  email: "email", "e-mail": "email", mail: "email", linkedin: "linkedin", "linked in": "linkedin", github: "github", "git hub": "github",
  portfolio: "website", website: "website", web: "website", site: "website", blog: "website",
  address: "location", location: "location", city: "location", "lives in": "location", "live in": "location", "based in": "location",
};

function parseContactLine(l: Line, inContactSection = false): ImportedResume["contacts"] {
  const raw = [l.text, l.seg.right?.text].filter(Boolean).join(" | ");
  const parts = raw.split(/\s+[|•·◦▪●]\s+|\s{3,}|\s+\/\s+(?=\S+@|\+?\d)/).map((p) => p.trim()).filter(Boolean);
  const found: ImportedResume["contacts"] = [];
  for (const part of parts) for (const sub of splitTokens(part)) {
    const c = classifyContact(sub, inContactSection);
    if (c) found.push(c);
  }
  // Only call it a contact line if something unmistakable is in it: or it's a short place line.
  const strong = found.some((c) => c.kind !== "location" && c.kind !== "other");
  if (strong || inContactSection) return found;
  if (found.length === 1 && found[0].kind === "location" && wordCount(l.plain) <= 5) return found;
  return [];
}

/** A part can hold several contacts without separators ("a@b.com +92 300 1234567"). */
function splitTokens(part: string): string[] {
  const p = strip(part);
  const tokens = [...p.matchAll(/[^\s@]+@[^\s@]+\.[a-z]{2,}|\+?\d[\d\s().-]{8,}\d|(?:https?:\/\/|www\.)\S+/gi)];
  if (tokens.length < 2) return [part];
  const lk = linksIn(part);
  return tokens.map((t) => {
    const own = lk.find((u) => (u.startsWith("mailto:") && t[0].includes("@")) || (!u.startsWith("mailto:") && !t[0].includes("@")));
    return own ? `${t[0]} ⟨link: ${own}⟩` : t[0];
  });
}

function classifyContact(raw: string, lenient: boolean): ImportedResume["contacts"][number] | null {
  const links = linksIn(raw);
  let text = strip(raw);
  let hint: ContactKind | null = null;
  const lab = LABEL_RE.exec(text);
  if (lab) { hint = LABEL_KIND[lab[1].toLowerCase().replace(/\s+/g, " ")] ?? null; text = text.slice(lab[0].length).trim(); }
  text = text.replace(/^[^\p{L}\p{N}+@(]+/u, "").trim();
  if (!text) return null;
  const url = links[0] ?? "";
  let kind: ContactKind | null = null;
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(text) || url.startsWith("mailto:")) kind = "email";
  else if (/linkedin/i.test(url) || /^in\//i.test(text) || /linkedin\.com/i.test(text) || hint === "linkedin") kind = "linkedin";
  else if (/github/i.test(url) || /github\.com/i.test(text) || hint === "github") kind = "github";
  else if (/(twitter|x)\.com\//i.test(url) || /(twitter|x)\.com\//i.test(text) || hint === "twitter" || /^@\w{2,15}$/.test(text)) kind = "twitter";
  else if (/^\+?[\d\s().-]{7,}$/.test(text) && (text.match(/\d/g) ?? []).length >= 7) kind = "phone";
  else if (hint) kind = hint;
  else if (url || /^(https?:\/\/|www\.)|^[\w-]+\.(com|dev|io|me|net|org|app|ai|co|xyz|tech|site)(\/\S*)?$/i.test(text)) kind = "website";
  else if (isLocation(text)) kind = "location";
  else if (lenient && wordCount(text) <= 6) kind = /\d/.test(text) ? "other" : "location";
  if (!kind) return null;
  if (kind === "email") return { kind, text, url: url || `mailto:${text}` };
  if ((kind === "linkedin" || kind === "github" || kind === "twitter" || kind === "website") && !url && /\./.test(text)) {
    return { kind, text: text.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), url: /^https?:/.test(text) ? text : `https://${text}` };
  }
  return { kind, text, url };
}

function dedupeContacts(cs: ImportedResume["contacts"]) {
  const seen = new Set<string>();
  return cs.filter((c) => {
    const k = `${c.kind}|${c.text.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Sections ──────────────────────────────────────────────────────────
function buildSection(title: string, role: SectionRole, lines: Line[], body: number): Section | null {
  const sec: Section = { title, role, type: ROLE_TYPE[role], text: "", entries: [], skills: [], items: [] };
  if (!lines.length) return null;
  // Grid rows that hold several linked items ("Cert A 🔗      Cert B 🔗") become one line per item.
  lines = lines.flatMap((l) => {
    const chunks = l.text.split(/(?<=⟨link: [^⟩]+⟩)\s+(?=\S)/);
    if (chunks.length < 2) return [l];
    return chunks.map((c) => ({ ...l, text: c, plain: strip(c), rightText: "" }));
  });
  // Aligned skill rows ("Languages    :   JavaScript, PHP"): the colon column arrives as the
  // label line's right-hand companion. Put the row back together.
  lines = lines.map((l) => (/^:/.test(l.rightText) || (/:$/.test(l.plain) && l.rightText) ? { ...l, plain: `${l.plain.replace(/\s*:$/, "")}: ${l.rightText.replace(/^:\s*/, "")}`, rightText: "" } : l));
  // A plain paragraph is a summary whatever its heading says ("Full Stack Developer").
  const paragraphOnly = lines.every((l) => !l.bullet && !l.rightText && !datedText(l.plain) && !l.bold) && lines.reduce((a, l) => a + wordCount(l.plain), 0) >= 15;
  if (role === "summary" || (role === "custom" && paragraphOnly)) {
    sec.role = "summary";
    sec.type = "summary";
    sec.text = joinWrapped(lines.map((l) => [rich(l.text).replace(BULLET, ""), l.rightText].filter(Boolean).join(" ")));
    return sec;
  }
  const n = lines.length;
  const bullets = lines.filter((l) => l.bullet).length;
  const labelled = lines.filter((l) => /^[^:]{1,38}:\s*\S/.test(l.plain.replace(BULLET, "")) && !findDate(l.plain.split(":")[0])).length;
  const dated = lines.filter((l) => findDate(l.plain) || findDate(l.rightText)).length;
  const titled = lines.filter((l) => !l.bullet && (l.bold || l.size > body * 1.08)).length;
  const short = lines.every((l) => wordCount(l.plain.replace(BULLET, "")) <= 8);

  // "Languages" (bold) / "Python, Go": label lines followed by value lines.
  const labelPairs = lines.filter((l, i) => l.bold && !l.bullet && wordCount(l.plain) <= 4 && lines[i + 1] && !lines[i + 1].bold).length;
  if (((labelled >= Math.max(1, n * 0.5) && (role === "skills" || labelled >= 2)) || (role === "skills" && labelPairs >= 2)) && !dated) {
    sec.type = "skills";
    parseSkills(sec, lines);
    return sec;
  }
  const listy = (bullets === n || (short && (!titled || role === "certifications" || role === "coursework"))) && !dated;
  if ((role === "skills" && !dated) || (listy && role !== "experience" && role !== "education" && role !== "opensource")) {
    sec.type = "list";
    for (const l of lines) {
      const t = l.plain.replace(BULLET, "").trim();
      const prev = sec.items[sec.items.length - 1];
      if (prev && !l.bullet && /^[a-z(]/.test(t)) prev.text = joinWrapped([prev.text, t]);
      else if (role === "skills" && !l.bullet && t.includes(",") && !/\([^)]*,[^)]*\)/.test(t)) for (const p of t.split(/\s*,\s*/)) { if (p) sec.items.push({ text: p, link: "" }); }
      else sec.items.push({ text: t, link: linksIn(l.text)[0] ?? "" });
      // The second cell of a two-column row arrives as the line's right-hand companion.
      if (l.seg.right && l.rightText) for (const c of l.seg.right.text.split(/(?<=⟨link: [^⟩]+⟩)\s+(?=\S)/)) {
        const ct = strip(c).replace(BULLET, "").trim();
        if (ct) sec.items.push({ text: ct, link: linksIn(c)[0] ?? "" });
      }
    }
    return sec;
  }
  sec.type = "entries";
  parseEntries(sec, lines, body);
  return sec;
}

function parseSkills(sec: Section, lines: Line[]) {
  for (const l of lines) {
    const t = l.plain.replace(BULLET, "");
    const m = /^([^:]{1,38}):\s*(.*)$/.exec(t);
    const last = sec.skills[sec.skills.length - 1];
    if (m) sec.skills.push({ label: m[1].trim(), value: m[2].trim() });
    else if (l.bold && wordCount(t) <= 4) sec.skills.push({ label: t, value: "" });
    else if (last && (last.label || !last.value || /,\s*$/.test(last.value) || /^[a-z]/.test(t))) last.value = last.value ? `${last.value} ${t}`.trim() : t;
    else sec.skills.push({ label: "", value: t });
  }
}

// ── Entries ───────────────────────────────────────────────────────────
interface Block { header: Line[]; bullets: { text: string; link: string; x: number }[] }

function parseEntries(sec: Section, lines: Line[], body: number) {
  const blocks: Block[] = [];
  let b: Block | null = null;
  const titleLike = (l: Line) => !l.bullet && (l.bold || l.text.startsWith("**") || l.size > body * 1.08);
  const hasDate = (l: Line) => datedText(l.rightText) || datedText(l.plain) || l.plain.split(/\s+[|•·]\s+|\s+[–—]\s+(?=\D)/).some(datedText);
  const sentence = (l: Line) => wordCount(l.plain) >= 9 && !l.bold && !hasDate(l);
  for (const l of lines) {
    if (l.bullet) {
      if (!b) { b = { header: [], bullets: [] }; blocks.push(b); }
      b.bullets.push({ text: rich(l.text).replace(BULLET, "").trim(), link: linksIn(l.text).pop() ?? "", x: l.x0 });
      continue;
    }
    if (!b) { b = { header: [l], bullets: [] }; blocks.push(b); continue; }
    if (b.bullets.length) {
      const last = b.bullets[b.bullets.length - 1];
      // Wrapped bullet text: not a title, sits right of the bullet glyph, or starts lowercase.
      const cont = !titleLike(l) && !hasDate(l) && (l.x0 >= last.x + 4 || /^[a-z(,;&]/.test(l.plain));
      if (cont) {
        last.text = joinWrapped([last.text, rich(l.text)]);
        const lk = linksIn(l.text).pop();
        if (lk) last.link = lk;
        continue;
      }
      if (sentence(l) && !titleLike(l)) { b.bullets.push({ text: rich(l.text), link: linksIn(l.text).pop() ?? "", x: l.x0 }); continue; }
      b = { header: [l], bullets: [] };
      blocks.push(b);
      continue;
    }
    // Header group of the current block. A second dated line, or a fourth header line that is
    // a title, starts the next entry (education lists often have no bullets at all).
    const headerHasDate = b.header.some(hasDate);
    // …and so does a line in the block's own title style once the block already has its date
    // ("University of Manchester / MSc · 2018 – 2019 / University of Leeds / …").
    const sameStyleTitle = titleLike(l) && headerHasDate && titleLike(b.header[0]) && l.bold === b.header[0].bold && l.italic === b.header[0].italic && Math.abs(l.size - b.header[0].size) < 0.6;
    if ((hasDate(l) && headerHasDate && (titleLike(l) || b.header.length >= 2)) || (titleLike(l) && b.header.length >= 3) || sameStyleTitle) {
      b = { header: [l], bullets: [] };
      blocks.push(b);
      continue;
    }
    // A header line that wrapped ("UNIVERSITY OF AGRICULTURE," / "FAISALABAD", "…certification" / "and exam").
    const prevH = b.header[b.header.length - 1];
    if (prevH && !hasDate(l) && !prevH.rightText && l.bold === prevH.bold && (/[,&/-]$|b(and|of|for|in|the)$/i.test(prevH.plain) || (/^[a-z]/.test(l.plain) && !l.bold))) {
      b.header[b.header.length - 1] = { ...prevH, plain: joinWrapped([prevH.plain, l.plain]), text: `${prevH.text} ${l.text}`, rightText: l.rightText };
      continue;
    }
    // A description paragraph under a title (no bullet glyphs) reads as bullets.
    if (sentence(l)) { b.bullets.push({ text: rich(l.text), link: linksIn(l.text).pop() ?? "", x: l.x0 }); continue; }
    b.header.push(l);
  }
  for (const bl of blocks) {
    const e = assemble(sec.role, bl);
    if (e.title || e.subtitle || e.bullets.length) sec.entries.push(e);
  }
  // A resume is consistent with itself: when most entries put the role on the first line
  // (or the organisation), entries that vocabulary couldn't settle follow the same order.
  // ("Freelance Software Engineer & DevOps / Self-Employed" in a Company/Role resume stays put.)
  const votes = sec.entries.map((e) => orientation.get(e)).filter((o): o is { roleFirst: boolean; margin: number } => !!o);
  const roleFirst = votes.filter((v) => v.roleFirst).length;
  const orgFirst = votes.length - roleFirst;
  if (votes.length >= 2 && roleFirst !== orgFirst) {
    const majority = roleFirst > orgFirst;
    for (const e of sec.entries) {
      const o = orientation.get(e);
      if (o && o.roleFirst !== majority) [e.title, e.subtitle] = [e.subtitle, e.title];
    }
  }
}

interface Frag { text: string; bold: boolean; italic: boolean; line: number; right: boolean }

/** A link label at the end of a right-aligned companion. */
const LINK_LABEL_TAIL = /(?:^|\s+)\[?(?:source(?: code)?|code|repo(?:sitory)?|github|gitlab|demo|live(?: demo)?|link|website|view(?: project)?|project link)\]?$/i;

/** Words that are only the visible label of a link. */
const LINK_LABEL = /^\[?(source(?: code)?|code|repo(?:sitory)?|github|gitlab|demo|live(?: demo)?|link|website|view(?: project)?|project link|app)\]?$/i;

/** Which line each two-line entry put its role on, for the section-level convention vote. */
const orientation = new WeakMap<Entry, { roleFirst: boolean; margin: number }>();

/** Turn one block's header lines into fields. */
function assemble(role: SectionRole, bl: Block): Entry {
  const e: Entry = { title: "", subtitle: "", date: "", location: "", meta: "", link: "", bullets: [] };
  const frags: Frag[] = [];
  bl.header.forEach((l0, li) => {
    // "| repo", "[GitHub]", "Live demo": link anchors, not part of the title or stack.
    const l = { ...l0, plain: strip(l0.text.replace(/\s*[[(]?\b(?:repo(?:sitory)?|code|source|github|gitlab|demo|live(?: demo)?|link|website|view|app)\b[\])]?\s*(?=⟨link:)/gi, " ")) };
    // A right-aligned "Source Code" link is the entry's link; otherwise the last link on the line.
    const rightLinks = l0.seg.right ? linksIn(l0.seg.right.text) : [];
    const lks = [...linksIn(l.text), ...rightLinks];
    if (rightLinks.length && l0.rightText && LINK_LABEL_TAIL.test(l0.rightText.trim())) e.link = rightLinks[rightLinks.length - 1];
    else if (lks.length && !e.link) e.link = lks[lks.length - 1];
    const push = (t: string, right: boolean) => {
      for (const p of t.split(/\s+[|•·▪●]\s+|\s+\|\s*|\s{2,}/).flatMap(splitDash).flatMap(splitRoleOrg)) {
        const s = p.replace(/^[,\s|–—-]+|[,\s|–—-]+$/g, "").trim();
        if (s) frags.push({ text: s, bold: l.bold, italic: l.italic, line: li, right });
      }
    };
    push(l.plain, false);
    // A right-aligned companion is one field ("Remote – AnyCity, Anystate"): no dash splitting.
    if (l.rightText) {
      // "React.js, Redux, PHP   Source Code": the trailing link label belongs to the link.
      const t = l.rightText.trim().replace(LINK_LABEL_TAIL, "").trim();
      // A comma list on the right is a tech stack in Projects, a place everywhere else.
      const techy = role === "projects" ? t.split(",").filter((x) => x.trim()).length >= 2 && !isLocation(t) : /\.js|[#+]|\d/.test(t) && t.includes(",");
      if (!t) { /* only a link label: its URL is the entry's link (taken below) */ }
      else if (techy || datedText(t) || roleScore(t) || orgScore(t) || e.location) push(t, true);
      else e.location = t;
    }
  });

  const names: Frag[] = [];
  const queue = [...frags];
  while (queue.length) {
    let f = queue.shift()!;
    // Dates: a full range anywhere, or a lone date that is most of the fragment.
    const m = !e.date ? findDate(f.text) : null;
    if (m && (RANGE_RE.test(m[0]) || m[0].length >= f.text.length * 0.6 || /present/i.test(m[0]))) {
      e.date = normDate(m[0]);
      const before = f.text.slice(0, m.index).replace(/[\s,|–—(-]+$/, "").trim();
      let after = f.text.slice(m.index + m[0].length).replace(/^[\s,|–—)-]+/, "").replace(/[\s)]+$/, "").trim();
      if (/^\(?(graduated|expected|anticipated|completed)/i.test(after)) { e.date += ` (${after.replace(/[()]/g, "")})`; after = ""; }
      if (after) queue.unshift({ ...f, text: after });
      if (!before) continue;
      f = { ...f, text: before };
    }
    // GPA inside parentheses or alone: "BS. Computer Science (CGPA 3.41/4.0)".
    const g = GPA_RE.exec(f.text);
    if (g && (role === "education" || /gpa|grade|percent|marks/i.test(g[0]))) {
      const v = g[0].replace(/^\s*\(|\)\s*$/g, "").trim();
      e.meta = e.meta ? `${e.meta}, ${v}` : v;
      f = { ...f, text: f.text.replace(g[0], " ").replace(/\(\s*\)/g, "").replace(/\s+/g, " ").replace(/[\s,]+$/, "").trim() };
      if (!f.text) continue;
    }
    if (!e.location && isLocation(f.text)) { e.location = f.text.replace(/^\(|\)$/g, ""); continue; }
    // "Deloitte, London, UK" / "Stripe, Remote": a trailing place after a comma.
    // ("University of Agriculture, Faisalabad" keeps its city: that's the institution's name.)
    const tp = !e.location && !score(f.text, SCHOOL_W) ? tailPlace(f.text) : null;
    if (tp && tp.head) { e.location = tp.place; f = { ...f, text: tp.head }; }
    // Honours on a degree line: "MSc Data Science, Distinction".
    const hm = role === "education" ? HONOURS.exec(f.text) : null;
    if (hm) {
      // "(Distinction)" in parentheses, or its own comma part: "…, First Class Honours".
      const paren = /\(([^)]*)\)/.exec(f.text);
      const cut = paren && HONOURS.test(paren[1]) ? paren[0] : f.text.split(/\s*,\s*/).find((p) => HONOURS.test(p) && !DEGREE_RE.test(p.replace(HONOURS, ""))) ?? hm[0];
      const part = cut.replace(/^\(|\)$/g, "").trim();
      e.meta = e.meta ? `${e.meta}, ${part}` : part;
      f = { ...f, text: f.text.replace(cut, "").replace(/^[\s,]+|[\s,]+$/g, "").replace(/,\s*,/g, ",").trim() };
      if (!f.text) continue;
    }
    if (f.text) names.push(f);
  }

  const isTech = (t: string) => t.split(",").filter((x) => x.trim()).length >= 2 && !roleScore(t) && !isLocation(t);
  const isRepo = (t: string) => /[\w.-]\/[\w.-]/.test(t) && !/\s/.test(t.split(",")[0].trim());
  const rest: Frag[] = [];
  if (role === "education") {
    const school = pick(names, (f) => score(f.text, SCHOOL_W) * 3 + (f.bold ? 1 : 0) - (DEGREE_RE.test(f.text) ? 2 : 0));
    const degree = pick(names.filter((f) => f !== school), (f) => (DEGREE_RE.test(f.text) ? 3 : 0) + (/\b(in|of)\b/i.test(f.text) ? 1 : 0) - f.line * 0.1);
    e.title = school?.text ?? "";
    e.subtitle = degree?.text ?? "";
    rest.push(...names.filter((f) => f !== school && f !== degree));
  } else if (role === "projects") {
    const [first, ...others] = names;
    e.title = first?.text ?? "";
    for (const f of others) {
      if (isTech(f.text) || /\b(react|node|python|java|typescript|go|rust|docker|kubernetes|aws|sql|django|flutter|swift|kotlin|vue|angular|next\.?js|supabase|firebase)\b/i.test(f.text)) e.meta = e.meta ? `${e.meta}, ${f.text}` : f.text;
      else rest.push(f);
    }
  } else if (role !== "experience" && role !== "opensource") {
    // Awards, certificates, custom sections: the author's reading order is the structure.
    [e.title = "", e.subtitle = ""] = names.map((f) => f.text);
    rest.push(...names.slice(2));
  } else if (names.length === 1) {
    const only = names[0];
    if ((role === "experience" || role === "opensource") && roleScore(only.text) > orgScore(only.text)) e.subtitle = only.text;
    else e.title = only.text;
  } else if (names.length >= 2) {
    // Role vs organisation by vocabulary ("SQA Engineer" / "Techverx"); ties keep reading order,
    // organisation first (the common "Company / Role" convention).
    const cand = names.filter((f) => !isRepo(f.text) && !(isTech(f.text) && names.length > 2));
    const ranked = cand.map((f) => ({ f, r: roleScore(f.text) - orgScore(f.text) }));
    const roleF = [...ranked].sort((a, b) => b.r - a.r || a.f.line - b.f.line)[0];
    const orgF = ranked.filter((s) => s !== roleF).sort((a, b) => a.r - b.r || a.f.line - b.f.line)[0];
    // Vocabulary decides ("SQA Engineer" over "Techverx"); ties keep reading order. The section
    // later votes on the document's convention and fixes entries where vocabulary was unsure.
    if (roleF && orgF && roleF.r > orgF.r) { e.subtitle = roleF.f.text; e.title = orgF.f.text; }
    else if (cand.length >= 2) { e.title = cand[0].text; e.subtitle = cand[1].text; }
    else if (cand.length === 1) e.title = cand[0].text;
    const tf = cand.find((f) => f.text === e.title);
    const sf = cand.find((f) => f.text === e.subtitle);
    if (tf && sf && tf.line !== sf.line) orientation.set(e, { roleFirst: sf.line < tf.line, margin: Math.abs((roleF?.r ?? 0) - (orgF?.r ?? 0)) });
    const used = new Set([e.title, e.subtitle]);
    rest.push(...names.filter((f) => !used.has(f.text)));
  }
  for (const f of rest) {
    if (!e.subtitle && !isRepo(f.text) && !isTech(f.text) && role !== "projects") e.subtitle = f.text;
    else e.meta = e.meta ? `${e.meta}, ${f.text}` : f.text;
  }
  e.bullets = bl.bullets.filter((x) => x.text).map((x) => ({ text: x.text, link: x.link }));
  if (!e.title && e.subtitle && role !== "experience" && role !== "opensource") { e.title = e.subtitle; e.subtitle = ""; }
  return e;
}

/** "Contributor – jenkinsci/jenkins" splits; "May 2022 – July 2024" doesn't. */
/** "Data Analyst at Monzo Bank", "Registered Nurse, Toronto General Hospital", "SWE @ Google" → [role, org]. */
function splitRoleOrg(t: string): string[] {
  const at = /^(.+?)\s+(?:at|@)\s+(\p{Lu}.+)$/u.exec(t);
  if (at && roleScore(at[1]) > 0 && roleScore(at[2]) === 0) return [at[1], at[2]];
  const parts = t.split(/\s*,\s*/);
  if (parts.length === 2 && roleScore(parts[0]) > 0 && roleScore(parts[1]) === 0 && /^\p{Lu}/u.test(parts[1]) && !isLocation(parts[1]) && !DEGREE_RE.test(t)) return parts;
  return [t];
}

function splitDash(t: string): string[] {
  const parts = t.split(/(\s+[–—]\s+)/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const prev = out[out.length - 1];
    const joinsDate = prev !== undefined && new RegExp(`${POINT}$`, "i").test(prev) && new RegExp(`^(?:${POINT}|${OPEN})`, "i").test(parts[i]);
    if (joinsDate) out[out.length - 1] = `${prev}${parts[i - 1]}${parts[i]}`;
    else out.push(parts[i]);
  }
  return out.map((x) => x.trim()).filter(Boolean);
}

function pick<T>(xs: T[], f: (x: T) => number): T | undefined {
  let best: T | undefined;
  let bs = -Infinity;
  for (const x of xs) { const s = f(x); if (s > bs) { bs = s; best = x; } }
  return best;
}

// ── Text utilities ────────────────────────────────────────────────────
/** Re-join lines a PDF wrapped, healing hyphenated breaks. */
function joinWrapped(parts: string[]): string {
  return parts.reduce((acc, p) => (!acc ? p : /[A-Za-z]-$/.test(acc) && /^[a-z]/.test(p) ? acc.slice(0, -1) + p : `${acc} ${p}`), "").replace(/\s+/g, " ").trim();
}

function tidyTitle(t: string): string {
  if (t !== t.toUpperCase()) return t;
  const small = new Set(["and", "of", "the", "in", "for", "&", "to", "a"]);
  return t.toLowerCase().split(" ").map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}

function titleCaseName(t: string): string {
  return t === t.toUpperCase() && /[A-Z]{2}/.test(t) ? t.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : t;
}

export type { SectionRole };

/** Internals exposed for unit tests only. */
export const __test = { isLocation, tailPlace, findDate, datedText, classifyContact, splitRoleOrg, splitDash, sectionRole };
