import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../data/db';
import { formatDuration, formatEventDate, formatEventTime } from '../utils/formatters';
import { ScrollFade } from '../components/ScrollFade';
import { computeDangerFlags } from '../utils/dangerFlags';
import { WarningIcon } from '../components/AppIcons';

const CLUSTER_WINDOW_MS = 8 * 60 * 1000;

function DangerAlert({ dangerFlags }) {
  const { t } = useTranslation();
  const flags = dangerFlags?.flags;
  if (!flags?.length) return null;
  return (
    <div className="space-y-2 mb-2">
      {flags.includes('long_duration') && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl"
          style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)' }}
        >
          <WarningIcon className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-amber-500 font-black text-xs uppercase tracking-widest">{t('event_detail.danger_prolonged_title')}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {t('event_detail.danger_prolonged_desc')}
            </p>
          </div>
        </div>
      )}
      {flags.includes('cluster') && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)' }}
        >
          <WarningIcon className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-red-500 font-black text-xs uppercase tracking-widest">{t('event_detail.danger_cluster_title', { count: dangerFlags.clusterCount })}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {t('event_detail.danger_cluster_desc', { count: dangerFlags.clusterCount })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventDetailView({ eventId, onEdit, onClose, durationFormat = 'seconds', dateFormat = 'locale', timeFormat = '12h' }) {
  const { t } = useTranslation();
  const fmtDur = (s) => durationFormat === 'human' ? formatDuration(s) : `${s}s`;
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [dangerFlags, setDangerFlags] = useState({ flags: [], clusterCount: 0 });

  useEffect(() => {
    if (!eventId) return;
    const resetTimer = setTimeout(() => {
      setNotFound(false);
      setEvent(null);
    }, 0);
    db.events.get(eventId).then(async ev => {
      if (!ev) { setNotFound(true); return; }
      setEvent(ev);
      const nearby = await db.events
        .where('startTime')
        .between(ev.startTime - CLUSTER_WINDOW_MS, ev.startTime + CLUSTER_WINDOW_MS, true, true)
        .toArray();
      setDangerFlags(computeDangerFlags(ev, nearby));
    }).catch(err => {
      console.error('Failed to load event:', err);
      setNotFound(true);
    });
    return () => clearTimeout(resetTimer);
  }, [eventId]);

  if (notFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-sm font-bold" style={{ color: 'var(--text-dim)' }}>{t('event_detail.not_found')}</p>
        <button
          onClick={onClose}
          className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          {t('nav.back')}
        </button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="italic text-sm" style={{ color: 'var(--text-dim)' }}>{t('event_detail.loading')}</p>
      </div>
    );
  }

  const m = event.manualDurations || {};
  const auraDur     = m.aura     ?? (event.laps?.aura ? Math.floor((event.laps.aura - event.startTime) / 1000) : 0);
  const seizureDur  = m.seizure  ?? (event.laps?.aura && event.laps?.seizure  ? Math.floor((event.laps.seizure  - event.laps.aura)    / 1000) : 0);
  const recoveryDur = m.recovery ?? (event.laps?.seizure && event.laps?.recovery ? Math.floor((event.laps.recovery - event.laps.seizure) / 1000) : 0);

  return (
    <div className="flex-1 flex flex-col w-full max-w-md sm:max-w-xl md:max-w-2xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-4 mb-4 shrink-0">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          {t('nav.back')}
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>{t('event_detail.title')}</h2>
        <button
          onClick={() => onEdit(event)}
          className="ml-auto min-h-[40px] px-4 text-[10px] font-bold text-blue-400 border border-blue-900/50 rounded-xl tracking-wider uppercase active:bg-blue-600 active:text-white transition-all"
        >
          {t('event_detail.edit')}
        </button>
      </div>

      <ScrollFade className="space-y-4" wrapperClassName="flex-1">

        <DangerAlert dangerFlags={dangerFlags} />

        {/* Duration Summary */}
        <div
          className="p-6 rounded-[2.5rem] shadow-lg"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: dangerFlags.flags.length ? '1px solid rgba(239,68,68,0.35)' : '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>{t('event_detail.total_duration')}</p>
              <p className="text-4xl font-mono font-black leading-none"
                style={{ color: dangerFlags.flags.includes('long_duration') ? '#f59e0b' : 'var(--text-primary)' }}>
                {fmtDur(event.duration)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>{t('event_detail.type')}</p>
              <p className="text-xs font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>{event.type || t('event_detail.unknown', 'Unknown')}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="text-center">
              <p className="text-[9px] text-amber-500 font-black uppercase mb-1">{t('event_detail.aura')}</p>
              <p className="text-lg font-mono font-black" style={{ color: 'var(--text-primary)' }}>{fmtDur(auraDur)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-red-500 font-black uppercase mb-1">{t('event_detail.seizure')}</p>
              <p className="text-lg font-mono font-black" style={{ color: 'var(--text-primary)' }}>{fmtDur(seizureDur)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-blue-400 font-black uppercase mb-1">{t('event_detail.recovery')}</p>
              <p className="text-lg font-mono font-black" style={{ color: 'var(--text-primary)' }}>{fmtDur(recoveryDur)}</p>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>{t('event_detail.details')}</p>
          <div className="space-y-2 text-sm">
            {[[t('event_detail.date'), formatEventDate(event.startTime, dateFormat)], [t('event_detail.time'), formatEventTime(event.startTime, timeFormat)]].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span style={{ color: 'var(--text-dim)' }}>{k}</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
              {event.eegSessionId && (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-dim)' }}>{t('event_detail.eeg_session', 'EEG session')}</span>
                  <span className="font-medium text-xs uppercase" style={{ color: 'var(--accent)' }}>{t('event_detail.linked', 'Linked')}</span>
                </div>
              )}
              {event.videoAttached && (
                <div className="flex justify-between gap-3">
                  <span style={{ color: 'var(--text-dim)' }}>{t('event_detail.video_file', 'Video file')}</span>
                  <span className="font-medium text-right break-all" style={{ color: 'var(--text-primary)' }}>{event.videoFileName || t('event_detail.saved_to_storage', 'Saved to device storage')}</span>
                </div>
              )}
	            {event.isEdited && (
	              <div className="flex justify-between">
	                <span style={{ color: 'var(--text-dim)' }}>{t('event_detail.status')}</span>
	                <span className="font-medium text-xs uppercase" style={{ color: 'var(--text-secondary)' }}>{t('event_detail.edited')}</span>
	              </div>
	            )}
	            {!event.isComplete && (
	              <div className="flex justify-between">
	                <span style={{ color: 'var(--text-dim)' }}>{t('event_detail.status')}</span>
	                <span className="font-medium text-xs uppercase" style={{ color: 'var(--accent)' }}>{t('event_detail.needs_details', 'Needs details')}</span>
	              </div>
	            )}
	          </div>
	        </div>

        {/* Edit History */}
        {event.editLog?.length > 0 && (
          <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>{t('event_detail.edit_history', 'Edit History')}</p>
            <div className="space-y-2">
              {event.editLog.map((entry, i) => (
                <div key={i} className="flex justify-between items-start text-xs gap-3">
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {new Date(entry.editedAt).toLocaleString()}
                  </span>
                  <span className="text-right font-medium" style={{ color: 'var(--text-faint)' }}>
                    {entry.changedFields?.length
                      ? entry.changedFields.join(', ')
                      : t('event_detail.edit_history_general', 'general update')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Symptoms */}
        {event.symptoms?.length > 0 && (
          <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>{t('event_detail.symptoms')}</p>
            <div className="space-y-3">
              {event.symptoms.map((s, i) => (
                <div key={i} className="pb-3 last:pb-0" style={{ borderBottom: i < event.symptoms.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <p className="text-blue-400 font-black text-sm uppercase tracking-tight leading-none mb-1">{s.symptom}</p>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{s.region} › {s.specificPart}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Triggers */}
        {event.triggers?.length > 0 && (
          <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>{t('event_detail.triggers')}</p>
            <div className="flex flex-wrap gap-2">
              {event.triggers.map(trigger => (
                <span
                  key={trigger}
                  className="px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', border: '1.5px solid color-mix(in srgb, var(--accent) 40%, transparent)' }}
                >
                  {trigger}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Post-ictal findings */}
        {(event.postIctal?.findings?.length > 0 || event.postIctal?.paralysisLocations?.length > 0) && (
          <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
              {t('event_detail.post_ictal', 'After-seizure symptoms')}
            </p>

            {event.postIctal?.findings?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {event.postIctal.findings.map((finding) => (
                  <span
                    key={finding}
                    className="px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wide"
                    style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: '#93c5fd', border: '1.5px solid rgba(96,165,250,0.35)' }}
                  >
                    {finding}
                  </span>
                ))}
              </div>
            )}

            {event.postIctal?.paralysisLocations?.length > 0 && (
              <div className="space-y-2">
                {event.postIctal.paralysisLocations.map((location, index) => (
                  <div key={`${location.region}-${location.subRegion}-${location.specificPart}-${index}`} className="rounded-2xl px-3 py-2" style={{ backgroundColor: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)' }}>
                    <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: '#93c5fd' }}>
                      {t('tagging.todds_paralysis', "Todd's paralysis")}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {location.region} › {location.subRegion} › {location.specificPart}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>{t('event_detail.notes')}</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{event.notes}</p>
          </div>
        )}

        {event.videoAttached && (
          <div className="p-5 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>{t('event_detail.associated_video', 'Associated video')}</p>
            <div className="space-y-2 text-sm">
              <p style={{ color: 'var(--text-primary)' }}>{event.videoFileName || t('event_detail.saved_seizure_video', 'Saved seizure video')}</p>
              {event.videoDurationSec ? (
                <p style={{ color: 'var(--text-dim)' }}>{t('export.docs.duration')}: {fmtDur(event.videoDurationSec)}</p>
              ) : null}
              <p style={{ color: 'var(--text-dim)' }}>
                {t('event_detail.video_saved_hint', 'The file is saved in device storage and referenced here for the neurologist record.')}
              </p>
            </div>
          </div>
        )}

      </ScrollFade>
    </div>
  );
}
