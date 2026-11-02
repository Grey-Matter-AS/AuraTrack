import { pdfSafe, type Color, type LineOptions, type RectOptions, type Surface, type TextOptions } from '@auratrack/reports';

// A surface that draws the report's pages on canvases, for the print preview. The same layout code draws the PDF, so what
// is shown is what is saved; Arial and Helvetica have the same letter widths, so lines break in the same places.

const LINE_HEIGHT = 1.15;
const INK: Color = [17, 24, 39];
const css = (c: Color, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;

export class CanvasSurface implements Surface {
  readonly pageWidth: number;
  readonly pageHeight: number;
  readonly pages: HTMLCanvasElement[] = [];
  private current = 0;
  private readonly measure = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;

  constructor(
    private readonly scale = 1.5,
    landscape = false,
  ) {
    this.pageWidth = landscape ? 841.89 : 595.28;
    this.pageHeight = landscape ? 595.28 : 841.89;
    this.addPage();
  }

  private ctx(): CanvasRenderingContext2D {
    const canvas = this.pages[this.current] as HTMLCanvasElement;
    return canvas.getContext('2d') as CanvasRenderingContext2D;
  }
  private font(c: CanvasRenderingContext2D, o: TextOptions) {
    c.font = `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${o.size ?? 10}px Helvetica, Arial, sans-serif`;
  }

  pageNumber = () => this.current + 1;
  pageCount = () => this.pages.length;
  addPage(): void {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(this.pageWidth * this.scale);
    canvas.height = Math.round(this.pageHeight * this.scale);
    const c = canvas.getContext('2d') as CanvasRenderingContext2D;
    c.scale(this.scale, this.scale);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, this.pageWidth, this.pageHeight);
    this.pages.push(canvas);
    this.current = this.pages.length - 1;
  }
  goToPage(n: number): void {
    this.current = Math.min(this.pages.length - 1, Math.max(0, n - 1));
  }
  width(text: string, o: TextOptions = {}): number {
    this.font(this.measure, o);
    return this.measure.measureText(pdfSafe(text)).width;
  }
  wrap(text: string, width: number, o: TextOptions = {}): string[] {
    this.font(this.measure, o);
    const out: string[] = [];
    for (const paragraph of pdfSafe(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        let w = word;
        while (this.measure.measureText(w).width > width && w.length > 1) {
          let cut = w.length - 1;
          while (cut > 1 && this.measure.measureText(w.slice(0, cut)).width > width) cut -= 1;
          if (line) {
            out.push(line);
            line = '';
          }
          out.push(w.slice(0, cut));
          w = w.slice(cut);
        }
        const next = line === '' ? w : `${line} ${w}`;
        if (line !== '' && this.measure.measureText(next).width > width) {
          out.push(line);
          line = w;
        } else line = next;
      }
      out.push(line);
    }
    return out;
  }
  text(lines: string | readonly string[], x: number, y: number, o: TextOptions = {}): void {
    const c = this.ctx();
    this.font(c, o);
    c.fillStyle = css(o.color ?? INK);
    c.textAlign = o.align ?? 'left';
    c.textBaseline = 'alphabetic';
    const list = typeof lines === 'string' ? [lines] : lines;
    list.forEach((line, i) => c.fillText(pdfSafe(line), x, y + i * (o.size ?? 10) * LINE_HEIGHT));
  }
  rect(x: number, y: number, w: number, h: number, o: RectOptions = {}): void {
    const c = this.ctx();
    c.beginPath();
    if (o.radius && 'roundRect' in c) c.roundRect(x, y, w, h, o.radius);
    else c.rect(x, y, w, h);
    if (o.fill) {
      c.fillStyle = css(o.fill);
      c.fill();
    }
    if (o.stroke) {
      c.strokeStyle = css(o.stroke);
      c.lineWidth = o.lineWidth ?? 0.6;
      c.stroke();
    }
  }
  line(x1: number, y1: number, x2: number, y2: number, o: LineOptions = {}): void {
    const c = this.ctx();
    c.beginPath();
    c.setLineDash(o.dash ? [...o.dash] : []);
    c.strokeStyle = css(o.color ?? INK);
    c.lineWidth = o.width ?? 0.6;
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.setLineDash([]);
  }
  polyline(points: readonly (readonly [number, number])[], o: LineOptions = {}): void {
    const c = this.ctx();
    c.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
    c.strokeStyle = css(o.color ?? INK);
    c.lineWidth = o.width ?? 0.8;
    c.stroke();
  }
  circle(x: number, y: number, r: number, o: { fill?: Color; stroke?: Color; lineWidth?: number } = {}): void {
    const c = this.ctx();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (o.fill) {
      c.fillStyle = css(o.fill);
      c.fill();
    }
    if (o.stroke) {
      c.strokeStyle = css(o.stroke);
      c.lineWidth = o.lineWidth ?? 0.6;
      c.stroke();
    }
  }
  output(): Uint8Array {
    return new Uint8Array(0);
  }
}
