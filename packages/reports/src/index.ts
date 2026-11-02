// @auratrack/reports: the reports as data (build*), drawn through a surface (render*, drawJob), and the CSV export. The PDF file
// itself comes from '@auratrack/reports/pdf', which loads jsPDF: only the report worker imports that.
export * from './additions';
export * from './context';
export * from './csv';
export * from './job';
export * from './neurologist';
export * from './others';
export { renderDiary, renderEeg, renderEventLog, renderNeurologist, renderRecoveryKit, type RecoveryKitReport } from './pdf/render';
export {
  RecordingSurface,
  pdfSafe,
  type Color,
  type LineOptions,
  type RectOptions,
  type Surface,
  type TextOptions,
} from './pdf/surface';
