import { APP_VERSION } from '../version';
import {
  ADDITION_KEYS,
  NO_ADDITIONS,
  buildAdditions,
  buildCsv,
  buildDiary,
  buildEegDiary,
  buildEventLog,
  buildNeurologistReport,
  type Additions,
  type ReportContext,
  type ReportJob,
} from '@auratrack/reports';
import { dateStamp, effectiveFactors, endOfLocalDay, startOfLocalDay, type WellbeingEntry } from '@auratrack/model';
import { useMemo } from 'react';
import { useApp } from '../app/AppContext';
import { useRecordList } from '../app/records';

// From the app's records to a report: the choices on the Reports screen become a report job (data for the drawing) or CSV text.

export type ReportKind = 'neurologist' | 'eventLog' | 'diary' | 'eeg' | 'csv';

export interface ReportRequest {
  kind: ReportKind;
  /** Local days, 'YYYY-MM-DD': the first and last day of the period. */
  from: string;
  to: string;
  /** The month of the diary, 'YYYY-MM'. */
  month: string;
  /** The EEG session of the EEG diary. */
  sessionId: string;
  /** The sections added in version 7 that are switched on (the neurologist report). */
  additions: Additions;
}

export { NO_ADDITIONS, ADDITION_KEYS };

export type MadeReport =
  | { type: 'pdf'; job: ReportJob; fileName: string; landscape: boolean }
  | { type: 'csv'; text: string; fileName: string };

export const dayStart = (key: string): number => {
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number);
  return startOfLocalDay(new Date(y, m - 1, d));
};

export const FILE_NAMES: Record<ReportKind, string> = {
  neurologist: 'auratrack-neurologist-report',
  eventLog: 'auratrack-event-log',
  diary: 'auratrack-seizure-diary',
  eeg: 'auratrack-eeg-diary',
  csv: 'auratrack-export',
};

export function useReportMaker(): (request: ReportRequest) => MadeReport | null {
  const app = useApp();
  const wellbeing = useRecordList<WellbeingEntry>('wellbeingEntry');
  const { patient, seizures, medications, medChanges, doseLogs, between, eegSessions, eegActivities, settings, language, label, t, fmt } = app;
  return useMemo(() => {
    return (request: ReportRequest): MadeReport | null => {
      if (!patient) return null;
      const now = app.controller.now();
      const ctx: ReportContext = {
        t,
        label,
        language,
        fmt: { date: fmt.date, dayMonth: fmt.dayMonth, longDate: fmt.longDate, time: fmt.time, timeSec: fmt.timeSec, duration: fmt.duration },
        now,
        appVersion: APP_VERSION,
      };
      const from = dayStart(request.from);
      const to = endOfLocalDay(dayStart(request.to));
      const stamp = dateStamp(now);
      if (request.kind === 'neurologist') {
        const input = {
            patient,
            carerName: settings.carerIsContact ? patient.emergencyContact : settings.carerName,
            carerPhone: settings.carerIsContact ? patient.emergencyPhone : settings.carerPhone,
            recordedBy: settings.recordedBy,
            neurologist: { name: settings.neurologistName, institution: settings.neurologistInstitution, contact: settings.neurologistContact },
            includeDateOfBirth: settings.reportIncludeDateOfBirth,
            reportNotes: settings.reportNotes,
            plan: settings.plan,
            from,
            to,
            seizures,
            medications,
            changes: medChanges,
            doses: doseLogs,
            wellbeing,
            wellbeingEnabled: settings.wellbeingEnabled,
            factorDefs: effectiveFactors(settings.wellbeingFactors),
            between,
          };
        const model = buildNeurologistReport(input, ctx);
        const extra = ADDITION_KEYS.some((k) => k !== 'trueScale' && request.additions[k]);
        const additions = extra ? buildAdditions(input, model, ctx, request.additions) : undefined;
        return {
          type: 'pdf',
          landscape: false,
          fileName: `${FILE_NAMES.neurologist}-${stamp}.pdf`,
          job: { kind: 'neurologist', language, model, alertSeconds: settings.plan.alertSec, additions },
        };
      }
      if (request.kind === 'eventLog') {
        const model = buildEventLog({ seizures, changes: medChanges, from, to }, ctx);
        return { type: 'pdf', landscape: false, fileName: `${FILE_NAMES.eventLog}-${stamp}.pdf`, job: { kind: 'eventLog', language, model } };
      }
      if (request.kind === 'diary') {
        const [year = 0, month = 1] = request.month.split('-').map(Number);
        const model = buildDiary({ patient, seizures, medications, changes: medChanges, year, month }, ctx);
        return { type: 'pdf', landscape: true, fileName: `${FILE_NAMES.diary}-${request.month}.pdf`, job: { kind: 'diary', language, model } };
      }
      if (request.kind === 'eeg') {
        const session = eegSessions.find((s) => s.id === request.sessionId) ?? null;
        const model = buildEegDiary({ session, activities: eegActivities.filter((a) => a.sessionId === session?.id), seizures }, ctx);
        return { type: 'pdf', landscape: false, fileName: `${FILE_NAMES.eeg}-${stamp}.pdf`, job: { kind: 'eeg', language, model } };
      }
      const text = buildCsv({
        seizures,
        between,
        medications,
        doses: doseLogs,
        changes: medChanges,
        wellbeing: settings.wellbeingEnabled ? wellbeing : [],
        eegSessions: settings.eegEnabled ? eegSessions : [],
        eegActivities: settings.eegEnabled ? eegActivities : [],
        from,
        to,
        label,
      });
      return { type: 'csv', text, fileName: `${FILE_NAMES.csv}-${stamp}.csv` };
    };
  }, [app.controller, patient, seizures, medications, medChanges, doseLogs, between, eegSessions, eegActivities, settings, language, label, t, fmt, wellbeing]);
}
