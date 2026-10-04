// The canonical resume document. Everything: the visual form, the LaTeX-style
// source, the PDF engine and the importer: reads and writes this one shape.

export type TemplateId = "classic" | "academic" | "modern" | "blueprint";
export type PageTarget = 1 | 2 | 3;
export type Paper = "letter" | "a4";

export type ContactKind = "phone" | "email" | "location" | "linkedin" | "github" | "twitter" | "website" | "other";

export interface Contact {
  id: string;
  kind: ContactKind;
  /** What is printed, e.g. "in/msalman199". */
  text: string;
  /** Where it links to. Empty = not a link (phone and location usually). */
  url: string;
  /** Show the kind's icon before the text. Unset = the template's own default. */
  icon?: boolean;
}

export interface Bullet {
  id: string;
  /** Inline markup: **bold**, *italic*, [label](https://url). */
  text: string;
  /** Optional trailing icon link (e.g. a PR search or a repo). */
  link: string;
}

export interface Entry {
  id: string;
  /** Company, school, project, organisation, award or certificate name. */
  title: string;
  /** Role, degree or one-line description. */
  subtitle: string;
  date: string;
  location: string;
  /** Tech stack, repositories, GPA… whatever the template prints next to the subtitle. */
  meta: string;
  /** Repo / certificate / project URL, rendered as an icon link. */
  link: string;
  bullets: Bullet[];
}

export interface SkillRow {
  id: string;
  label: string;
  value: string;
}

export interface ListItem {
  id: string;
  text: string;
  link: string;
}

export type SectionType = "summary" | "entries" | "skills" | "list";

export type SectionRole =
  | "summary"
  | "experience"
  | "education"
  | "projects"
  | "opensource"
  | "awards"
  | "certifications"
  | "coursework"
  | "skills"
  | "custom";

export type ColumnPref = "auto" | "main" | "side";

export interface Section {
  id: string;
  type: SectionType;
  role: SectionRole;
  title: string;
  column: ColumnPref;
  text: string;
  entries: Entry[];
  skills: SkillRow[];
  items: ListItem[];
}

export interface Resume {
  version: 1;
  template: TemplateId;
  pages: PageTarget;
  paper: Paper;
  /** May carry **bold** / *italic* markup when nameStyle is "custom". */
  name: string;
  /**
   * "auto": the template styles the name (e.g. Modern's light first name + bold surname).
   * "custom": the name's own markup decides exactly which words are bold: including none.
   */
  nameStyle?: "auto" | "custom";
  headline: string;
  contacts: Contact[];
  sections: Section[];
}
