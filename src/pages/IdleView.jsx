import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EventCard } from '../components/EventCard';
import { MedicationDosePanel } from '../components/MedicationDosePanel';
import { buildDangerMap } from '../utils/dangerFlags';
import { ScrollFade } from '../components/ScrollFade';

export default function IdleView({
  history,
  fullHistory,
  onStart,
  onManualEntry,
  onEdit,
  onDelete,
  onViewDetail,
  medicationGroups,
  allActiveMedications,
  onSaveDoses,
  durationFormat = 'seconds',
  dateFormat = 'locale',
  timeFormat = '12h',
}) {
  const { t } = useTranslation();
  const dangerMap = useMemo(() => buildDangerMap(fullHistory?.length ? fullHistory : history), [fullHistory, history]);
  const hasMedications = Object.keys(medicationGroups ?? {}).length > 0 || (allActiveMedications?.length ?? 0) > 0;

  return (
    <div className="flex-1 flex flex-col items-center w-full max-w-md sm:max-w-xl md:max-w-2xl overflow-hidden">

      {/* Zone 1: START button — viewport-relative size, decoupled from font-size scaling */}
      <div className="py-3 sm:py-6 shrink-0 flex flex-col items-center gap-4">
        <button
          onClick={onStart}
          className="bg-red-600 active:scale-95 active:bg-red-500 transition-all rounded-full shadow-[0_0_60px_rgba(225,29,72,0.4)] flex items-center justify-center text-white font-black ring-4 ring-red-900/20"
          style={{
            width: 'min(15rem, 38vmin)',
            height: 'min(15rem, 38vmin)',
            fontSize: 'min(2.25rem, 8vmin)',
            borderWidth: 'min(12px, 2vmin)',
            borderStyle: 'solid',
            borderColor: '#1e293b',
          }}
        >
          {t('idle.start')}
        </button>
        {onManualEntry && (
          <button
            onClick={onManualEntry}
            className="text-[10px] font-black uppercase tracking-widest active:opacity-50 transition-opacity"
            style={{ color: 'var(--text-faint)' }}
          >
            {t('idle.log_past')}
          </button>
        )}
      </div>

      {/* Zone 2: medication panel + recent events — unified scrollable section */}
      <div className="w-full flex-1 min-h-0 flex flex-col overflow-hidden">
        <ScrollFade className="space-y-3" wrapperClassName="flex-1">
          {hasMedications && (
            <MedicationDosePanel
              medicationGroups={medicationGroups}
              allActiveMedications={allActiveMedications ?? []}
              onSaveDoses={onSaveDoses}
            />
          )}

          <div className="flex justify-between items-center mb-1 px-2">
            <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{t('idle.recent_events')}</h3>
            {history.length > 0 && (
              <span className="text-[9px] text-slate-600 font-bold bg-slate-900 px-2 py-1 rounded">{t('idle.last_5')}</span>
            )}
          </div>

          {history.length === 0 ? (
            <div className="border-2 border-dashed border-slate-800 rounded-3xl py-8 text-center">
              <p className="text-slate-600 italic text-sm">{t('idle.no_events')}</p>
            </div>
          ) : (
            history.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onEdit={onEdit}
                onDelete={onDelete}
                onViewDetail={onViewDetail}
                dangerFlags={dangerMap[event.id]}
                durationFormat={durationFormat}
                dateFormat={dateFormat}
                timeFormat={timeFormat}
              />
            ))
          )}
        </ScrollFade>
      </div>
    </div>
  );
}
