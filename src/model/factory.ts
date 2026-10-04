import type {
  Bullet, ColumnPref, Contact, ContactKind, Entry, ListItem, Resume, Section, SectionRole, SectionType, SkillRow,
} from "./types";

let counter = 0;
export const uid = (p = "n") => `${p}${Date.now().toString(36)}${(counter++).toString(36)}`;

export const bullet = (text = "", link = ""): Bullet => ({ id: uid("b"), text, link });

export const entry = (e: Partial<Omit<Entry, "bullets">> & { bullets?: (string | [string, string])[] } = {}): Entry => ({
  id: uid("e"),
  title: e.title ?? "",
  subtitle: e.subtitle ?? "",
  date: e.date ?? "",
  location: e.location ?? "",
  meta: e.meta ?? "",
  link: e.link ?? "",
  bullets: (e.bullets ?? []).map((b) => (Array.isArray(b) ? bullet(b[0], b[1]) : bullet(b))),
});

export const skill = (label = "", value = ""): SkillRow => ({ id: uid("s"), label, value });
export const item = (text = "", link = ""): ListItem => ({ id: uid("i"), text, link });
export const contact = (kind: ContactKind, text: string, url = ""): Contact => ({ id: uid("c"), kind, text, url });

export const ROLE_TYPE: Record<SectionRole, SectionType> = {
  summary: "summary",
  experience: "entries",
  education: "entries",
  projects: "entries",
  opensource: "entries",
  awards: "entries",
  certifications: "list",
  coursework: "list",
  skills: "skills",
  custom: "entries",
};

export const ROLE_TITLE: Record<SectionRole, string> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  projects: "Projects",
  opensource: "Open Source Contributions",
  awards: "Honors & Awards",
  certifications: "Certifications",
  coursework: "Coursework",
  skills: "Skills",
  custom: "Section",
};

export function section(role: SectionRole, init: Partial<Section> = {}): Section {
  return {
    id: uid("sec"),
    type: init.type ?? ROLE_TYPE[role],
    role,
    title: init.title ?? ROLE_TITLE[role],
    column: init.column ?? "auto",
    text: init.text ?? "",
    entries: init.entries ?? [],
    skills: init.skills ?? [],
    items: init.items ?? [],
  };
}

/** Infer a section's semantic role from whatever heading the user (or their old resume) used. */
export function roleFromTitle(title: string): SectionRole {
  const t = title.toLowerCase().replace(/[^a-z& ]/g, " ").replace(/\s+/g, " ").trim();
  const has = (...w: string[]) => w.some((x) => t.includes(x));
  if (has("summary", "profile", "objective", "about")) return "summary";
  if (has("open source", "opensource", "contribution")) return "opensource";
  if (has("experience", "employment", "work history", "career", "internship")) return "experience";
  if (has("education", "academic", "qualification")) return "education";
  if (has("project")) return "projects";
  if (has("certif", "license", "licence")) return "certifications";
  if (has("honor", "honour", "award", "achievement", "scholarship", "recognition")) return "awards";
  if (has("course")) return "coursework";
  if (has("skill", "technolog", "tech stack", "tools", "competenc", "expertise")) return "skills";
  return "custom";
}

/** Where a section goes in a two-column template when the user hasn't pinned it. */
export function resolveColumn(s: Section): Exclude<ColumnPref, "auto"> {
  if (s.column !== "auto") return s.column;
  switch (s.role) {
    case "skills":
    case "education":
    case "awards":
    case "certifications":
    case "coursework":
      return "side";
    default:
      return s.type === "list" || s.type === "skills" ? "side" : "main";
  }
}

export function emptyResume(): Resume {
  return {
    version: 1,
    template: "modern",
    pages: 1,
    paper: "letter",
    name: "",
    headline: "",
    contacts: [],
    sections: [
      section("summary"),
      section("experience", { entries: [entry({ bullets: [""] })] }),
      section("projects"),
      section("skills", { skills: [skill()] }),
      section("education", { entries: [entry()] }),
    ],
  };
}

export const clone = <T,>(v: T): T => structuredClone(v);
