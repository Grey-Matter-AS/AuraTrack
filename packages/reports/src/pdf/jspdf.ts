import { jsPDF } from 'jspdf';
import { pdfSafe, type Color, type LineOptions, type RectOptions, type Surface, type TextOptions } from './surface';

// The real surface: a jsPDF document, A4, in points. Everything is vector (text stays text, charts are lines and shapes), apart from the logo.

const INK: Color = [17, 24, 39];
const LINE_HEIGHT = 1.15;

export function createJsPdfSurface(orientation: 'portrait' | 'landscape' = 'portrait'): Surface {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation, compress: true });
  const style = (o: TextOptions) => {
    doc.setFont(o.mono ? 'courier' : 'helvetica', o.bold && o.italic ? 'bolditalic' : o.bold ? 'bold' : o.italic ? 'italic' : 'normal');
    doc.setFontSize(o.size ?? 10);
  };
  return {
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
    pageNumber: () => doc.getCurrentPageInfo().pageNumber,
    pageCount: () => doc.getNumberOfPages(),
    addPage: () => void doc.addPage(),
    goToPage: (n) => void doc.setPage(n),
    text(lines, x, y, o = {}) {
      style(o);
      doc.setTextColor(...(o.color ?? INK));
      doc.setLineHeightFactor(LINE_HEIGHT);
      const safe = typeof lines === 'string' ? pdfSafe(lines) : lines.map(pdfSafe);
      doc.text(safe as string | string[], x, y, { align: o.align ?? 'left' });
    },
    wrap(text, width, o = {}) {
      style(o);
      return doc.splitTextToSize(pdfSafe(text), width) as string[];
    },
    width(text, o = {}) {
      style(o);
      return doc.getTextWidth(pdfSafe(text));
    },
    rect(x, y, w, h, o: RectOptions = {}) {
      if (o.fill) doc.setFillColor(...o.fill);
      if (o.stroke) doc.setDrawColor(...o.stroke);
      doc.setLineWidth(o.lineWidth ?? 0.6);
      const mode = o.fill && o.stroke ? 'FD' : o.fill ? 'F' : 'S';
      if (o.radius) doc.roundedRect(x, y, w, h, o.radius, o.radius, mode);
      else doc.rect(x, y, w, h, mode);
    },
    line(x1, y1, x2, y2, o: LineOptions = {}) {
      doc.setDrawColor(...(o.color ?? INK));
      doc.setLineWidth(o.width ?? 0.6);
      doc.setLineDashPattern(o.dash ? [...o.dash] : [], 0);
      doc.line(x1, y1, x2, y2);
      doc.setLineDashPattern([], 0);
    },
    polyline(points, o: LineOptions = {}) {
      if (points.length < 2) return;
      doc.setDrawColor(...(o.color ?? INK));
      doc.setLineWidth(o.width ?? 0.8);
      const [first, ...rest] = points;
      if (!first) return;
      let px = first[0];
      let py = first[1];
      const steps = rest.map(([x, y]) => {
        const step: [number, number] = [x - px, y - py];
        px = x;
        py = y;
        return step;
      });
      doc.lines(steps, first[0], first[1], [1, 1], 'S', false);
    },
    circle(x, y, r, o = {}) {
      if (o.fill) doc.setFillColor(...o.fill);
      if (o.stroke) doc.setDrawColor(...o.stroke);
      doc.setLineWidth(o.lineWidth ?? 0.6);
      doc.circle(x, y, r, o.fill && o.stroke ? 'FD' : o.fill ? 'F' : 'S');
    },
    image: (png, x, y, w, h) => void doc.addImage(png, 'PNG', x, y, w, h),
    output: () => new Uint8Array(doc.output('arraybuffer')),
  };
}
