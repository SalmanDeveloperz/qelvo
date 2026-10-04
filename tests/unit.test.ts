// Positive and negative unit cases for the parser's building blocks, plus robustness
// runs (blank pages, non-resumes, garbage, stripped formatting).  npx tsx tests/unit.test.ts
import fs from "node:fs";
import path from "node:path";
import { __test as T, isHeadingVocab, normDate, parseHeuristic } from "../src/import/heuristic";
import { extractPdf, segsFromLines, unspace, type Extracted } from "../src/import/extract";
import { toResume } from "../src/import";
import { compile } from "../src/engine";
import { ALL_FONTS } from "../src/engine";
import { nodeBook } from "../scripts/node-fonts";
import { nodePdf } from "./node-pdf";

let pass = 0;
let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  if (!ok) console.log(`FAIL ${name}\n     want ${JSON.stringify(want)}\n     got  ${JSON.stringify(got)}`);
};

// ── Dates ──────────────────────────────────────────────────────────────
const dates: [string, string][] = [
  ["May 2022 — July 2024", "May 2022 – July 2024"],
  ["July 2024 Present", "July 2024 – Present"],
  ["Aug 2023 - present", "Aug 2023 – Present"],
  ["2019-Current", "2019 – Present"],
  ["01/2020 – 03/2022", "01/2020 – 03/2022"],
  ["Jan. 2018 to Dec. 2019", "Jan. 2018 – Dec. 2019"],
  ["Since 2022", "2022 – Present"],
  ["Summer 2021", "Summer 2021"],
  ["Sept 2020 – Now", "Sept 2020 – Present"],
  ["2015 – 2018", "2015 – 2018"],
];
for (const [i, w] of dates) eq(`normDate(${i})`, normDate(T.findDate(i)?.[0] ?? ""), w);
// A year inside a name is not "the date" of a line; a date that is the point of the text is.
eq("datedText(Google Summer of Code 2025)", T.datedText("Google Summer of Code 2025"), false);
eq("datedText(Mar 2025)", T.datedText("Mar 2025"), true);
eq("datedText(Aug 2026 – Present, Lahore, Pakistan)", T.datedText("Aug 2026 – Present, Lahore, Pakistan"), true);
eq("datedText(Built 3 services in 2023 for 40 teams)", T.datedText("Built 3 services in 2023 for 40 teams"), false);
eq("findDate(no date here)", T.findDate("Kubernetes, Docker, CMake"), null);

// ── Places ─────────────────────────────────────────────────────────────
for (const p of ["Lahore, Pakistan", "Austin, TX", "Remote", "San Antonio, TX", "Toronto, Ontario, Canada", "London, UK", "Pakistan", "Hybrid"]) eq(`isLocation(${p})`, T.isLocation(p), true);
for (const p of ["Deloitte, London, UK", "Stripe, Remote", "Software Engineer", "University of Agriculture, Faisalabad", "Go, Python, SQL", "Toronto General Hospital", "CGPA 3.6/4.0", "Education First"]) eq(`isLocation(${p}) is false`, T.isLocation(p), false);
eq("tailPlace(Deloitte, London, UK)", T.tailPlace("Deloitte, London, UK"), { head: "Deloitte", place: "London, UK" });
eq("tailPlace(Stripe, Remote)", T.tailPlace("Stripe, Remote"), { head: "Stripe", place: "Remote" });
eq("tailPlace(Software Engineer)", T.tailPlace("Software Engineer"), null);

// ── Role vs organisation ───────────────────────────────────────────────
eq("splitRoleOrg(at)", T.splitRoleOrg("Data Analyst at Monzo Bank"), ["Data Analyst", "Monzo Bank"]);
eq("splitRoleOrg(comma)", T.splitRoleOrg("Registered Nurse, Toronto General Hospital"), ["Registered Nurse", "Toronto General Hospital"]);
eq("splitRoleOrg(@)", T.splitRoleOrg("Software Engineer @ Google"), ["Software Engineer", "Google"]);
eq("splitRoleOrg(GSoC @ FOSSology stays)", T.splitRoleOrg("Google Summer of Code 2025 @ FOSSology"), ["Google Summer of Code 2025 @ FOSSology"]);
eq("splitRoleOrg(place stays)", T.splitRoleOrg("Software Engineer, Remote"), ["Software Engineer, Remote"]);
eq("splitRoleOrg(degree stays)", T.splitRoleOrg("Bachelor of Science, Computer Science"), ["Bachelor of Science, Computer Science"]);
eq("splitDash(role – repos)", T.splitDash("Contributor – jenkinsci/jenkins"), ["Contributor", "jenkinsci/jenkins"]);
eq("splitDash(date range stays)", T.splitDash("May 2022 – July 2024"), ["May 2022 – July 2024"]);
eq("splitDash(mixed)", T.splitDash("Stripe — Engineer — Mar 2021 – Present"), ["Stripe", "Engineer", "Mar 2021 – Present"]);

