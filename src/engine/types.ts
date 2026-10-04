import type { FontKey, Shaping } from "./fonts";

export type RGB = readonly [number, number, number];
export type IconKind = "github" | "linkedin" | "link" | "linkedinSquare" | "envelope" | "phone" | "globe" | "marker" | "twitter";

/** All coordinates are PDF points with y measured DOWN from the top edge of the page. */
export interface TextItem {
  t: "text";
  x: number;
  /** Baseline. */
  y: number;
  text: string;
  font: FontKey;
  size: number;
  color: RGB;
  shaping: Shaping;
  /** Document path of the field this text came from: powers click-to-edit. */
  src?: string;
  /** Extra space after every glyph (PDF Tc), e.g. to give synthesized small caps their true widths. */
  charSpacing?: number;
}
export interface RuleItem { t: "rule"; x1: number; x2: number; y: number; width: number; color: RGB }
export interface IconItem { t: "icon"; kind: IconKind; x: number; top: number; size: number; color: RGB }
export interface DotItem { t: "dot"; cx: number; cy: number; r: number; color: RGB }
export interface RectItem { t: "rect"; x: number; top: number; w: number; h: number; radius: number; color: RGB }
export interface LinkItem { t: "link"; x: number; top: number; w: number; h: number; url: string }

export type Item = TextItem | RuleItem | IconItem | DotItem | RectItem | LinkItem;

export interface PageOut {
  items: Item[];
  /** Lowest baseline+descent used on this page, per column (for the fill meter). */
  used: number;
}

export interface LayoutResult {
  width: number;
  height: number;
  pages: PageOut[];
  /** Usable bottom limit (y) for content. */
  bottom: number;
  /** Top of the content area on continuation pages. */
  top: number;
  fonts: FontKey[];
}

export interface TextStyle {
  font: FontKey;
  size: number;
  color: RGB;
}
