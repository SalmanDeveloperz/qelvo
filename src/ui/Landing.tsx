import { useEffect, useState } from "react";
import { TEMPLATE_META } from "../engine/meta";
import type { TemplateId } from "../model/types";
import { SITE } from "../site";
import { store } from "../state";
import { ICheck, IArrowRight, IGitHub, Wordmark } from "./icons";
import { presetTemplate } from "./Setup";
import { ThemePicker } from "./theme";
import { Thumb } from "./Thumb";
import { useTypewriter } from "./Typewriter";
import { warmCode, warmWhenIdle } from "./warm";

const GALLERY: TemplateId[] = ["modern", "blueprint", "classic", "academic"];

/** The hero's typed line. Each one brings its layout to the front of the desk. */
const LINES: { text: string; id: TemplateId }[] = [
  { text: "Your next resume is two minutes away.", id: "modern" },
  { text: "Blueprint: small caps, sharp rules.", id: "blueprint" },
  { text: "Classic TeX, the one recruiters trust.", id: "classic" },
  { text: "Two-Column TeX, dense but calm.", id: "academic" },
  { text: "Modern Sans, clean and geometric.", id: "modern" },
];
const LINE_TEXT = LINES.map((l) => l.text);
const DESK_ORDER: TemplateId[] = ["classic", "blueprint", "academic", "modern"];

/**
 * Sheets for one desk slot, stacked. Each layout renders once and is kept, so switching is a
 * cross-fade. The next layout renders ahead of time, and the current sheet stays up until
 * the new one is actually drawn.
 */
function SheetStack({ active, next, width, className, priority }: { active: TemplateId; next: TemplateId; width: number; className: string; priority?: boolean }) {
  const [seen, setSeen] = useState<TemplateId[]>([active]);
  const [ready, setReady] = useState<TemplateId[]>([]);
  const [shown, setShown] = useState<TemplateId>(active);
  useEffect(() => setSeen((s) => [...s, ...[active, next].filter((id, i, a) => !s.includes(id) && a.indexOf(id) === i)]), [active, next]);
  useEffect(() => { if (ready.includes(active)) setShown(active); }, [active, ready]);
  return (
    <div className={`sheet-slot ${className}`}>
      {seen.map((id) => (
        <div key={id} className={`sheet ${id === shown ? "on" : ""}`}>
          <Thumb id={id} width={width} priority={priority && id === active} onReady={() => setReady((r) => (r.includes(id) ? r : [...r, id]))} />
        </div>
      ))}
    </div>
  );
}

