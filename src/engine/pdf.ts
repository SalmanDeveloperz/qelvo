// Display list → PDF bytes. The preview pane renders exactly these bytes, so
// what the user sees is, byte for byte, what they download.
import { PDFDocument, PDFName, PDFString, rgb, setCharacterSpacing, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { SHAPING, type FontBook, type FontKey, type Shaping } from "./fonts";
import { FA, ICON_KEY } from "./fa";
import type { IconKind, LayoutResult, RGB } from "./types";

export interface PdfMeta {
  title: string;
  author: string;
  subject?: string;
  keywords?: string[];
}



const col = (c: RGB) => rgb(c[0], c[1], c[2]);

export async function writePdf(layout: LayoutResult, book: FontBook, meta: PdfMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const embedded = new Map<string, PDFFont>();
  const font = async (key: FontKey, shaping: Shaping) => {
    const id = `${key}|${shaping}`;
    let f = embedded.get(id);
    if (!f) {
      // Fonts are pre-subset at build time (Latin + punctuation), so full embedding stays small
      // and sidesteps pdf-lib's runtime subsetter.
      f = await doc.embedFont(book.bytes(key), { subset: false, features: SHAPING[shaping] as any });
      embedded.set(id, f);
    }
    return f;
  };

  const H = layout.height;
  for (const p of layout.pages) {
    const page = doc.addPage([layout.width, layout.height]);
    for (const it of p.items) {
      switch (it.t) {
        case "text": {
          const f = await font(it.font, it.shaping);
          if (it.charSpacing) page.pushOperators(setCharacterSpacing(it.charSpacing));
          for (const run of book.kernedRuns(it.font, it.text, it.size, it.shaping)) {
            page.drawText(run.text, { x: it.x + run.dx, y: H - it.y, size: it.size, font: f, color: col(it.color) });
          }
          if (it.charSpacing) page.pushOperators(setCharacterSpacing(0));
          break;
        }
        case "rule":
          page.drawLine({ start: { x: it.x1, y: H - it.y }, end: { x: it.x2, y: H - it.y }, thickness: it.width, color: col(it.color) });
          break;
        case "dot":
          page.drawCircle({ x: it.cx, y: H - it.cy, size: it.r, color: col(it.color) });
          break;
        case "rect":
          page.drawSvgPath(roundedRect(it.w, it.h, it.radius), { x: it.x, y: H - it.top, color: col(it.color) });
          break;
        case "icon":
          drawIcon(page, it.kind, it.x, H - it.top, it.size, it.color);
          break;
        case "link":
          addLink(doc, page, it.x, H - it.top - it.h, it.x + it.w, H - it.top, it.url);
          break;
      }
    }
  }

  doc.setTitle(meta.title, { showInWindowTitleBar: true });
  doc.setAuthor(meta.author);
  if (meta.subject) doc.setSubject(meta.subject);
  if (meta.keywords?.length) doc.setKeywords(meta.keywords);
  doc.setCreator("Qelvo");
  doc.setProducer("Qelvo typesetter");
  doc.setLanguage("en");
  return doc.save();
}

function drawIcon(page: PDFPage, kind: IconKind, x: number, yTop: number, size: number, c: RGB) {
  if (kind === "linkedinSquare") {
    page.drawSvgPath(roundedRect(size, size, size * 0.16), { x, y: yTop, color: col(c) });
    const [vw, vh, d] = FA[ICON_KEY.linkedinSquare];
    const inner = size * 0.56;
    const sc = inner / vh;
    page.drawSvgPath(d, { x: x + (size - vw * sc) / 2, y: yTop - (size - inner) / 2 - inner * 0.04, scale: sc, color: rgb(1, 1, 1) });
    return;
  }
  const [vw, vh, d] = FA[ICON_KEY[kind]];
  const sc = size / vh;
  page.drawSvgPath(d, { x, y: yTop, scale: sc, color: col(c) });
}

function roundedRect(w: number, h: number, r: number): string {
  const k = Math.min(r, w / 2, h / 2);
  return `M${k} 0H${w - k}Q${w} 0 ${w} ${k}V${h - k}Q${w} ${h} ${w - k} ${h}H${k}Q0 ${h} 0 ${h - k}V${k}Q0 0 ${k} 0Z`;
}

function addLink(doc: PDFDocument, page: PDFPage, x1: number, y1: number, x2: number, y2: number, url: string) {
  const annot = doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x1, y1, x2, y2],
    Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  });
  page.node.addAnnot(doc.context.register(annot));
  void PDFName;
}
