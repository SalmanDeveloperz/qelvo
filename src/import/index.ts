import { bullet, contact, entry, item, section, skill } from "../model/factory";
import type { Paper, PageTarget, Resume, TemplateId } from "../model/types";
import { annotate, extractPdf, segsFromLines, type Extracted } from "./extract";
import { parseHeuristic } from "./heuristic";
import type { ImportMode, ImportRequest, ImportResponse, ImportedResume } from "./schema";
import { SITE } from "../site";

export type Stage = "reading" | "layout" | "ai" | "local" | "done";

export interface ImportOptions {
  mode: ImportMode;
  pages: PageTarget;
  template: TemplateId;
  paper: Paper;
  onStage?: (s: Stage, detail?: string) => void;
}

export interface ImportResult {
  resume: Resume;
  notes: string[];
  via: "ai" | "local";
  aiError?: string;
}

export async function importFile(file: File, o: ImportOptions): Promise<ImportResult> {
  o.onStage?.("reading");
  const buf = await file.arrayBuffer();
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isDocx = /\.docx$/i.test(file.name) || file.type.includes("officedocument.wordprocessingml");
  let x: Extracted;
  o.onStage?.("layout");
  if (isPdf) x = await extractPdf(buf);
  else if (isDocx) x = await (await import("./docx")).extractDocx(buf);
  else x = segsFromLines(new TextDecoder().decode(buf).split(/\r?\n/).map((t) => ({ text: t.replace(/^\s*[•*-]\s+/, ""), bullet: /^\s*[•*-]\s+/.test(t) })).filter((l) => l.text.trim()));
  const text = annotate(x);
  const scanned = isPdf && x.segs.length < 3;
  return structure(text, x, o, file.name, isPdf ? toBase64(buf) : undefined, scanned);
}

export async function importText(raw: string, o: ImportOptions): Promise<ImportResult> {
  const x = segsFromLines(raw.split(/\r?\n/).map((t) => ({ text: t.replace(/^\s*[•*-]\s+/, ""), bullet: /^\s*[•*-]\s+/.test(t) })).filter((l) => l.text.trim()));
  return structure(annotate(x), x, o, "pasted.txt");
}

async function structure(text: string, x: Extracted, o: ImportOptions, filename: string, pdfBase64?: string, scanned = false): Promise<ImportResult> {
  let aiError: string | undefined;
  if (!SITE.aiImport) {
    if (scanned) throw new Error("This PDF has no selectable text (it's a scan). Export it from Word or Google Docs as a PDF with real text, or upload the DOCX.");
    o.onStage?.("local");
    const parsed = parseHeuristic(x);
    o.onStage?.("done");
    return { resume: toResume(parsed, o), notes: parsed.notes, via: "local" };
  }
  o.onStage?.("ai");
  try {
    const body: ImportRequest = { text, pdfBase64, filename, mode: o.mode, pages: o.pages };
    const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    // A static host answers unknown routes with index.html: only a JSON body with a resume counts.
    const json = /json/i.test(res.headers.get("content-type") ?? "") ? await res.json().catch(() => ({})) : {};
    if (res.ok && json?.resume) {
      const r = json as ImportResponse;
      o.onStage?.("done");
      return { resume: toResume(r.resume, o), notes: r.resume.notes, via: "ai" };
    }
    aiError = json.error ?? (res.ok ? "The import service isn't running here." : `HTTP ${res.status}`);
  } catch (e) {
    aiError = "The import service is unreachable.";
  }
  if (scanned) throw new Error("This PDF has no selectable text (it's a scan). AI import is needed to read it. " + aiError);
  o.onStage?.("local", aiError);
  const parsed = parseHeuristic(x);
  o.onStage?.("done");
  return { resume: toResume(parsed, o), notes: parsed.notes, via: "local", aiError };
}

export function toResume(r: ImportedResume, o: Pick<ImportOptions, "template" | "pages" | "paper">): Resume {
  return {
    version: 1,
    template: o.template,
    pages: o.pages,
    paper: o.paper,
    name: r.name.trim(),
    headline: r.headline.trim(),
    contacts: r.contacts.filter((c) => c.text.trim()).map((c) => contact(c.kind, c.text.trim(), c.url.trim())),
    sections: r.sections.map((s) =>
      section(s.role, {
        type: s.type,
        title: s.title.trim(),
        text: s.text.trim(),
        entries: s.entries.map((e) => {
          const en = entry({ title: e.title, subtitle: e.subtitle, date: e.date, location: e.location, meta: e.meta, link: e.link });
          en.bullets = e.bullets.filter((b) => b.text.trim()).map((b) => bullet(b.text.trim(), b.link.trim()));
          return en;
        }),
        skills: s.skills.filter((k) => k.label.trim() || k.value.trim()).map((k) => skill(k.label.trim(), k.value.trim())),
        items: s.items.filter((i) => i.text.trim()).map((i) => item(i.text.trim(), i.link.trim())),
      }),
    ),
  };
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
