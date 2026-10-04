// Vertical flow. Every template describes spacing as baseline-to-baseline
// distances between *kinds* of line ("bullet" → "title" = 14.9pt, …), exactly
// how the originals were measured. A Column consumes lines, breaks pages and
// keeps headings with what follows them.
import type { Item, PageOut } from "./types";

export interface VLine {
  /** Spacing class used to look up the gap from the previous line. */
  kind: string;
  /** Distance from baseline down to the lowest ink (for the bottom margin check). */
  depth: number;
  draw(baseline: number, out: Item[]): void;
  /** Extra items that must be drawn relative to this line (e.g. a section rule). */
}

export type GapFn = (prev: string, next: string) => number;

export class Pager {
  pages: PageOut[] = [];
  constructor(public top: number, public bottom: number) {
    this.page(0);
  }
  page(i: number): PageOut {
    while (this.pages.length <= i) this.pages.push({ items: [], used: 0 });
    return this.pages[i];
  }
}

export class Column {
  pageIndex = 0;
  last: number | null = null;
  prev = "";
  /** Baseline (absolute) the very first line will sit on, if set by the header. */
  constructor(
    public x: number,
    public width: number,
    private pager: Pager,
    private gap: GapFn,
    /** Where the first line of this column goes on page 1, as a function of its kind. */
    private firstOnPage1: (kind: string) => number,
    /** Where the first line goes on later pages. */
    private firstOnLater: (kind: string) => number,
  ) {}

  private nextBaseline(kind: string, last: number | null, prev: string, pageIndex: number): number {
    if (last === null) return pageIndex === 0 ? this.firstOnPage1(kind) : this.firstOnLater(kind);
    return last + this.gap(prev, kind);
  }

  /**
   * Place a group of lines. The first `keep` lines are kept on one page
   * (heading + entry title + first bullet line, etc).
   */
  place(lines: VLine[], keep = 1): void {
    if (!lines.length) return;
    keep = Math.min(keep, lines.length);
    // Keep-together check for the head of the group.
    {
      let last = this.last;
      let prev = this.prev;
      let fits = true;
      for (let i = 0; i < keep; i++) {
        const b = this.nextBaseline(lines[i].kind, last, prev, this.pageIndex);
        if (b + lines[i].depth > this.pager.bottom) { fits = false; break; }
        last = b; prev = lines[i].kind;
      }
      if (!fits && this.last !== null) this.newPage();
    }
    for (const l of lines) {
      let b = this.nextBaseline(l.kind, this.last, this.prev, this.pageIndex);
      if (b + l.depth > this.pager.bottom && this.last !== null) {
        this.newPage();
        b = this.nextBaseline(l.kind, null, this.prev, this.pageIndex);
      }
      const page = this.pager.page(this.pageIndex);
      l.draw(b, page.items);
      page.used = Math.max(page.used, b + l.depth);
      this.last = b;
      this.prev = l.kind;
    }
  }

  newPage() {
    this.pageIndex++;
    this.pager.page(this.pageIndex);
    this.last = null;
  }
}
