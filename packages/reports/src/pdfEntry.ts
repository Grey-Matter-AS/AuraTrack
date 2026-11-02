import { drawJob, jobOrientation, type ReportJob } from './job';
import { createJsPdfSurface } from './pdf/jspdf';

export { createJsPdfSurface };

/** The PDF file as bytes. Loads jsPDF, so it is imported only where the file is made (the report worker). */
export function makePdf(job: ReportJob): Uint8Array {
  const surface = createJsPdfSurface(jobOrientation(job));
  drawJob(job, surface);
  return surface.output();
}
