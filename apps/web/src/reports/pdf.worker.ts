import type { ReportJob } from '@auratrack/reports';
import { makePdf } from '@auratrack/reports/pdf';

// Makes the PDF off the page's thread, so the screen never stalls while a long report is drawn. jsPDF is loaded only here.
self.onmessage = (event: MessageEvent<ReportJob>) => {
  try {
    const bytes = makePdf(event.data);
    (self as unknown as Worker).postMessage({ ok: true, bytes }, [bytes.buffer]);
  } catch (e) {
    (self as unknown as Worker).postMessage({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
};
