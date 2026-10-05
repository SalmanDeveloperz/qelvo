<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/qelvo-logo-dark.svg">
    <img alt="Qelvo" src="brand/qelvo-logo-light.svg" width="260">
  </picture>
</p>

<p align="center">
  <b>A resume builder with a real typesetter.</b><br>
  The preview is the PDF. Free, no sign-up, no watermark, MIT licensed.
</p>

<p align="center">
  <a href="https://github.com/SalmanDeveloperz/qelvo/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/SalmanDeveloperz/qelvo/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-ffb547"></a>
  <a href="CONTRIBUTING.md"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-5fd39e"></a>
</p>

---

Most resume builders render HTML in the browser and then hope the PDF comes out the same. It usually doesn't, and you find out after you've paid. Qelvo goes the other way. It ships a small typesetting engine (TeX-style glue, Knuth–Plass line breaking, real font metrics) that runs in your browser and writes the PDF directly. What you see in the preview is the exact file you download, byte for byte.

You can bring the resume you already have. Qelvo reads PDF, DOCX or plain text, recovers the layout (columns, dates, links, bullets), and drops it into the layout you pick. Then you edit it like code, Overleaf-style, or like a form. Both views stay in sync.

## What you get

- **Four strict layouts.** Each one was measured line by line against a real resume. The worst baseline error is 0.01 pt on Modern Sans and 0.09 pt on Two-Column TeX. Margins and rhythm don't drift when your content changes.
- **Page targets that mean it.** Ask for 1, 2 or 3 pages. The engine tightens spacing (up to 16%) and type (up to 6%) to land there, and tells you what to cut if it still can't.
- **Import that reads messy files.** Google Docs exports, Word, LaTeX, sidebars, bullet grids, letter-spaced headers, dates in any format. The offline parser scores 100% field accuracy on the test suite, and runs entirely in the browser.
- **Code and form, in sync.** A LaTeX-flavoured source view with line-numbered diagnostics, and a form for people who'd rather not. Click any line in the PDF to jump to it. Undo and redo cover both.
- **ATS-safe output.** Real selectable text, vector icons that don't parse as garbage, clickable links, proper metadata.
- **Small things done properly.** Per-word bold for your name, optional icons for every contact, five UI themes, Letter or A4.

## Quick start

You need Node.js 20 or newer.

```bash
git clone https://github.com/SalmanDeveloperz/qelvo.git
cd qelvo
npm install
npm run dev
```

Open http://localhost:5173. That's the whole app. The API server on port 8787 only matters if you want AI-assisted import (see below).

## How it works

```
your file ──► extract (pdf.js / mammoth) ──► parse (offline, or Claude) ──► Resume model
                                                                             │
                     code view ◄──── serialize / parse (lossless) ──────────►│
                     form view ◄─────────────────────────────────────────────┤
                                                                             ▼
                                  typesetter (Web Worker) ──► PDF bytes ──► preview + download
```

| Piece | Where | What it does |
|---|---|---|
| Model | `src/model/` | The `Resume` document, inline markup (`**bold**`, `*italic*`, `[text](url)`), lint rules |
| Engine | `src/engine/` | Font metrics (fontkit), line breaking, column flow, the four layouts, the PDF writer (pdf-lib) |
| Source | `src/source/latex.ts` | The code view's language: serialize, parse, diagnostics |
| Import | `src/import/` | Layout recovery from PDF and DOCX, the offline parser, the AI contract |
| UI | `src/ui/` | React. Landing, setup, editor, form, CodeMirror pane, pdf.js preview |
| Server | `server/` | Optional. Express with `/api/import` for AI-assisted import |

Compiles run off the main thread and take a few tens of milliseconds, so the preview keeps up with your typing.

## Layouts

| Layout | Type | Columns | Calibrated against |
|---|---|---|---|
| Modern Sans | Poppins | 2 | a ReportLab resume, 0.01 pt |
| Blueprint | Source Sans Pro, blue small caps | 1 | a LaTeX template, 1.41 pt worst line |
| Classic TeX | Latin Modern (Computer Modern) | 1 | a LaTeX resume, 0.75 pt |
| Two-Column TeX | Latin Modern | 2 | a LaTeX resume, 0.09 pt |

Want to add one? See [Adding a layout](CONTRIBUTING.md#adding-a-layout).

## AI-assisted import (optional)

The offline parser handles almost everything. For the long tail (scanned PDFs, very unusual layouts) and for the *ATS polish* rewrite, the server can hand the extracted text to Claude:

```bash
cp .env.example .env    # set ANTHROPIC_API_KEY
npm run dev             # starts the web app and the API together
```

ATS polish rewrites verbs, tense and punctuation. It never adds a fact, a number or a tool you didn't write, and every change is listed in the editor so you can check it.

## Deploying

Everything except AI import runs in the browser, so a static host is enough and costs nothing per user.

| Host | Steps |
|---|---|
| Vercel | Import the repo. `vercel.json` has the build settings. |
| Netlify | Import the repo. `netlify.toml` has the build settings. |
| Cloudflare Pages | Build command `npm run build`, output `dist`, environment variable `VITE_AI_IMPORT=off`. |
| Docker | `docker build -t qelvo .` then `docker run -p 8787:8787 -e ANTHROPIC_API_KEY=... qelvo` for the full build with AI import. |

Static builds set `VITE_AI_IMPORT=off`. Uploaded files then never leave the browser, and the UI says so.

## Testing

```bash
npm test             # round trip, diagnostics, unit and robustness cases, import accuracy
npm run calibrate    # every baseline vs the reference PDFs (needs Python + pymupdf)
```

The reference PDFs and some import fixtures are real people's resumes, so they live in the git-ignored `fixtures/` folder and those cases are skipped on a fresh clone. `python tests/gen_corpus.py` builds a synthetic corpus (14 documents across PDF and DOCX, with ground truth) from your local copies of Arial, Calibri and friends. [CONTRIBUTING.md](CONTRIBUTING.md) has the details.

## Privacy

Qelvo has no accounts, no database and no analytics. On the static build, your file is read and typeset inside your browser tab. With AI import enabled, the extracted text is sent once to the Anthropic API to be structured and isn't stored by Qelvo.

**Drafts** autosave to your browser's local storage, on your device only, and stay until you clear this site's data. Up to 30 are kept.

**Share links** carry the resume inside the link, after the `#`. Browsers never send that part to a server, so a shared resume never touches Qelvo's hosting or its logs. Whoever opens the link gets their own copy as a new draft; nothing they do changes yours. The link contains your contact details, so share it the way you'd share the PDF.

Everything loaded from a link or from storage is rebuilt field by field from known keys, type-checked and size-capped, and every link that reaches a PDF is limited to `http(s)`, `mailto` and `tel`. Production builds ship a strict Content Security Policy. See [SECURITY.md](SECURITY.md) to report a problem.

## Contributing

Bug reports, import failures, new layouts and docs fixes are all welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Found a security issue? Please follow [SECURITY.md](SECURITY.md) and don't open a public issue.

## License

Qelvo is [MIT licensed](LICENSE). Fonts and icons keep their own licences (OFL, GUST, CC BY 4.0), listed in [NOTICE.md](NOTICE.md).

Made by [Muhammad Salman](https://github.com/SalmanDeveloperz) and [contributors](https://github.com/SalmanDeveloperz/qelvo/graphs/contributors). Follow along on [LinkedIn](https://www.linkedin.com/in/msalman199).
