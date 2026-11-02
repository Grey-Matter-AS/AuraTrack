import { message, type Language, type MessageKey, type MessageParams } from '@auratrack/i18n';
import type { AdditionsData } from './additions';
import type { NeurologistReport } from './neurologist';
import type { DiaryReport, EegReport, EventLogReport } from './others';
import { renderDiary, renderEeg, renderEventLog, renderNeurologist, renderRecoveryKit, type RecoveryKitReport } from './pdf/render';
import type { Surface } from './pdf/surface';

// A report ready to be drawn: plain data, so it can be sent to a worker. The words are looked up when it is drawn, in the
// language it carries.

export type ReportJob =
  | { kind: 'neurologist'; language: Language; model: NeurologistReport; alertSeconds: number; additions?: AdditionsData | undefined }
  | { kind: 'eventLog'; language: Language; model: EventLogReport }
  | { kind: 'diary'; language: Language; model: DiaryReport }
  | { kind: 'eeg'; language: Language; model: EegReport }
  | { kind: 'recoveryKit'; language: Language; model: RecoveryKitReport };

export const jobOrientation = (job: ReportJob): 'portrait' | 'landscape' => (job.kind === 'diary' ? 'landscape' : 'portrait');

/** Draws the report on a surface (a PDF, or the canvases of the print preview). */
export function drawJob(job: ReportJob, surface: Surface): void {
  const t = (key: MessageKey, params?: MessageParams) => message(job.language, key, params);
  if (job.kind === 'neurologist') renderNeurologist(job.model, t, surface, { alertSeconds: job.alertSeconds, additions: job.additions });
  else if (job.kind === 'eventLog') renderEventLog(job.model, t, surface);
  else if (job.kind === 'diary') renderDiary(job.model, t, surface);
  else if (job.kind === 'eeg') renderEeg(job.model, t, surface);
  else renderRecoveryKit(job.model, t, surface);
}
