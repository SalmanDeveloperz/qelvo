import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ImportedResume, type ImportRequest } from "../src/import/schema";

const MODEL = "claude-opus-5-5";

const client = new Anthropic();

const SYSTEM = `You convert an existing resume into structured data for a typesetting engine. Accuracy is the whole job: a recruiter will read the output, and the person is trusting you with their career history.

You receive (1) layout-annotated text extracted from the file: each line is prefixed with its font size and weight, links appear as ⟨link: URL⟩ right after the text they are attached to, and **…** marks words that were bold inside a line: and, for PDFs, (2) the original document so you can see the layout.

Hard rules (both modes):
- Never invent anything: no new employers, titles, dates, numbers, metrics, tools, links or achievements. If the source doesn't say it, it isn't in the output.
- Keep every role, project, degree, award, certificate and bullet. Do not merge or drop entries.
- Names of people, companies, schools, products and technologies keep their exact spelling and capitalisation (e.g. "FOSSology", "OWASP/Nest", "Node.js").
- Repair extraction artifacts only: words split by line breaks or hyphenation, stray icon glyphs (•, �, private-use characters), duplicated spaces.
- Dates: "Mon YYYY – Mon YYYY" with an en dash (–) and single spaces; keep "Present". Keep year-only dates as years.
- Put each URL in the right place: contacts (LinkedIn, GitHub, portfolio, email as mailto:), an entry's main link (repo icon next to a project/certificate), or a bullet's link (icon at the end of a bullet). Never print a URL as text unless the source printed it.
- Sections: keep the source's order. Choose role from the content. Summary/profile → type summary; experience/education/projects/open source/awards → entries; skills → skills rows (label + comma list; if the source has no labels, use one row with an empty label); coursework/interests/certifications without dates → list.
- A paragraph between the contact lines and the first heading is the summary even when it has no heading: emit it as a "Summary" section first.
- A short line right under the name ("SQA Engineer") is the headline, not a contact or a section.
- Contacts: drop printed labels ("Phone:", "Email:", "LinkedIn:"); undo letter-spacing ("L a h o r e" → "Lahore").
- Experience: title = organisation, subtitle = role: decide by meaning, not position. Some resumes put the role first in bold and the company below in italics; others the reverse. "Self-Employed"/"Freelance" is the organisation when it stands alone.
- A date printed far right on a title line belongs to that entry. "July 2024 Present" means "July 2024 – Present".
- Bulleted grids (skills or tools in 2–4 columns) are lists: one item per bullet, read column by column; never merge items or split an item at its internal commas.
- Skill rows written "Label: values" (or a bold label line followed by its values) stay labelled rows; plain bullet lists of skills become a list section.
- Education entries: title = institution, subtitle = degree, meta = GPA/CGPA or honours ("Distinction"), date = years; "(CGPA 3.41/4.0)" inside the degree line goes to meta.
- Projects: title = project name, meta = tech stack, link = repo/demo URL.
- Open source: title = organisation/project, subtitle = your role, meta = repositories.`;

const EXACT = `Mode: KEEP WORDING. Transcribe every sentence exactly as written. Only fix the extraction artifacts listed above. Keep the original section titles.`;

const ATS = `Mode: ATS POLISH. Keep every fact, but tighten the wording the way a strong engineering hiring manager would:
- Start each bullet with a strong, specific verb; past tense for past roles, present tense for the current role.
- Remove first-person pronouns and filler ("responsible for", "worked on", "helped with", "various").
- Fix grammar, spelling and inconsistent punctuation (no trailing periods on bullets unless the majority already uses them).
- Keep every technology keyword verbatim: ATS filters match on them.
- Use standard section titles (Summary, Experience, Open Source Contributions, Projects, Skills, Education, Honors & Awards, Certifications, Coursework).
- Numbers: reuse only numbers that already appear in the source. Never add or estimate metrics.
- Don't sugar-coat: no buzzwords ("synergy", "passionate", "rockstar"), no exaggerated claims.
List each meaningful rewrite in notes (e.g. "Experience › Hywiz: 'Worked on UI' → 'Converted UI designs…'").`;

export async function importResume(req: ImportRequest) {
  const t0 = Date.now();
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (req.pdfBase64) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: req.pdfBase64 } });
  }
  const lengthHint =
    req.mode === "ats" && req.pages === 1
      ? "The person wants ONE page: prefer concise bullets (ideally ≤ 2 lines each): shorten wording, never drop facts or entries."
      : `The person is targeting ${req.pages} page(s).`;
  content.push({
    type: "text",
    text: `File: ${req.filename}\n${lengthHint}\n\n<extracted>\n${req.text}\n</extracted>`,
  });

  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(ImportedResume) },
    system: `${SYSTEM}\n\n${req.mode === "ats" ? ATS : EXACT}`,
    messages: [{ role: "user", content }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") throw new AiError(422, "The AI declined to process this file.");
  if (msg.stop_reason === "max_tokens") throw new AiError(422, "This resume is too long to convert in one pass.");
  const parsed = msg.parsed_output;
  if (!parsed) throw new AiError(502, "The AI returned an unreadable result. Please retry.");
  return { resume: parsed, model: msg.model, ms: Date.now() - t0 };
}

export class AiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}