export function Landing() {
  const typed = useTypewriter(LINE_TEXT);
  const front = LINES[typed.line].id;
  const upcoming = LINES[(typed.line + 1) % LINES.length].id;
  const sides = (id: TemplateId) => DESK_ORDER.filter((x) => x !== id);
  const [left, right] = sides(front);
  const [nextLeft, nextRight] = sides(upcoming);
  useEffect(warmWhenIdle, []);
  const start = (id?: TemplateId) => { if (id) presetTemplate(id); store.go("setup"); };
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="landing">
      <div className="topnav">
        <nav className="nav">
          <div className="brand"><Wordmark height={30} /></div>
          <div className="nav-links">
            <button onClick={() => jump("layouts")}>Layouts</button>
            <button onClick={() => jump("editor")}>Editor</button>
            <button onClick={() => jump("how")}>How it works</button>
            {SITE.repo && <a href={SITE.repo} target="_blank" rel="noreferrer"><IGitHub size={15} /> Source</a>}
          </div>
          <div className="nav-right">
            <ThemePicker />
            <button className="btn primary" onClick={() => start()} onPointerEnter={warmCode} onFocus={warmCode}>Open the editor</button>
          </div>
        </nav>
      </div>

      <header className="hero">
        <div className="hero-copy">
          <h2 className="typer" aria-label={LINES[0].text}>
            <span aria-hidden>{typed.text}</span>
            <span className="caret" aria-hidden />
          </h2>
          <h1>Typeset,<br /><em>not templated.</em></h1>
          <p className="lede">
            Drop in the resume you already have, pick a layout, and download the exact PDF you see.
            Four layouts, each measured against a real resume down to a hundredth of a point.
            Edit it like code or like a form.
          </p>
          <div className="ctas">
            <button className="btn primary lg" onClick={() => start()} onPointerEnter={warmCode} onFocus={warmCode}>Build my resume <IArrowRight /></button>
            <button className="btn lg" onClick={() => jump("layouts")}>See the layouts</button>
          </div>
          <div className="promise">
            <span><ICheck size={15} /> Free PDF, no watermark</span>
            <span><ICheck size={15} /> No sign-up</span>
            <span><ICheck size={15} /> Selectable text that ATS can read</span>
          </div>
        </div>
        <div className="desk" aria-hidden>
          <SheetStack className="s1" active={left} next={nextLeft} width={330} />
          <SheetStack className="s2" active={right} next={nextRight} width={330} />
          <SheetStack className="s3" active={front} next={upcoming} width={370} priority />
          <div className="measure"><b>{TEMPLATE_META[front].name}</b> · typeset live in your browser</div>
        </div>
      </header>

      <section className="band" id="layouts">
        <div className="band-inner">
          <div className="band-head">
            <h2>Four layouts. All of them strict.</h2>
            <p className="sub">Margins, type sizes and spacing don't drift when your content changes. Switch between them any time; nothing you wrote is lost.</p>
          </div>
          <div className="gallery">
            {GALLERY.map((id, i) => (
              <button key={id} className="gcard" onClick={() => start(id)} style={{ animationDelay: `${i * 70}ms` }}>
                <div className="gshot"><div className="paper"><Thumb id={id} width={250} lazy /></div></div>
                <div className="gmeta">
                  <h3>{TEMPLATE_META[id].name}<span className="go">Use this <IArrowRight size={14} /></span></h3>
                  <p>{TEMPLATE_META[id].tagline}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="band" id="editor">
        <div className="band-inner split-feature">
          <div>
            <h2>Write it like code.<br />Or don't.</h2>
            <p className="sub">Every field in the form is a line of source on the other tab. Change either one and the PDF recompiles before you lift your fingers off the keys.</p>
            <ul className="ticks">
              <li><ICheck size={15} /> <span><b>Bold</b> and <i>italic</i> anywhere, including your name and headline</span></li>
              <li><ICheck size={15} /> <span>Optional icons for LinkedIn, GitHub, X, website, phone and location</span></li>
              <li><ICheck size={15} /> <span>Undo and redo across both views: <span className="kbd">Ctrl Z</span> <span className="kbd">Ctrl Y</span></span></li>
              <li><ICheck size={15} /> <span>Click any line in the PDF to jump to it</span></li>
            </ul>
          </div>
          <pre className="code-mock" aria-label="Example resume source">
<span className="c">% resume.tex</span>{"\n"}
<span className="k">\template</span>{"{"}<span className="v">blueprint</span>{"}"}  <span className="k">\pages</span>{"{"}<span className="v">1</span>{"}"}{"\n"}
{"\n"}
<span className="k">\name</span>[custom]{"{"}<span className="k">\textbf</span>{"{"}Ada{"}"} Lovelace{"}"}{"\n"}
<span className="k">\headline</span>{"{"}Analytical Engine Programmer{"}"}{"\n"}
<span className="k">\github</span>[icon]{"{"}ada{"}"}{"{"}<span className="u">https://github.com/ada</span>{"}"}{"\n"}
<span className="k">\website</span>[icon]{"{"}ada.dev{"}"}{"{"}<span className="u">https://ada.dev</span>{"}"}{"\n"}
{"\n"}
<span className="k">\section</span>{"{"}Experience{"}"}{"\n"}
<span className="k">\entry</span>{"{"}Babbage &amp; Co.{"}"}{"{"}Programmer{"}"}{"{"}1842 -- 1843{"}"}{"{"}London{"}"}{"\n"}
{"  "}<span className="k">\item</span> Wrote the first published algorithm, for Bernoulli numbers{"\n"}
{"  "}<span className="k">\item</span> Annotated the Menabrea paper, tripling its length<span className="cursor" />
          </pre>
        </div>
      </section>

      <section className="band" id="how">
        <div className="band-inner">
          <h2>Three steps. None of them is “upgrade to download.”</h2>
          <p className="sub">The preview is the PDF. You can download it at any point, as many times as you like.</p>
          <div className="steps">
            <div className="step-card"><span className="n">01 · layout</span><h3>Pick one of four</h3><p>Geometric sans, blue small caps, classic single-column TeX, or two-column TeX. Each one keeps its spacing exactly.</p></div>
            <div className="step-card"><span className="n">02 · length</span><h3>Say how many pages</h3><p>One, two or three. The typesetter tightens spacing just enough to land there, and tells you plainly if the content won't fit.</p></div>
            <div className="step-card"><span className="n">03 · content</span><h3>Upload or type</h3><p>Your old PDF or DOCX is read with its layout, links and dates intact, then rewritten in ATS wording only if you ask.</p></div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="band-inner">
          <h2>Things we decided not to do.</h2>
          <p className="sub">Small choices that separate a resume someone reads from one a parser rejects.</p>
          <div className="truths">
            <div className="truth"><div className="q">Render HTML, hope the PDF matches</div><div className="a">One typesetter draws both the preview and the download. They're the same bytes.</div></div>
            <div className="truth"><div className="q">Invent metrics to sound impressive</div><div className="a">ATS polish rewrites verbs and grammar. It never adds a number you didn't write.</div></div>
            <div className="truth"><div className="q">Icons as font glyphs that parse as “”</div><div className="a">Icons are vector drawings. The text layer stays clean for applicant tracking systems.</div></div>
            <div className="truth"><div className="q">Squeeze everything onto one page</div><div className="a">Spacing tightens by up to 16%, type by up to 6%, and no further. Past that, it tells you what to cut.</div></div>
          </div>
          <div className="closer">
            <h2>Start with the resume you already have.</h2>
            <button className="btn primary lg" onClick={() => start()} onPointerEnter={warmCode} onFocus={warmCode}>Build my resume <IArrowRight /></button>
          </div>
        </div>
      </section>

      <footer className="foot">
        <span>Open source. Fonts: Poppins and Source Sans (OFL), Latin Modern (GUST). Icons: Font Awesome Free (CC BY 4.0).</span>
        {SITE.repo ? <a className="mono" href={SITE.repo} target="_blank" rel="noreferrer">source on GitHub</a> : <span className="mono">built by engineers who rewrote their resume one too many times</span>}
      </footer>
    </div>
  );
}
