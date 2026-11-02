import type { Color, Surface, TextOptions } from './surface';

// The page flow: a cursor that moves down the page, starts a new page when the next block does not fit, and draws the
// pieces every report is made of (a header, section titles, cards, tables, a line of small print).

export const COLORS = {
  ink: [17, 24, 39] as Color,
  muted: [107, 114, 128] as Color,
  soft: [156, 163, 175] as Color,
  line: [229, 231, 235] as Color,
  panel: [249, 250, 251] as Color,
  zebra: [252, 252, 253] as Color,
  accent: [220, 38, 38] as Color,
  slate: [30, 41, 59] as Color,
  blue: [37, 99, 235] as Color,
  amber: [217, 119, 6] as Color,
  green: [5, 150, 105] as Color,
  white: [255, 255, 255] as Color,
};

export const hexColor = (hex: string): Color => {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const LH = 1.15;

export interface Column {
  title: string;
  /** A fixed width in points, or a share of what is left. */
  width?: number;
  grow?: number;
  align?: 'left' | 'center' | 'right';
}
export interface Cell {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: Color;
  fill?: Color;
  span?: number;
}
export type TableRow = readonly (string | Cell)[];

export class Flow {
  y: number;
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly bottom: number;
  private readonly top: number;

  constructor(
    readonly s: Surface,
    options: { margin?: number; top?: number; bottom?: number } = {},
  ) {
    const margin = options.margin ?? 40;
    this.left = margin;
    this.right = s.pageWidth - margin;
    this.width = s.pageWidth - margin * 2;
    this.top = options.top ?? margin;
    this.bottom = s.pageHeight - (options.bottom ?? 46);
    this.y = this.top;
  }

  /** A new page if `height` does not fit below the cursor. True when one was started. */
  ensure(height: number): boolean {
    if (this.y + height <= this.bottom) return false;
    this.s.addPage();
    this.y = this.top;
    return true;
  }

  space(points: number): void {
    this.y += points;
  }

  /** One or more lines of text at the cursor, wrapped to the width; the cursor moves below them. */
  paragraph(text: string, options: TextOptions & { gap?: number; x?: number; width?: number } = {}): void {
    const size = options.size ?? 8;
    const width = options.width ?? this.width;
    const lines = this.s.wrap(text, width, options);
    for (const line of lines) {
      this.ensure(size * LH + 1);
      this.s.text(line, options.x ?? this.left, this.y + size, options);
      this.y += size * LH;
    }
    this.y += options.gap ?? 2;
  }

  /** The heading of a section, with a thin rule under it. */
  title(text: string, keepWith = 90): void {
    this.ensure(keepWith); // a heading is never left alone at the foot of a page
    this.s.text(text.toUpperCase(), this.left, this.y + 10, { size: 10, bold: true, color: COLORS.slate });
    this.s.line(this.left, this.y + 15, this.right, this.y + 15, { color: COLORS.line, width: 0.8 });
    this.y += 24;
  }

  /** The brand header: the name and the title on the left, who it was prepared by on the right. */
  header(options: {
    title: string;
    lines: string[];
    right?: { label: string; value: string; meta: string[] };
  }): void {
    const { s } = this;
    s.text('AuraTrack', this.left, this.y + 12, { size: 12, bold: true, color: COLORS.accent });
    s.text(options.title, this.left, this.y + 34, { size: 18, bold: true });
    let y = this.y + 48;
    for (const line of options.lines) {
      s.text(line, this.left, y, { size: 8.5, color: COLORS.muted });
      y += 11;
    }
    let ry = this.y + 12;
    if (options.right) {
      const w = this.width * 0.34;
      s.text(options.right.label.toUpperCase(), this.right, ry, { size: 7, bold: true, color: COLORS.muted, align: 'right' });
      ry += 13;
      for (const part of s.wrap(options.right.value, w, { size: 11, bold: true })) {
        s.text(part, this.right, ry, { size: 11, bold: true, align: 'right' });
        ry += 13;
      }
      for (const meta of options.right.meta) {
        for (const part of s.wrap(meta, w, { size: 8 })) {
          s.text(part, this.right, ry, { size: 8, color: COLORS.muted, align: 'right' });
          ry += 10;
        }
      }
    }
    const bottom = Math.max(y, ry) + 4;
    s.line(this.left, bottom, this.right, bottom, { color: COLORS.accent, width: 1.5 });
    this.y = bottom + 14;
  }

  /** Cards side by side, equal in width, each as tall as the tallest needs. */
  cards(items: { label: string; value: string; lines?: string[] }[], options: { minHeight?: number; valueSize?: number } = {}): void {
    const gap = 8;
    const w = (this.width - gap * (items.length - 1)) / items.length;
    const size = options.valueSize ?? 10;
    const measured = items.map((c) => ({
      value: this.s.wrap(c.value, w - 16, { size, bold: true }),
      lines: (c.lines ?? []).flatMap((l) => this.s.wrap(l, w - 16, { size: 8 })),
    }));
    const height = Math.max(options.minHeight ?? 48, ...measured.map((m) => 28 + m.value.length * (size + 2) + m.lines.length * 10 + 6));
    this.ensure(height + 8);
    items.forEach((c, i) => {
      const x = this.left + i * (w + gap);
      this.s.rect(x, this.y, w, height, { fill: COLORS.panel, stroke: COLORS.line, radius: 4 });
      this.s.text(c.label.toUpperCase(), x + 8, this.y + 14, { size: 6.5, bold: true, color: COLORS.muted });
      let ty = this.y + 28;
      for (const part of measured[i]?.value ?? []) {
        this.s.text(part, x + 8, ty, { size, bold: true });
        ty += size + 2;
      }
      for (const line of measured[i]?.lines ?? []) {
        this.s.text(line, x + 8, ty, { size: 8, color: COLORS.muted });
        ty += 10;
      }
    });
    this.y += height + 10;
  }

  /** Big numbers in a row (the four stat cards). */
  stats(items: { value: string; label: string }[]): void {
    const gap = 8;
    const w = (this.width - gap * (items.length - 1)) / items.length;
    this.ensure(70);
    items.forEach((c, i) => {
      const x = this.left + i * (w + gap);
      this.s.rect(x, this.y, w, 58, { fill: COLORS.white, stroke: COLORS.line, radius: 4 });
      this.s.text(c.value, x + w / 2, this.y + 29, { size: 20, bold: true, color: COLORS.accent, align: 'center' });
      const label = this.s.wrap(c.label.toUpperCase(), w - 10, { size: 6.5, bold: true });
      label.slice(0, 2).forEach((line, k) => this.s.text(line, x + w / 2, this.y + 42 + k * 8, { size: 6.5, bold: true, color: COLORS.muted, align: 'center' }));
    });
    this.y += 70;
  }

  /** A card with a coloured edge: a flag, or a seizure's details. Returns nothing; the cursor moves below it. */
  note(options: { edge: Color; title: string; lines: string[]; fill?: Color }): void {
    const w = this.width - 16;
    const title = this.s.wrap(options.title, w, { size: 9, bold: true });
    const body = options.lines.flatMap((l) => this.s.wrap(l, w, { size: 8 }));
    const height = 12 + title.length * 11 + body.length * 10 + 6;
    this.ensure(Math.min(height, 120) + 8);
    this.s.rect(this.left, this.y, this.width, height, { fill: options.fill ?? COLORS.panel, stroke: COLORS.line, radius: 4 });
    this.s.rect(this.left, this.y, 4, height, { fill: options.edge });
    let ty = this.y + 14;
    for (const line of title) {
      this.s.text(line, this.left + 12, ty, { size: 9, bold: true });
      ty += 11;
    }
    for (const line of body) {
      this.s.text(line, this.left + 12, ty, { size: 8, color: COLORS.muted });
      ty += 10;
    }
    this.y += height + 8;
  }

  /**
   * A table with a heading row that repeats on each page, zebra rows, and cells that wrap. A row that is taller than the rest
   * of the page continues on the next one: nothing is cut off.
   */
  table(columns: readonly Column[], rows: readonly TableRow[], options: { size?: number; pad?: number; left?: number; width?: number; head?: Color } = {}): void {
    const size = options.size ?? 8;
    const pad = options.pad ?? 5;
    const left = options.left ?? this.left;
    const total = options.width ?? this.width;
    const fixed = columns.reduce((n, c) => n + (c.width ?? 0), 0);
    const grows = columns.reduce((n, c) => n + (c.width === undefined ? (c.grow ?? 1) : 0), 0);
    const widths = columns.map((c) => c.width ?? ((total - fixed) * (c.grow ?? 1)) / Math.max(1, grows));
    const xs = widths.map((_, i) => left + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const lh = size * LH;
    const head = options.head ?? COLORS.slate;

    const drawHead = () => {
      const lines = columns.map((c, i) => this.s.wrap(c.title, (widths[i] ?? 0) - pad * 2, { size, bold: true }));
      const h = Math.max(...lines.map((l) => l.length)) * lh + pad * 2;
      this.ensure(h + lh * 2 + pad * 2);
      this.s.rect(left, this.y, total, h, { fill: head });
      lines.forEach((l, i) => this.s.text(l, this.cellX(xs[i] ?? 0, widths[i] ?? 0, pad, columns[i]?.align), this.y + pad + size, { size, bold: true, color: COLORS.white, align: columns[i]?.align ?? 'left' }));
      this.y += h;
    };
    drawHead();

    rows.forEach((row, rowIndex) => {
      // The cells of this row, with the columns each spans
      const cells: { c: Cell; from: number; to: number; lines: string[]; w: number; x: number }[] = [];
      let col = 0;
      for (const raw of row) {
        const c: Cell = typeof raw === 'string' ? { text: raw } : raw;
        const span = Math.max(1, c.span ?? 1);
        const w = widths.slice(col, col + span).reduce((a, b) => a + b, 0);
        cells.push({ c, from: col, to: col + span, lines: this.s.wrap(c.text, w - pad * 2, { size, bold: c.bold, italic: c.italic }), w, x: xs[col] ?? left });
        col += span;
      }
      let done = 0;
      const most = Math.max(1, ...cells.map((c) => c.lines.length));
      while (done < most) {
        let room = Math.floor((this.bottom - this.y - pad * 2) / lh);
        if (room < Math.min(2, most - done)) {
          this.s.addPage();
          this.y = this.top;
          drawHead();
          room = Math.floor((this.bottom - this.y - pad * 2) / lh);
        }
        const take = Math.min(room, most - done);
        const h = take * lh + pad * 2;
        for (const cell of cells) {
          this.s.rect(cell.x, this.y, cell.w, h, { fill: cell.c.fill ?? (rowIndex % 2 === 1 ? COLORS.zebra : COLORS.white), stroke: COLORS.line, lineWidth: 0.5 });
          const slice = cell.lines.slice(done, done + take);
          if (slice.length > 0) {
            const align = columns[cell.from]?.align ?? 'left';
            this.s.text(slice, this.cellX(cell.x, cell.w, pad, align), this.y + pad + size, {
              size,
              bold: cell.c.bold,
              italic: cell.c.italic,
              color: cell.c.color ?? COLORS.ink,
              align,
            });
          }
        }
        this.y += h;
        done += take;
      }
    });
    this.y += 10;
  }

  private cellX(x: number, w: number, pad: number, align: 'left' | 'center' | 'right' | undefined): number {
    return align === 'center' ? x + w / 2 : align === 'right' ? x + w - pad : x + pad;
  }

  /** "Page 2 of 5" at the foot of every page, once all are drawn. */
  pageNumbers(text: (page: number, pages: number) => string): void {
    const pages = this.s.pageCount();
    for (let p = 1; p <= pages; p++) {
      this.s.goToPage(p);
      this.s.text(text(p, pages), this.s.pageWidth / 2, this.s.pageHeight - 20, { size: 8, color: COLORS.soft, align: 'center' });
    }
  }
}
