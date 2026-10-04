# Contributing to Qelvo

Thanks for taking the time. Qelvo is a small codebase with a high bar for one thing in particular: the PDF has to be right. Most of this document is about keeping it that way.

If you're new here, good first contributions are import failures (a resume Qelvo reads wrong), lint rules, and docs. Look for issues labelled `good first issue`.

## Ground rules

- **The preview is the download.** Anything that makes the two differ is a bug, not a tradeoff.
- **Never invent content.** The importer and ATS polish may fix wording. They may not add a job, a number, a tool or a link that wasn't in the source.
- **Real resumes stay private.** Don't commit anyone's resume, including your own. See [Reporting an import bug](#reporting-an-import-bug).
- **Measure, then change.** Layout and parser changes come with numbers: `npm test` and, for the engine, `npm run calibrate`.

## Setting up

```bash
git clone https://github.com/SalmanDeveloperz/qelvo.git
cd qelvo
npm install
npm run dev          # web on :5173, API on :8787
```

Node.js 20+ is all you need for the app and the test suite. Python 3 is optional and only used for calibration and the synthetic corpus:

```bash
pip install pymupdf reportlab python-docx fonttools
python tests/gen_corpus.py      # on macOS/Linux: QELVO_FONTS=/path/to/msfonts python tests/gen_corpus.py
```

## Where things live

```
src/model/     the Resume document, inline markup, lint rules
src/engine/    typesetter: fonts, line breaking, flow, layouts, PDF writer
src/source/    the code view's language (serialize, parse, diagnostics)
src/import/    PDF/DOCX layout recovery, offline parser, AI contract
src/ui/        React UI
server/        optional Express API for AI import
scripts/       calibration, round trip, brand kit
tests/         unit, robustness and import accuracy suites
fixtures/      private reference PDFs and truths (git-ignored)
```

`src/engine` and `src/model` don't touch the DOM. They run in a Web Worker in the browser and in plain Node for tests. Keep it that way.

## Making a change

1. Open an issue first for anything bigger than a bug fix, so we can agree on the approach before you spend a weekend on it.
2. Branch from `main`. Keep the PR to one idea.
3. Run the checks:
   ```bash
   npm run typecheck
   npm test
   npm run calibrate     # if you touched src/engine
   ```
4. Open the PR and fill in the template. For anything visual, include a before/after screenshot. For layout changes, include the calibration output.

### Commit messages

Short imperative subject, prefixed with the area. Body explains why, wrapped at 72 columns.

```
import: read dates written as "07/2024 to now"

Some Word templates put the range in a right-aligned tab stop with
"to now" instead of "Present". The date grammar now accepts it.
```

Areas we use: `engine`, `layout/<name>`, `import`, `source`, `ui`, `server`, `docs`, `test`, `build`.

### Code style

- TypeScript, strict mode. No `any` in new code unless you're talking to an untyped library, and then keep it at the boundary.
- Match the file you're in: naming, comment density, how errors are handled.
- Comments say *why*. The code already says what.
- New runtime dependencies need a reason in the PR description. The bundle is loaded by people on slow phones.
- UI copy is plain English, short sentences, no marketing voice. No em dashes.

## Reporting an import bug

This is the most useful thing you can send us, and the easiest to get wrong, because resumes are full of personal data.

1. **Don't attach a real resume to a public issue.** Not yours, not anyone's.
2. Make a minimal copy that still breaks: replace the name, email, phone, employers and schools with fake ones, keep the layout, fonts and structure. Export it the same way the original was made (Google Docs, Word, LaTeX, ...).
3. Check that the redacted copy still fails, then attach it with what you expected and what you got.

`npx tsx tests/dump.ts your.pdf` prints what the extractor recovered, line by line. It often shows the problem straight away.

### Fixing one

Every import fix starts with a failing case:

- **Shareable:** add a persona or layout to `tests/gen_corpus.py`, so the synthetic corpus covers it.
- **Private:** put the PDF in `fixtures/<name>.pdf` and its ground truth in `fixtures/truth/<name>.ts` (export a function named `<name>` returning the expected `Resume`). The suite picks it up automatically and git ignores both.

Then iterate with `npx tsx tests/import.test.ts <name> -v` until it passes, and run the full suite to make sure nothing else moved. Import accuracy stays at 100%.

## Adding a layout

1. Create `src/engine/templates/<id>.ts` exporting `layout<Id>(resume, book, density)` and its font list. `modern.ts` is the clearest example. Vertical rhythm is a table of baseline-to-baseline gaps between kinds of lines; keep it that way so the layout stays strict.
2. Register it in `src/engine/index.ts` and `src/engine/meta.ts`, add the id to `TemplateId` in `src/model/types.ts`, and accept it in `src/source/latex.ts`.
3. Add a showcase sample in `src/model/samples.ts`, then run `npm run thumbs` to pre-render its gallery preview into `public/thumbs/`. The landing page shows these images instead of compiling anything, which is why it loads instantly. Rerun it whenever a layout or showcase sample changes.
4. If you're copying an existing design, put the reference PDF in `fixtures/`, add the pair to `scripts/calibrate.ts`, and report the worst baseline error in the PR.
5. Fonts must be licensed for redistribution (OFL or similar). Subset them like the others and add them to [NOTICE.md](NOTICE.md).

## Licensing

Qelvo is MIT licensed. By opening a pull request you agree that your contribution is released under the same license. If you add third-party code or assets, say where they came from and under what license.

## Getting help

Questions go in [GitHub Discussions](https://github.com/SalmanDeveloperz/qelvo/discussions) or on an issue. For security problems, use [SECURITY.md](SECURITY.md) instead. Please keep things kind; see the [Code of Conduct](CODE_OF_CONDUCT.md).
