import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDuration, formatEventDate, formatEventTime } from '../utils/formatters';
import { EEG_ACTIVITY_OPTIONS, EEG_MOOD_OPTIONS } from '../data/constants';

const EEG_SESSION_STATUS_STYLES = {
  COMPLETED: {
    backgroundColor: '#16a34a',
    color: '#fff',
    border: '1px solid #15803d',
  },
  ACTIVE: {
    backgroundColor: '#d97706',
    color: '#fff',
    border: '1px solid #b45309',
  },
  ERROR: {
    backgroundColor: '#dc2626',
    color: '#fff',
    border: '1px solid #991b1b',
  },
};

function getEegSessionStatusStyle(status) {
  const normalizedStatus = String(status || '').toUpperCase();

  if (normalizedStatus.includes('ERROR') || normalizedStatus.includes('FAIL')) {
    return EEG_SESSION_STATUS_STYLES.ERROR;
  }

  if (normalizedStatus === 'COMPLETED') {
    return EEG_SESSION_STATUS_STYLES.COMPLETED;
  }

  return EEG_SESSION_STATUS_STYLES.ACTIVE;
}

function ActivityEditor({ activity, onSave, onDelete, onClose }) {
  const { t } = useTranslation();
  const [activityLabel, setActivityLabel] = useState(activity.activityLabel || '');
  const [customActivityText, setCustomActivityText] = useState(activity.customActivityText || '');
  const [moodLabel, setMoodLabel] = useState(activity.moodLabel || '');
  const [notes, setNotes] = useState(activity.notes || '');
  const [startTime, setStartTime] = useState(() => new Date(activity.startTime).toISOString().slice(0, 16));
  const [endTime, setEndTime] = useState(() => activity.endTime ? new Date(activity.endTime).toISOString().slice(0, 16) : '');
  const [durationSec, setDurationSec] = useState(activity.durationSec || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3">
      <div className="w-full max-w-lg rounded-[2rem] p-5 space-y-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
            {activity.kind === 'SEIZURE_REFERENCE' ? t('eeg.edit_seizure_reference', 'EEG Seizure Reference') : t('eeg.edit_activity', 'Edit EEG Activity')}
          </h3>
          <button onClick={onClose} className="app-icon-action app-icon-action--primary !min-h-[36px] !px-3">
            {t('eeg.close', 'Close')}
          </button>
        </div>
        {activity.kind === 'SEIZURE_REFERENCE' ? (
          <div className="space-y-3">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{activity.activityLabel}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {t('eeg.linked_description', 'This entry is linked to the seizure record and keeps its timing from that event.')}
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => onSave({ notes })}
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
                style={{ backgroundColor: '#16a34a', color: '#fff', border: '1px solid #15803d' }}
              >
                {t('eeg.save', 'Save')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <select
              value={activityLabel}
              onChange={e => setActivityLabel(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {EEG_ACTIVITY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <input
              type="text"
              value={customActivityText}
              onChange={e => setCustomActivityText(e.target.value)}
              placeholder={t('eeg.exact_activity_placeholder', 'Exact activity details (optional)')}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <select
              value={moodLabel}
              onChange={e => setMoodLabel(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="">{t('eeg.no_mood', 'No mood')}</option>
              {EEG_MOOD_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="datetime-local"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <input
                type="datetime-local"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>
            <input
              type="number"
              min="0"
              value={durationSec}
              onChange={e => setDurationSec(e.target.value)}
              placeholder={t('eeg.duration_seconds', 'Duration seconds')}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
              style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => onSave({
                  activityLabel,
                  customActivityText,
                  moodLabel,
                  notes,
                  startTime: new Date(startTime).getTime(),
                  endTime: endTime ? new Date(endTime).getTime() : null,
                  durationSec: Number(durationSec || 0),
                })}
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest"
                style={{ backgroundColor: '#16a34a', color: '#fff', border: '1px solid #15803d' }}
              >
                {t('eeg.save', 'Save')}
              </button>
              <button
                onClick={() => onDelete(activity.id)}
                className="app-icon-action app-icon-action--danger"
              >
                {t('eeg.delete', 'Delete')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EEGDiaryTab({
  activeSession,
  getSessions,
  getActivitiesForSession,
  onUpdateActivity,
  onDeleteActivity,
  onEndSession,
}) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [activities, setActivities] = useState([]);
  const [editingActivity, setEditingActivity] = useState(null);

  useEffect(() => {
    getSessions().then(rows => {
      setSessions(rows);
      setSelectedSessionId(current => current || activeSession?.id || rows[0]?.id || null);
    }).catch(err => console.error('Failed to load EEG sessions:', err));
  }, [activeSession?.id, getSessions]);

  useEffect(() => {
    if (!selectedSessionId) return;
    getActivitiesForSession(selectedSessionId)
      .then(setActivities)
      .catch(err => console.error('Failed to load EEG activities:', err));
  }, [selectedSessionId, getActivitiesForSession]);

  const selectedSession = sessions.find(session => session.id === selectedSessionId) || null;

  return (
    <div className="space-y-4">
      {editingActivity && (
        <ActivityEditor
          activity={editingActivity}
          onSave={async updates => {
            await onUpdateActivity(editingActivity.id, updates);
            const next = await getActivitiesForSession(selectedSessionId);
            setActivities(next);
            setEditingActivity(null);
          }}
          onDelete={async (activityId) => {
            await onDeleteActivity(activityId);
            const next = await getActivitiesForSession(selectedSessionId);
            setActivities(next);
            setEditingActivity(null);
          }}
          onClose={() => setEditingActivity(null)}
        />
      )}

      <div className="rounded-[2rem] p-5 space-y-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--accent)' }}>{t('eeg.title', 'EEG Diary')}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-dim)' }}>
              {t('eeg.description', 'EEG sessions stay separate from seizure history. Seizures recorded during EEG appear here as linked reference rows.')}
            </p>
          </div>
          {activeSession && (
            <button
              onClick={() => onEndSession(activeSession.id)}
              className="app-icon-action app-icon-action--danger shrink-0"
            >
              {t('eeg.end_active', 'End Active EEG')}
            </button>
          )}
        </div>
        {sessions.length > 0 ? (
          <select
            value={selectedSessionId || ''}
            onChange={e => setSelectedSessionId(Number(e.target.value))}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {sessions.map(session => (
              <option key={session.id} value={session.id}>
                {(session.title || t('eeg.session_default', 'EEG session'))} - {formatEventDate(session.startTime)} {formatEventTime(session.startTime)}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm italic" style={{ color: 'var(--text-faint)' }}>{t('eeg.no_sessions', 'No EEG sessions yet.')}</p>
        )}
      </div>

      {selectedSession && (
        <div className="rounded-[2rem] p-5 space-y-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{t('eeg.started', 'Started')}</p>
              <p style={{ color: 'var(--text-primary)' }}>{formatEventDate(selectedSession.startTime)} {formatEventTime(selectedSession.startTime)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{t('event_detail.status')}</p>
              <p
                className="app-status-badge mt-1"
                style={getEegSessionStatusStyle(selectedSession.status)}
              >
                {selectedSession.status}
              </p>
            </div>
          </div>
          {selectedSession.notes && (
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>{selectedSession.notes}</p>
          )}
          {activities.length === 0 ? (
            <p className="text-sm italic" style={{ color: 'var(--text-faint)' }}>{t('eeg.no_activities', 'No EEG activities logged for this session.')}</p>
          ) : (
            activities.map(activity => (
              <button
                key={activity.id}
                onClick={() => setEditingActivity(activity)}
                className="w-full rounded-2xl p-4 text-left"
                style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={activity.kind === 'SEIZURE_REFERENCE' ? 'app-status-badge app-status-badge--danger' : 'app-status-badge app-status-badge--neutral'}>
                      {activity.kind === 'SEIZURE_REFERENCE' ? t('eeg.seizure_reference', 'Seizure reference') : t('eeg.activity', 'Activity')}
                    </p>
                    <p className="text-sm font-black mt-1" style={{ color: 'var(--text-primary)' }}>{activity.activityLabel}</p>
                    {activity.customActivityText && (
                      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{activity.customActivityText}</p>
                    )}
                    {activity.moodLabel && (
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>{t('eeg.mood_label', 'Mood')}: {activity.moodLabel}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{t('export.docs.duration')}</p>
                    <p className="text-sm font-mono font-black" style={{ color: 'var(--text-primary)' }}>{formatDuration(activity.durationSec || 0)}</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-between gap-3 text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  <span>{formatEventDate(activity.startTime)} {formatEventTime(activity.startTime)}</span>
                  <span>{activity.endTime ? `${formatEventTime(activity.endTime)}` : t('eeg.running', 'Running')}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
