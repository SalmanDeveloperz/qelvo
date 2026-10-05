import { useEffect, useState } from "react";
import { TEMPLATE_META } from "../engine/meta";
import type { TemplateId } from "../model/types";
import { SITE } from "../site";
import { store } from "../state";
import { IArrowRight, IGitHub, ILinkedIn, IXTwitter, Wordmark } from "./icons";
import { presetTemplate } from "./Setup";
import { ThemePicker } from "./theme";
import { Thumb } from "./Thumb";
import { useTypewriter } from "./Typewriter";
import { warmCode, warmWhenIdle } from "./warm";
import { drafts, openDraft } from "../persist/autosave";
import { ago } from "./Share";

const GALLERY: TemplateId[] = ["modern", "blueprint", "classic", "academic"];

/** The hero's typed line. Each one brings its layout to the front of the desk. */
const LINES: { text: string; id: TemplateId }[] = [
  { text: "Your next resume is two minutes away.", id: "modern" },
  // Parked for later: one line per layout, each bringing its layout to the front.
  // { text: "Blueprint: small caps, sharp rules.", id: "blueprint" },
  // { text: "Classic TeX, the one recruiters trust.", id: "classic" },
  // { text: "Two-Column TeX, dense but calm.", id: "academic" },
  // { text: "Modern Sans, clean and geometric.", id: "modern" },
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

/** ", Muhammad" from a draft name, or nothing if there isn't a usable one. */
const firstName = (name: string) => {
  const f = name.trim().split(/\s+/)[0] ?? "";
  return f && f !== "Untitled" ? `, ${f}` : "";
};

/** A hand-drawn underline that draws itself in once. */
const Squiggle = () => (
  <svg className="squiggle" viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden>
    <path d="M3 10 C 38 3, 64 15, 104 9 S 168 3, 208 9 S 268 15, 297 6" />
  </svg>
);

export function Landing() {
  const typed = useTypewriter(LINE_TEXT);
  const front = LINES[typed.line].id;
  const upcoming = LINES[(typed.line + 1) % LINES.length].id;
  const sides = (id: TemplateId) => DESK_ORDER.filter((x) => x !== id);
  const [left, right] = sides(front);
  const [nextLeft, nextRight] = sides(upcoming);
  useEffect(warmWhenIdle, []);
  const [recent, setRecent] = useState(() => drafts.list()[0]);
  const resume = () => {
    if (recent && openDraft(recent.id)) return;
    // Gone since the page loaded (site data cleared in another tab).
    setRecent(drafts.list()[0]);
    store.notify("That draft isn't in this browser any more.");
  };
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
          <h1>Typeset,<br /><em className="squiggled">not templated.<Squiggle /></em></h1>
          <p className="lede">
            Bring the resume you already have (yes, even the messy one). Pick a look, tweak anything,
            and download the exact PDF you see. Free forever, no sign-up, and no “upgrade to download”
            waiting for you at the end.
          </p>
          <div className="ctas">
            <button className="btn primary lg" onClick={() => start()} onPointerEnter={warmCode} onFocus={warmCode}>Build my resume <IArrowRight /></button>
            <span className="margin-note">takes about two minutes ☕</span>
          </div>
          {recent && (
            <button className="continue" onClick={resume} onPointerEnter={warmCode}>
              <span className="wave" aria-hidden>👋</span> Welcome back{firstName(recent.name)}. <b>Pick up where you left off</b> <span className="faint">· {ago(recent.updated)}</span> <IArrowRight size={14} />
            </button>
          )}
          <div className="promise">
            <span>🔒 Stays in your browser</span>
            <span>✨ Free, for real</span>
            <span>🤖 Every word readable by ATS</span>
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
            <h2>Four looks. Zero fiddling.</h2>
            <p className="sub">Each one was measured against a real resume, down to a hundredth of a point. Your words can change all they like; the spacing won't budge. Switch any time, nothing gets lost.</p>
          </div>
          <div className="gallery">
            {GALLERY.map((id, i) => (
              <button key={id} className="gcard" onClick={() => start(id)} style={{ animationDelay: `${i * 70}ms` }}>
                <div className="gshot"><div className="paper"><Thumb id={id} width={250} lazy /></div></div>
                <div className="gmeta">
                  <h3>{TEMPLATE_META[id].name}<span className="go">Try this one <IArrowRight size={14} /></span></h3>
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
            <p className="sub">Every field in the form is a line of source on the other tab. Change either one and the PDF updates before your fingers leave the keys.</p>
            <ul className="ticks emoji">
              <li><span className="e" aria-hidden>✍️</span> <span><b>Bold</b> or <i>italic</i> anything, even just your surname</span></li>
              <li><span className="e" aria-hidden>💾</span> <span>Saves itself as you type. Close the tab, come back tomorrow, it's there</span></li>
              <li><span className="e" aria-hidden>🔗</span> <span>Share it with one link. No upload, no account, nothing stored on a server</span></li>
              <li><span className="e" aria-hidden>↩️</span> <span>Undo and redo everywhere: <span className="kbd">Ctrl Z</span> <span className="kbd">Ctrl Y</span></span></li>
              <li><span className="e" aria-hidden>👆</span> <span>Click any line in the PDF and land right on it</span></li>
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
          <p className="sub">The preview is the PDF. Download it whenever you like, as many times as you like.</p>
          <div className="steps">
            <div className="step-card"><span className="step-e" aria-hidden>🎨</span><span className="n">01 · look</span><h3>Pick one of four</h3><p>Clean geometric sans, blue small caps, classic TeX, or two-column TeX. Each keeps its spacing exactly.</p></div>
            <div className="step-card"><span className="step-e" aria-hidden>📏</span><span className="n">02 · length</span><h3>Say how many pages</h3><p>One, two or three. Spacing tightens just enough to land there, and you'll hear about it plainly if it can't.</p></div>
            <div className="step-card"><span className="step-e" aria-hidden>📄</span><span className="n">03 · your story</span><h3>Upload or type</h3><p>Your old PDF or Word file comes in with its dates, links and bullets intact. Reworded for ATS only if you ask.</p></div>
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
        </div>
      </section>

      <section className="band note-band">
        <div className="band-inner">
          <article className="maker-note">
            <p className="hi">Hi, I'm Salman 👋</p>
            <p>
              I'm a backend engineer from Lahore, and I built Qelvo because making a good resume shouldn't cost
              money, or a weekend of fighting LaTeX. So it's free, it's open source, and your resume stays in
              your own browser.
            </p>
            <p>If it helps you land an interview, tell me. It honestly makes my day.</p>
            <div className="sign">
              <span className="signature">Salman</span>
              <span className="sign-links">
                <a href={SITE.author.github} target="_blank" rel="noreferrer" aria-label="GitHub"><IGitHub size={15} /></a>
                <a href={SITE.author.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn"><ILinkedIn size={15} /></a>
                <a href={SITE.author.twitter} target="_blank" rel="noreferrer" aria-label="X"><IXTwitter size={14} /></a>
              </span>
            </div>
          </article>
          <div className="closer">
            <div>
              <h2>Go get that job.</h2>
              <p className="sub" style={{ margin: "6px 0 0" }}>We're rooting for you 💛</p>
            </div>
            <button className="btn primary lg" onClick={() => start()} onPointerEnter={warmCode} onFocus={warmCode}>Let's do this <IArrowRight /></button>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="foot-left">
          <span>© 2026 {SITE.name}</span>
          <span className="dot" aria-hidden>·</span>
          <span>Made with <span className="heart" role="img" aria-label="love">❤</span> by <a href={SITE.author.github} target="_blank" rel="noreferrer">{SITE.author.name}</a></span>
        </div>
        <div className="foot-right">
          <a href={`${SITE.repo}/blob/main/NOTICE.md`} target="_blank" rel="noreferrer" className="foot-text">Open source · licences</a>
          <a href={SITE.author.github} target="_blank" rel="noreferrer" aria-label="GitHub: SalmanDeveloperz" title="SalmanDeveloperz"><IGitHub size={16} /></a>
          <a href={SITE.author.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn: msalman199" title="msalman199"><ILinkedIn size={16} /></a>
          <a href={SITE.author.twitter} target="_blank" rel="noreferrer" aria-label="X: sam_env" title="sam_env"><IXTwitter size={15} /></a>
        </div>
      </footer>
    </div>
  );
}
