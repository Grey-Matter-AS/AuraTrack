// A page to draw on. The reports are drawn through this, never straight on jsPDF, so the layout can be tested without
// making a file: RecordingSurface remembers every mark, and a test can ask what was written and where. All sizes are points.

export type Color = readonly [number, number, number];

export interface TextOptions {
  size?: number | undefined;
  bold?: boolean | undefined;
  italic?: boolean | undefined;
  /** A typewriter face, for codes. */
  mono?: boolean | undefined;
  color?: Color | undefined;
  align?: 'left' | 'center' | 'right' | undefined;
}
export interface RectOptions {
  fill?: Color;
  stroke?: Color;
  lineWidth?: number;
  radius?: number;
}
export interface LineOptions {
  color?: Color;
  width?: number;
  dash?: readonly number[];
}

export interface Surface {
  readonly pageWidth: number;
  readonly pageHeight: number;
  /** The page being drawn on, from 1. */
  pageNumber(): number;
  pageCount(): number;
  addPage(): void;
  goToPage(n: number): void;
  /** `y` is the baseline of the first line; further lines follow at the font's line height. */
  text(lines: string | readonly string[], x: number, y: number, options?: TextOptions): void;
  /** The text broken into lines no wider than `width` at this size. */
  wrap(text: string, width: number, options?: TextOptions): string[];
  /** The width of one line of text. */
  width(text: string, options?: TextOptions): number;
  rect(x: number, y: number, w: number, h: number, options?: RectOptions): void;
  line(x1: number, y1: number, x2: number, y2: number, options?: LineOptions): void;
  polyline(points: readonly (readonly [number, number])[], options?: LineOptions): void;
  circle(x: number, y: number, r: number, options?: { fill?: Color; stroke?: Color; lineWidth?: number }): void;
  output(): Uint8Array;
}

/**
 * jsPDF's own fonts hold the Latin-1 letters (every language of the app) but not arrows, bullets, stars or curly quotes, which
 * would print as wrong letters. Those are written with plain look-alikes; anything else outside Latin-1 becomes "?".
 */
export function pdfSafe(text: string): string {
  const map: Record<string, string> = {
    '→': '->',
    '←': '<-',
    '–': '-',
    '—': '-',
    '≥': '>=',
    '≤': '<=',
    '★': '*',
    '•': '-',
    '’': "'",
    '‘': "'",
    '“': '"',
    '”': '"',
    '…': '...',
    '×': 'x',
    ' ': ' ',
    ' ': ' ',
    ' ': ' ',
  };
  let out = '';
  for (const ch of text) {
    const mapped = map[ch];
    if (mapped !== undefined) out += mapped;
    else if (ch === '\n' || ch === '\t' || (ch >= ' ' && ch <= '~') || (ch >= '¡' && ch <= 'ÿ')) out += ch;
    else out += '?';
  }
  return out;
}

export type Mark =
  | { kind: 'text'; page: number; lines: string[]; x: number; y: number; size: number; align: 'left' | 'center' | 'right'; width: number }
  | { kind: 'rect'; page: number; x: number; y: number; w: number; h: number }
  | { kind: 'line'; page: number; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'circle'; page: number; x: number; y: number; r: number }
  | { kind: 'polyline'; page: number; points: [number, number][] };

/** A surface that draws nothing and keeps a list of what was drawn: for tests. Text is measured at 0.5 of the size per letter. */
export class RecordingSurface implements Surface {
  readonly marks: Mark[] = [];
  private page = 1;
  private total = 1;
  constructor(
    readonly pageWidth = 595.28,
    readonly pageHeight = 841.89,
  ) {}
  pageNumber = () => this.page;
  pageCount = () => this.total;
  addPage(): void {
    this.total += 1;
    this.page = this.total;
  }
  goToPage(n: number): void {
    this.page = Math.min(this.total, Math.max(1, n));
  }
  width(text: string, options: TextOptions = {}): number {
    return pdfSafe(text).length * (options.size ?? 10) * 0.5;
  }
  wrap(text: string, width: number, options: TextOptions = {}): string[] {
    const per = Math.max(1, Math.floor(width / ((options.size ?? 10) * 0.5)));
    const out: string[] = [];
    for (const paragraph of pdfSafe(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        let w = word;
        while (w.length > per) {
          if (line) {
            out.push(line);
            line = '';
          }
          out.push(w.slice(0, per));
          w = w.slice(per);
        }
        if (line === '') line = w;
        else if ((line + ' ' + w).length <= per) line += ' ' + w;
        else {
          out.push(line);
          line = w;
        }
      }
      out.push(line);
    }
    return out;
  }
  text(lines: string | readonly string[], x: number, y: number, options: TextOptions = {}): void {
    const list = (typeof lines === 'string' ? [lines] : [...lines]).map(pdfSafe);
    const size = options.size ?? 10;
    const width = Math.max(0, ...list.map((l) => this.width(l, options)));
    this.marks.push({ kind: 'text', page: this.page, lines: list, x, y, size, align: options.align ?? 'left', width });
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.marks.push({ kind: 'rect', page: this.page, x, y, w, h });
  }
  line(x1: number, y1: number, x2: number, y2: number): void {
    this.marks.push({ kind: 'line', page: this.page, x1, y1, x2, y2 });
  }
  polyline(points: readonly (readonly [number, number])[]): void {
    this.marks.push({ kind: 'polyline', page: this.page, points: points.map((p) => [p[0], p[1]] as [number, number]) });
  }
  circle(x: number, y: number, r: number): void {
    this.marks.push({ kind: 'circle', page: this.page, x, y, r });
  }
  output(): Uint8Array {
    return new Uint8Array(0);
  }

  /** All the text on the pages, one line per line, in the order drawn. */
  texts(): string[] {
    return this.marks.flatMap((m) => (m.kind === 'text' ? m.lines : []));
  }
  /** Marks that run outside the page (or into its margin of `margin` points), described for a failure message. */
  outside(margin = 0): string[] {
    const bad: string[] = [];
    const inside = (page: number, x1: number, y1: number, x2: number, y2: number, what: string) => {
      if (x1 < margin - 0.01 || y1 < margin - 0.01 || x2 > this.pageWidth - margin + 0.01 || y2 > this.pageHeight - margin + 0.01)
        bad.push(`page ${page}: ${what} (${Math.round(x1)},${Math.round(y1)})-(${Math.round(x2)},${Math.round(y2)})`);
    };
    for (const m of this.marks) {
      if (m.kind === 'text') {
        const x1 = m.align === 'left' ? m.x : m.align === 'center' ? m.x - m.width / 2 : m.x - m.width;
        const lines = m.lines.length;
        inside(m.page, x1, m.y - m.size, x1 + m.width, m.y + (lines - 1) * m.size * 1.15, `"${(m.lines[0] ?? '').slice(0, 30)}"`);
      } else if (m.kind === 'rect') inside(m.page, m.x, m.y, m.x + m.w, m.y + m.h, 'rect');
      else if (m.kind === 'line') inside(m.page, Math.min(m.x1, m.x2), Math.min(m.y1, m.y2), Math.max(m.x1, m.x2), Math.max(m.y1, m.y2), 'line');
      else if (m.kind === 'circle') inside(m.page, m.x - m.r, m.y - m.r, m.x + m.r, m.y + m.r, 'circle');
      else for (const [x, y] of m.points) inside(m.page, x, y, x, y, 'point');
    }
    return bad;
  }
}
