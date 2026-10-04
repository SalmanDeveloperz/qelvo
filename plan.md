# Qelvo: plan

Goal: the resume builder people trust with their career history. Every import is accurate, every PDF is exactly what was previewed, and there is no paywall at the download button. Target scale: ~1M users (developers, students, anyone short on time).

## Status (2026-10-04)

### Done
- **Typesetting engine.** Four strict layouts calibrated against real resumes: Modern Sans 0.01 pt, Two-Column TeX 0.09 pt, Classic TeX exact except a one-off quirk in its source, Blueprint 1.41 pt worst line (TFM kerning of a few uppercase pairs). Includes TeX glue and Knuth–Plass breaking, page targets 1/2/3 with bounded auto-fit, Letter/A4, ATS-clean PDF (real text, vector icons, links, metadata).
- **Editor.** Visual form ⇄ LaTeX-flavoured code with a lossless round trip. Compiler-style diagnostics with line numbers. Click-to-locate from the PDF. Resume linting.
- **Import.** Layout-aware PDF extraction (columns, grids, right-aligned dates, links, icon fonts, letter-spacing); DOCX via mammoth; offline parser at **882/882 fields** across 19 documents; Claude structured import with refusal fallback.
- **Editing ergonomics (this round).** App-wide undo/redo (form, code, toolbar) with keystroke coalescing. Ctrl+B / Ctrl+I and B/I buttons in every text field and in code. New sections land in their conventional position (Summary on top).
- **Phase 3 round (2026-10-04).** Blueprint layout (Template 4). Five UI themes. Sharper preview (oversampled canvas, capped at 16 MP). Per-word name weight. Contact icon checkboxes with Font Awesome 6 glyphs (X/Twitter, location, phone, email, website). Gallery showcases hide phone and email. Redesigned landing. Static deploy configs (Netlify, Vercel, Cloudflare Pages) with browser-only import, plus a Dockerfile for the AI build.
- **Tests.** Generated corpus (9 layouts × 4 personas, PDF + DOCX), 90 unit/robustness cases, round-trip, calibration.

### Fixed from feedback
| Report | Root cause | Fix |
|---|---|---|
| Summary not detected | It had no heading | A paragraph before the first heading becomes *Summary* |
| Bullets not fetched | Google Docs tab-fill runs hid the gap between "●" and text, and between grid cells | Drop whitespace-only runs; split at bullet glyphs; read grids column-major |
| Dates and location not picked together | Dates without a dash ("July 2024 Present"), em dashes, places after organisations | New date grammar; place classifier ("Deloitte, London, UK" → org + place) |
| Role/company swapped | Position-based assignment | Role/organisation vocabulary; bold/italic convention only when the author used one |
| "Email: … isn't an email" warning | Labels kept in the value | Contact labels stripped and used as type hints |
| Adding Summary scattered the layout | New sections were appended at the end (Summary at the bottom of the main column) | Canonical insertion order; focus moves to the new section |
| No redo | Only per-field browser undo | Store-level history; Ctrl+Y / Ctrl+Shift+Z / buttons |
| No bold/italic | Markup existed but had no shortcut | Ctrl+B / Ctrl+I toggles and toolbar buttons |

## Next

### Phase 2: verify the AI path and widen the corpus (next)
1. Run AI import against the whole corpus with a key; add an `--ai` flag to `tests/import.test.ts` and track accuracy and cost per resume.
2. Add 20+ real-world resumes (with consent) to `fixtures/`, especially Canva, Overleaf variants, Europass, and non-English ones; write truths; keep 100%.
3. Real DOCX samples from Word and Google Docs (tables used for layout, text boxes, headers/footers).
4. Scanned PDFs: route to AI with page images; state clearly in the UI that offline can't read them.
5. Import review screen: side-by-side original vs parsed, with low-confidence fields highlighted (the parser can expose per-field confidence).

### Launch checklist
1. ~~Name~~: Qelvo. ~~Licence~~: MIT. ~~Repo~~: github.com/qelvo/qelvo. Brand kit in `brand/` (`npx tsx scripts/brand.ts && python scripts/brand_png.py`).
2. Deploy the static build (Vercel or Netlify) from qelvo/qelvo and set the URL in the repo's About box.
3. Buy the domain, point it at the host, and update `og:image` to an absolute URL on that domain.
4. In GitHub settings: enable Discussions, private vulnerability reporting, and upload `brand/qelvo-github-social.png` as the social preview.

### Phase 3: product
- **Persistence (deferred by request):** local drafts first (IndexedDB), then optional accounts. Version history after that.
- **Community-editable templates:** templates as data (spacing tables + font choices) behind a validator that runs the calibration and overflow checks; a gallery with previews compiled from a shared sample.
- **More layouts:** an executive single-column serif, a compact one-page "new grad", an academic CV with publications (3 pages).
- **Mobile:** a read-and-tweak editor (form only) under ~900 px; the PDF preview as a sheet.
- **ATS check view:** show the extracted text exactly as an ATS would read it, with keyword match against a pasted job description.
- **Cover letter** in the same typesetter, matching the resume's layout.

### Phase 4: scale (1M users)
- Static SPA on a CDN; compile runs in the user's browser (zero server cost per edit).
- `/api/import` as a stateless service (serverless or containers) with per-user and per-IP limits, request size caps, and queueing at peaks.
- AI cost control: prompt caching for the system prompt; effort tuned per mode (exact → lower, ATS → higher), measured against the corpus before any change.
- Observability: import success rate, offline-vs-AI accuracy on sampled anonymised telemetry (opt-in), compile time p95.
- Privacy: files are never stored; say so in the UI; add a delete-on-receipt guarantee and a data-processing note.

## Quality bar (non-negotiable)
- No change merges unless `npm test` stays at 100% and `npm run calibrate` is unchanged.
- Every reported import bug becomes a fixture plus truth before it is fixed.
- ATS polish never adds facts, numbers or tools. Any rewrite appears in the notes.

## Known limitations
- Offline parsing of scanned/image-only PDFs is impossible; AI is required there.
- Right-to-left scripts render via fallback glyph replacement in the TeX/Poppins fonts. A Noto fallback font is needed for proper Arabic/Urdu output.
- The editor needs ~1100 px of width; mobile is Phase 3. The landing page and setup work on phones.
- The AI import path is implemented and typechecked but hasn't yet been run against the live API in this environment (no key here).
