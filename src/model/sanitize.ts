// Rebuilds a Resume from untrusted data: a shared link, browser storage, a pasted file.
// Only known fields are read, every value is type-checked and length-capped, and every id
// is regenerated, so nothing unexpected (extra keys, __proto__, huge strings, wrong types)
// survives into the app. Returns null when the input isn't recognisably a resume.
import { uid } from "./factory";
import type {
  Bullet, ColumnPref, Contact, ContactKind, Entry, ListItem, PageTarget, Paper, Resume, Section,
  SectionRole, SectionType, SkillRow, TemplateId,
} from "./types";

const TEMPLATES: TemplateId[] = ["modern", "blueprint", "classic", "academic"];
const KINDS: ContactKind[] = ["phone", "email", "location", "linkedin", "github", "twitter", "website", "other"];
const TYPES: SectionType[] = ["summary", "entries", "skills", "list"];
const ROLES: SectionRole[] = ["summary", "experience", "education", "projects", "opensource", "awards", "certifications", "coursework", "skills", "custom"];
const COLUMNS: ColumnPref[] = ["auto", "main", "side"];

/** Generous for any real resume, small enough that a hostile one can't hurt. */
export const LIMITS = { line: 1_000, text: 20_000, contacts: 30, sections: 40, entries: 100, bullets: 60, skills: 60, items: 200 };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (o: Obj, k: string): unknown => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const oneOf = <T extends string>(v: unknown, set: readonly T[], fallback: T): T => (set.includes(v as T) ? (v as T) : fallback);
// Drop control characters except tab and newline; they have no business in a resume.
// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const str = (v: unknown, max: number = LIMITS.line): string =>
  typeof v === "string" ? v.replace(CTRL, "").slice(0, max) : typeof v === "number" ? String(v) : "";
const list = <T>(v: unknown, max: number, each: (o: Obj) => T): T[] =>
  Array.isArray(v) ? v.slice(0, max).filter(isObj).map(each) : [];

const contact = (o: Obj): Contact => {
  const c: Contact = { id: uid("c"), kind: oneOf(own(o, "kind"), KINDS, "other"), text: str(own(o, "text")), url: str(own(o, "url")) };
  const icon = own(o, "icon");
  if (typeof icon === "boolean") c.icon = icon;
  return c;
};
const bullet = (o: Obj): Bullet => ({ id: uid("b"), text: str(own(o, "text"), LIMITS.text), link: str(own(o, "link")) });
const entry = (o: Obj): Entry => ({
  id: uid("e"),
  title: str(own(o, "title")),
  subtitle: str(own(o, "subtitle")),
  date: str(own(o, "date")),
  location: str(own(o, "location")),
  meta: str(own(o, "meta")),
  link: str(own(o, "link")),
  bullets: list(own(o, "bullets"), LIMITS.bullets, bullet),
});
const skill = (o: Obj): SkillRow => ({ id: uid("s"), label: str(own(o, "label")), value: str(own(o, "value"), LIMITS.text) });
const item = (o: Obj): ListItem => ({ id: uid("i"), text: str(own(o, "text"), LIMITS.text), link: str(own(o, "link")) });
const section = (o: Obj): Section => {
  const role = oneOf(own(o, "role"), ROLES, "custom");
  return {
    id: uid("sec"),
    type: oneOf(own(o, "type"), TYPES, "entries"),
    role,
    title: str(own(o, "title")),
    column: oneOf(own(o, "column"), COLUMNS, "auto"),
    text: str(own(o, "text"), LIMITS.text),
    entries: list(own(o, "entries"), LIMITS.entries, entry),
    skills: list(own(o, "skills"), LIMITS.skills, skill),
    items: list(own(o, "items"), LIMITS.items, item),
  };
};

export function sanitizeResume(input: unknown): Resume | null {
  if (!isObj(input)) return null;
  const version = own(input, "version");
  if (version !== undefined && version !== 1) return null;
  const sections = own(input, "sections");
  const contacts = own(input, "contacts");
  // Must look like a resume: at least one of the parts a resume is made of.
  if (typeof own(input, "name") !== "string" && !Array.isArray(sections) && !Array.isArray(contacts)) return null;
  const pages = own(input, "pages");
  const r: Resume = {
    version: 1,
    template: oneOf(own(input, "template"), TEMPLATES, "modern"),
    pages: (pages === 1 || pages === 2 || pages === 3 ? pages : 1) as PageTarget,
    paper: oneOf<Paper>(own(input, "paper"), ["letter", "a4"], "letter"),
    name: str(own(input, "name")),
    headline: str(own(input, "headline")),
    contacts: list(contacts, LIMITS.contacts, contact),
    sections: list(sections, LIMITS.sections, section),
  };
  const nameStyle = own(input, "nameStyle");
  if (nameStyle === "custom" || nameStyle === "auto") r.nameStyle = nameStyle;
  return r;
}