// ── Headings ───────────────────────────────────────────────────────────
for (const h of ["WORK EXPERIENCE", "Technical Skills", "HONORS & AWARDS", "Qualification", "Open Source Contributions", "Relevant Coursework", "TOOLS", "Contact"]) eq(`heading(${h})`, isHeadingVocab(h), true);
for (const h of ["9D Technologies", "Education First", "Skills Matrix", "Google Summer of Code 2025", "Software Engineer", "Lahore, Pakistan", "and"]) eq(`heading(${h}) is false`, isHeadingVocab(h), false);
eq("sectionRole(Qualification)", T.sectionRole("Qualification"), "education");
eq("sectionRole(TOOLS)", T.sectionRole("TOOLS"), "skills");
eq("sectionRole(Contact Info)", T.sectionRole("Contact Info"), "contact");

// ── Contacts ───────────────────────────────────────────────────────────
const cc = (t: string) => T.classifyContact(t, false);
eq("contact(Email: label)", cc("Email: farwa@gmail.com"), { kind: "email", text: "farwa@gmail.com", url: "mailto:farwa@gmail.com" });
eq("contact(Phone: label)", cc("Phone: +92 300 0000000"), { kind: "phone", text: "+92 300 0000000", url: "" });
eq("contact(LinkedIn: handle)", cc("LinkedIn: farwa-ramzan ⟨link: https://www.linkedin.com/in/farwa-ramzan/⟩"), { kind: "linkedin", text: "farwa-ramzan", url: "https://www.linkedin.com/in/farwa-ramzan/" });
eq("contact(bare linkedin url)", cc("linkedin.com/in/jane"), { kind: "linkedin", text: "linkedin.com/in/jane", url: "https://linkedin.com/in/jane" });
eq("contact(website)", cc("jane.dev"), { kind: "website", text: "jane.dev", url: "https://jane.dev" });
eq("contact(US phone)", cc("(512) 555-0147"), { kind: "phone", text: "(512) 555-0147", url: "" });
eq("contact(a sentence is not a contact)", cc("Built systems that scale"), null);
eq("unspace(letter-spaced)", unspace("L a h o r e, P a k i s t a n"), "Lahore, Pakistan");
eq("unspace(normal text untouched)", unspace("A B testing at Acme"), "A B testing at Acme");

// ── Robustness: never crash, always a usable document ──────────────────
const book = nodeBook();
await book.load(ALL_FONTS);
const robust = async (name: string, x: Extracted) => {
  try {
    const r = toResume(parseHeuristic(x), { template: "modern", pages: 1, paper: "letter" });
    for (const t of ["classic", "academic", "modern"] as const) compile({ ...r, template: t }, book);
    pass++;
    return r;
  } catch (e) {
    fail++;
    console.log(`FAIL robust ${name}: ${(e as Error).stack}`);
    return null;
  }
};
const pdfOf = async (f: string) => { const b = fs.readFileSync(f); return extractPdf(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), nodePdf); };
// The generated corpus (python tests/gen_corpus.py) is git-ignored; without it these cases are skipped.
const hasCorpus = fs.existsSync("tests/corpus/neg_blank.neg.pdf");
if (hasCorpus) {
  const blank = await robust("blank page", await pdfOf("tests/corpus/neg_blank.neg.pdf"));
  eq("blank page → empty resume", blank && { name: blank.name, sections: blank.sections.length, contacts: blank.contacts.length }, { name: "", sections: 0, contacts: 0 });
  const article = await robust("non-resume article", await pdfOf("tests/corpus/neg_article.neg.pdf"));
  eq("article → no invented contacts", article?.contacts.length, 0);
} else console.log("skip  corpus cases (run: python tests/gen_corpus.py)");
await robust("empty text", segsFromLines([]));
await robust("garbage", segsFromLines(["@@@ ### $$$", "•", "|||", "—", "12345", "a@b", "http://", ")))((("].map((text) => ({ text }))));
await robust("only headings", segsFromLines(["EXPERIENCE", "EDUCATION", "SKILLS"].map((text) => ({ text, bold: true }))));
await robust("emoji + RTL + CJK", segsFromLines([{ text: "Zoë Ångström 🚀", size: 20 }, { text: "zoe@example.com" }, { text: "EXPERIENCE", bold: true }, { text: "مهندس برمجيات at 株式会社テスト", bold: true }, { text: "Built 🔥 things", bullet: true }]));
await robust("10k-char bullet", segsFromLines([{ text: "Ann Lee", size: 20 }, { text: "EXPERIENCE", bold: true }, { text: "Acme Inc", bold: true }, { text: "x".repeat(10000), bullet: true }]));
// Strip every formatting signal from the corpus (all one size, no bold): the parser must still not crash.
for (const f of hasCorpus ? fs.readdirSync("tests/corpus").filter((x) => x.endsWith(".pdf") && !x.includes(".neg.")) : []) {
  const x = await pdfOf(path.join("tests/corpus", f));
  for (const s of x.segs) { s.size = 10; s.bold = false; s.italic = false; s.text = s.text.replace(/\*\*/g, ""); }
  await robust(`flattened ${f}`, x);
}

console.log(`\n${fail ? `${fail} FAILED, ` : ""}${pass} passed`);
process.exit(fail ? 1 : 0);
