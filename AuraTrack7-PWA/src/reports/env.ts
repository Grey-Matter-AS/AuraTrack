import { CanvasSurface } from './canvasSurface';
import type { Surface } from '@auratrack/reports';
import type { ReportJob } from '@auratrack/reports';

// What the report screens need from the browser, in one place so the tests can give fakes: the pages for the preview, making the
// PDF, and handing a file to the person (save, share). In tests there is no canvas and no worker.

export interface PreviewSurface extends Surface {
  readonly pages: readonly HTMLCanvasElement[];
}

export interface ReportsEnv {
  previewSurface(landscape: boolean): PreviewSurface;
  /** The PDF file, made in a worker. */
  makePdf(job: ReportJob): Promise<Uint8Array>;
  /** Saves a file through the system dialog where the browser has one, otherwise as a download. */
  save(bytes: Uint8Array | string, fileName: string, mime: string): Promise<'saved' | 'cancelled'>;
  /** Can the browser share a file (the share sheet)? */
  canShare(fileName: string, mime: string): boolean;
  share(bytes: Uint8Array, fileName: string, mime: string): Promise<'shared' | 'cancelled'>;
}

function makePdfInWorker(job: ReportJob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }>) => {
      worker.terminate();
      if (e.data.ok) resolve(e.data.bytes);
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage(job);
  });
}

const asBlob = (bytes: Uint8Array | string, mime: string) => new Blob([bytes as BlobPart], { type: mime });

async function save(bytes: Uint8Array | string, fileName: string, mime: string): Promise<'saved' | 'cancelled'> {
  const picker = (window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: fileName, types: [{ description: fileName, accept: { [mime]: [`.${fileName.split('.').pop()}`] } }] });
      const writable = await handle.createWritable();
      await writable.write(asBlob(bytes, mime));
      await writable.close();
      return 'saved';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // any other trouble: fall back to a download below
    }
  }
  const url = URL.createObjectURL(asBlob(bytes, mime));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}

export const reportsEnv: ReportsEnv = {
  previewSurface: (landscape) => new CanvasSurface(1.5, landscape),
  makePdf: makePdfInWorker,
  save,
  canShare: (fileName, mime) => {
    try {
      const file = new File([new Uint8Array(1)], fileName, { type: mime });
      return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  },
  share: async (bytes, fileName, mime) => {
    try {
      await navigator.share({ files: [new File([bytes as BlobPart], fileName, { type: mime })], title: fileName });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      throw e;
    }
  },
};
