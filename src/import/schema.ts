// The structured-output contract between the importer (Claude) and the app.
// Mirrors model/types.ts without ids; ids are added client-side.
import { z } from "zod";

const Bullet = z.object({
  text: z.string().describe("One achievement. Inline **bold** only where the source bolded it."),
  link: z.string().describe("URL of an icon/link attached to this bullet, else empty."),
});

const Entry = z.object({
  title: z.string().describe("Company, school, project, organisation, award or certificate name."),
  subtitle: z.string().describe("Role / job title, degree, or one-line award description."),
  date: z.string().describe("Date or range, e.g. 'Aug 2023 – Present'. En dash between dates. Empty if none."),
  location: z.string().describe("City, Country / Remote. Empty if none."),
  meta: z.string().describe("Tech stack (projects), repositories (open source), GPA/CGPA (education). Empty if none."),
  link: z.string().describe("Main URL for the entry (repo, certificate, project site). Empty if none."),
  bullets: z.array(Bullet),
});

export const ImportedResume = z.object({
  name: z.string(),
  headline: z.string().describe("Professional title under the name, only if the source shows one. Else empty."),
  contacts: z.array(
    z.object({
      kind: z.enum(["phone", "email", "location", "linkedin", "github", "twitter", "website", "other"]),
      text: z.string().describe("Exactly what is printed, e.g. 'in/msalman199'."),
      url: z.string().describe("Link target. mailto: for email, full https URL for profiles. Empty for phone/location."),
    }),
  ),
  sections: z.array(
    z.object({
      title: z.string().describe("Section heading as it should be printed."),
      role: z.enum(["summary", "experience", "education", "projects", "opensource", "awards", "certifications", "coursework", "skills", "custom"]),
      type: z.enum(["summary", "entries", "skills", "list"]).describe("summary = paragraph; entries = titled items with bullets; skills = label/value rows; list = simple items."),
      text: z.string().describe("Paragraph text for type=summary, else empty."),
      entries: z.array(Entry),
      skills: z.array(z.object({ label: z.string(), value: z.string().describe("Comma-separated items, in source order.") })),
      items: z.array(z.object({ text: z.string(), link: z.string() })),
    }),
  ),
  notes: z.array(z.string()).describe("Short notes for the user: every wording change you made, anything ambiguous or unreadable."),
});

export type ImportedResume = z.infer<typeof ImportedResume>;

export type ImportMode = "exact" | "ats";

export interface ImportRequest {
  /** Layout-annotated text extracted in the browser (fonts, sizes, links). */
  text: string;
  /** Original PDF, base64, when the upload was a PDF: lets the model see the visual layout. */
  pdfBase64?: string;
  filename: string;
  mode: ImportMode;
  pages: 1 | 2 | 3;
}

export interface ImportResponse {
  resume: ImportedResume;
  model: string;
  ms: number;
}
