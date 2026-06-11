import { formatCSVField, formatCSVRow } from './formatters';
import { buildEventLogData, buildNeurologistReportData, buildSeizureDiaryData, buildEegDiaryReportData } from '../reports/builders';
import { renderEventLogHtml, renderNeurologistReportHtml, renderSeizureDiaryHtml, renderEegDiaryHtml } from '../reports/htmlRenderers';
import { downloadEventLogPdf, downloadNeurologistReportPdf, downloadSeizureDiaryPdf, downloadEegDiaryPdf } from '../reports/pdfRenderers';
import { buildCanonicalBackupPayload } from './importSanitizer';

export const filterEventsByDateRange = (events, fromDateStr, toDateStr) => {
  const from = fromDateStr ? new Date(fromDateStr).setHours(0, 0, 0, 0) : 0;
  const to = toDateStr ? new Date(toDateStr).setHours(23, 59, 59, 999) : Date.now();
  return events.filter(event => event.startTime >= from && event.startTime <= to);
};

export const exportToJSON = async (
  eventsOrSnapshot,
  medications = [],
  medicationLogs = [],
  eegSessions = [],
  eegActivities = [],
  settings = {}
) => {
  const payload = Array.isArray(eventsOrSnapshot)
    ? buildCanonicalBackupPayload({
        settings,
        events: eventsOrSnapshot,
        medications,
        medicationLogs,
        eegSessions,
        eegActivities,
      })
    : buildCanonicalBackupPayload(eventsOrSnapshot || {});
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  return saveFileNative(blob, `auratrack-backup-${dateStamp()}.json`, 'AuraTrack Backup', ['.json']);
};

export const exportToCSV = async (events, medications = [], medicationLogs = [], eegSessions = [], eegActivities = []) => {
  const header = 'id,date,time,type,duration,notes,postIctalFindings,postIctalParalysisLocations';
  const rows = events.map(formatCSVRow).join('\n');

  let csv = `${header}\n${rows}`;

  if (medications.length > 0) {
    csv += '\n\nMEDICATIONS\nid,name,dose,unit,frequency,scheduledTimes,isRescue,reminderEnabled,showInEmergency,active\n';
    csv += medications.map(medication =>
      [
        medication.id,
        medication.name,
        medication.dose,
        medication.unit,
        medication.frequency,
        (medication.scheduledTimes || []).join('|'),
        medication.isRescue ? 1 : 0,
        medication.reminderEnabled ? 1 : 0,
        medication.showInEmergency ? 1 : 0,
        medication.active ? 1 : 0,
      ].map(formatCSVField).join(',')
    ).join('\n');
  }

  if (medicationLogs.length > 0) {
    csv += '\n\nMEDICATION_LOGS\nid,medicationId,takenAt,scheduledTime,status,note,isEdited\n';
    csv += medicationLogs.map(log =>
      [
        log.id,
        log.medicationId,
        log.takenAt,
        log.scheduledTime ?? '',
        log.status ?? '',
        log.note ?? '',
        log.isEdited ? 1 : 0,
      ].map(formatCSVField).join(',')
    ).join('\n');
  }

  if (eegSessions.length > 0) {
    csv += '\n\nEEG_SESSIONS\nid,startTime,plannedEndTime,actualEndTime,durationPreset,title,status,notes\n';
    csv += eegSessions.map(session =>
      [
        session.id,
        session.startTime,
        session.plannedEndTime ?? '',
        session.actualEndTime ?? '',
        session.durationPreset ?? '',
        session.title ?? '',
        session.status ?? '',
        session.notes ?? '',
      ].map(formatCSVField).join(',')
    ).join('\n');
  }

  if (eegActivities.length > 0) {
    csv += '\n\nEEG_ACTIVITIES\nid,sessionId,kind,activityLabel,customActivityText,moodLabel,startTime,endTime,durationSec,linkedEventId,notes\n';
    csv += eegActivities.map(activity =>
      [
        activity.id,
        activity.sessionId,
        activity.kind ?? '',
        activity.activityLabel ?? '',
        activity.customActivityText ?? '',
        activity.moodLabel ?? '',
        activity.startTime,
        activity.endTime ?? '',
        activity.durationSec ?? 0,
        activity.linkedEventId ?? '',
        activity.notes ?? '',
      ].map(formatCSVField).join(',')
    ).join('\n');
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  return saveFileNative(blob, `auratrack-events-${dateStamp()}.csv`, 'AuraTrack CSV Export', ['.csv']);
};

export const buildEventTablePreview = (events) => renderEventLogHtml(buildEventLogData(events));

export const buildNeurologistReportPreview = (events, settings = {}, medications = [], medicationLogs = [], reportRange = {}) =>
  renderNeurologistReportHtml(buildNeurologistReportData(events, settings, medications, medicationLogs, reportRange));

export const buildSeizureDiaryPreview = (allEvents, settings = {}, medications = [], month, year) =>
  renderSeizureDiaryHtml(buildSeizureDiaryData(allEvents, settings, medications, month, year));

export const exportEventLogPDF = async (events) => downloadEventLogPdf(buildEventLogData(events));

export const exportNeurologistReportPDF = async (events, settings = {}, medications = [], medicationLogs = [], reportRange = {}) =>
  downloadNeurologistReportPdf(buildNeurologistReportData(events, settings, medications, medicationLogs, reportRange));

export const exportSeizureDiaryPDF = async (allEvents, settings = {}, medications = [], month, year) =>
  downloadSeizureDiaryPdf(buildSeizureDiaryData(allEvents, settings, medications, month, year));

export const buildEegDiaryPreview = (session, activities = []) =>
  renderEegDiaryHtml(buildEegDiaryReportData(session, activities));

export const exportEegDiaryPDF = async (session, activities = []) =>
  downloadEegDiaryPdf(buildEegDiaryReportData(session, activities));

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

async function saveFileNative(blob, suggestedName, description, extensions) {
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept: { [blob.type]: extensions } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, cancelled: false };
    } catch (error) {
      if (error.name === 'AbortError') return { ok: false, cancelled: true };
    }
  }
  triggerDownload(blob, suggestedName);
  return { ok: true, cancelled: false };
}
