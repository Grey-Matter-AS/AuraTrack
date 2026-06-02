import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventTimer } from './hooks/useEventTimer';
import { useEventHistory } from './hooks/useEventHistory';
import { useTaggingWizard } from './hooks/useTaggingWizard';
import { useSettings } from './hooks/useSettings';
import { setHapticEnabled } from './utils/hapticFeedback';
import { db } from './data/db';
import { DeleteModal } from './components/DeleteModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useWakeLock } from './hooks/useWakeLock';
import { useMedications } from './hooks/useMedications';
import { useNotifications } from './hooks/useNotifications';
import { useAutoBackup } from './hooks/useAutoBackup';
import { getVisibleDosesForPanel } from './utils/medicationSchedule';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { ManualEntrySheet } from './components/ManualEntrySheet';
import IdleView from './pages/IdleView';
import RecordingView from './pages/RecordingView';
import TaggingView from './pages/TaggingView';
import HistoryView from './pages/HistoryView';
import SettingsView from './pages/SettingsView';
import EventDetailView from './pages/EventDetailView';
import AboutView from './pages/AboutView';
import HelpView from './pages/HelpView';
import SyncModal from './components/SyncModal';

function Header({ onSettings, onHistory, onHelp }) {
  const { t } = useTranslation();
  return (
    <div className="pt-4 pb-2 shrink-0 grid grid-cols-3 items-center px-6">
      <button
        onClick={onHistory}
        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
      >
        {t('nav.history')}
      </button>
      <div className="text-center">
        <h1 className="text-[10px] font-black tracking-[0.4em] text-[var(--text-faint)] uppercase opacity-50">AURATRACK</h1>
        <div className="h-1 w-4 bg-[var(--accent)] mx-auto mt-1 rounded-full opacity-60" />
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onSettings}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          {t('nav.settings')}
        </button>
        <button
          onClick={onHelp}
          className="w-8 h-8 rounded-xl text-[12px] font-black flex items-center justify-center active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
          aria-label={t('nav.help_label')}
        >
          ?
        </button>
      </div>
    </div>
  );
}

function App() {
  const [status, setStatus] = useState('IDLE');
  const [previousStatus, setPreviousStatus] = useState('IDLE');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [detailEventId, setDetailEventId] = useState(null);
  const [fullHistory, setFullHistory] = useState([]);
  const [toastMsg, setToastMsg] = useState('');
  const [todayLogs, setTodayLogs] = useState([]);
  const [allMedLogs, setAllMedLogs] = useState([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [syncModal, setSyncModal] = useState({ open: false, connectToken: null, offerSDP: null });

  const timer = useEventTimer();
  const history = useEventHistory();
  const wizard = useTaggingWizard();
  const { settings, updateSettings, resetSettings } = useSettings();
  const pwa = usePWAInstall();
  const wakeLock = useWakeLock();
  const [wakeLockUnsupported, setWakeLockUnsupported] = useState(false);
  const meds = useMedications();
  const notifications = useNotifications();
  const stoppingRef = useRef(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 5000);
  };

  useAutoBackup({
    settings,
    updateSettings,
    status,
    events: fullHistory,
    medications: meds.medications,
    medicationLogs: allMedLogs,
    onBackupComplete: () => showToast('Auto-backup saved to Downloads'),
  });

  // Sync haptic preference to the module singleton
  useEffect(() => { setHapticEnabled(settings.hapticFeedback); }, [settings.hapticFeedback]);

  // Detect URL hash for QR-based sync (opened by scanning a QR code on another device)
  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash;
      const syncMatch = hash.match(/^#sync=(.+)/);
      const offerMatch = hash.match(/^#sdp=(.+)/);
      const answerMatch = hash.match(/^#sdp-answer=(.+)/);
      if (syncMatch || offerMatch || answerMatch) {
        window.history.replaceState(null, '', window.location.pathname);
        setSyncModal({
          open: true,
          connectToken: syncMatch?.[1] ?? null,
          offerSDP: offerMatch?.[1] ?? null,
        });
      }
    };
    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);

  // Crash recovery: resume timer if browser closed during recording
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aura_startTime');
	      if (localStorage.getItem('aura_status') === 'RECORDING' && saved) {
	        timer.restore(parseInt(saved, 10));
	        const id = setTimeout(() => setStatus('RECORDING'), 0);
	        return () => clearTimeout(id);
	      }
    } catch { /* private browsing — crash recovery unavailable */ }
  }, []);

  useEffect(() => {
    if (status === 'IDLE') {
      history.load();
      history.loadAll().then(setFullHistory).catch(() => {});
      meds.load();
      meds.markMissedDoses().catch(() => {});
      meds.getLogsForDay(Date.now()).then(setTodayLogs).catch(() => {});
      db.medicationLogs.toArray().then(setAllMedLogs).catch(() => {});
    }
  }, [status]);

  // Wake Lock: keep screen on during recording; show banner on unsupported browsers
	  useEffect(() => {
	    let resetTimer;
	    if (status === 'RECORDING') {
	      wakeLock.acquire().then(ok => {
	        if (!ok && !wakeLock.supported) setWakeLockUnsupported(true);
	      });
	    } else {
	      wakeLock.release();
	      resetTimer = setTimeout(() => setWakeLockUnsupported(false), 0);
	    }
	    return () => clearTimeout(resetTimer);
	  }, [status]);

  // Re-acquire wake lock when tab regains focus (OS releases it on tab switch)
  // Also re-schedule notifications on visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        if (status === 'RECORDING') wakeLock.acquire();
        notifications.scheduleForToday(meds.medications);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [status, meds.medications]);

  // Schedule notifications whenever medication list changes
  useEffect(() => {
    notifications.scheduleForToday(meds.medications);
  }, [meds.medications]);

  const handleStart = () => { wizard.reset(); timer.startTimer(); setStatus('RECORDING'); };

  const handleManualCreate = async ({ date, time, durationSec, manualDurations }) => {
    try {
      const startTime = new Date(`${date}T${time}`).getTime();
      const id = await db.events.add({
        uuid: crypto.randomUUID(),
        startTime,
        date: new Date(startTime).toLocaleDateString(),
        time: new Date(startTime).toLocaleTimeString(),
        duration: durationSec,
        manualDurations: manualDurations ?? {},
        laps: {},
        type: 'Uncategorized',
        isComplete: false,
        editLog: [],
        userModeAtTime: settings.userMode,
        isManualEntry: true,
      });
      wizard.loadForManualEntry(id, manualDurations, { date, time });
      setShowManualEntry(false);
      setStatus('TAGGING');
    } catch (err) {
      console.error('Failed to create manual entry:', err);
      showToast('Failed to create entry. Please try again.');
    }
  };

  const handleStop = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const ev = timer.stopTimer();
      if (!ev) return;
      const id = await db.events.add({ uuid: crypto.randomUUID(), ...ev, type: 'Uncategorized', isComplete: false, editLog: [], userModeAtTime: settings.userMode });
      wizard.setActiveEvent(id);
      setStatus('TAGGING');
    } catch (err) {
      console.error('Failed to save event:', err);
      showToast('Failed to save event. Please try again.');
    } finally {
      stoppingRef.current = false;
    }
  };

  const handleEdit = (event) => { wizard.loadForEdit(event); timer.setForEdit(event.duration, event.laps, event.startTime); setStatus('TAGGING'); };

  const handleSave = async () => {
    try {
      await wizard.handleFinalSave();
      await history.load();
      setStatus('IDLE');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Save failed. Please try again.');
    }
  };

  const handleSkipTagging = async () => {
    try {
      await wizard.handleDeferredSave();
      await history.load();
      setStatus('IDLE');
    } catch (err) {
      console.error('Deferred save failed:', err);
      showToast('Save failed. Please try again.');
    }
  };

  const handleCancel = async () => {
    if (wizard.activeEventId && !wizard.editingId) {
      await db.events.delete(wizard.activeEventId).catch(() => {});
    }
    wizard.reset();
    setStatus('IDLE');
  };

  const handleDeleteConfirm = async () => {
    try {
      await history.deleteEvent(itemToDelete);
      await history.load();
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('Delete failed. Please try again.');
    } finally {
      setItemToDelete(null);
    }
  };

  const handleEmergencyStop = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const ev = timer.stopTimer();
      if (!ev) { setStatus('IDLE'); return; }
      await db.events.add({
        uuid: crypto.randomUUID(),
        ...ev,
        type: 'Uncategorized',
        isComplete: true,
        editLog: [],
        userModeAtTime: settings.userMode,
        notes: 'PATIENT UNRESPONSIVE — all timers automatically stopped at 12 minutes.',
        isEmergencyStop: true,
      });
      wizard.reset();
      await history.load();
      setStatus('IDLE');
    } catch (err) {
      console.error('Emergency stop save failed:', err);
      showToast('⚠ Failed to save event. Please check History and re-enter if missing.');
      setStatus('IDLE');
    } finally {
      stoppingRef.current = false;
    }
  };

  const goToDetail = (id) => { setPreviousStatus(status); setDetailEventId(id); setStatus('EVENT_DETAIL'); };
  const goToHelp = () => { setPreviousStatus(status); setStatus('HELP'); };
  const goToAbout = () => { setPreviousStatus(status); setStatus('ABOUT'); };
  const showHeader = !['RECORDING', 'TAGGING'].includes(status);

  // Active quick note labels (filter empties)
  const activeQuickNoteLabels = (settings.quickNoteLabels || []).filter(l => l.trim());

  // Medication derivations
  const activeMedications = meds.medications.filter(m => m.active && !m.isRescue);
  const allActiveMedications = meds.medications.filter(m => m.active);
  const emergencyMedications = meds.medications.filter(m => m.active && m.showInEmergency);
  const medicationGroups = getVisibleDosesForPanel(activeMedications, todayLogs);

  const handleSaveDoses = async (doses) => {
    const now = Date.now();
    for (const { medicationId, scheduledHHMM, note } of doses) {
      await meds.logDoseWithStatus(medicationId, scheduledHHMM ?? null, now, 'taken', note);
    }
    const logs = await meds.getLogsForDay(Date.now());
    setTodayLogs(logs);
    const names = doses.map(d => {
      const med = meds.medications.find(m => m.id === d.medicationId);
      return med ? med.name : '';
    }).filter(Boolean);
    showToast(`Logged: ${names.join(', ')}`);
  };

  return (
    <div
      className="flex flex-col h-dvh w-full font-sans overflow-hidden select-none"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', paddingTop: 'env(safe-area-inset-top)' }}
      data-theme={settings.theme}
      data-accent={settings.accentColor}
      data-font-size={settings.fontSize}
    >
      {showHeader && <Header onHistory={() => setStatus('HISTORY')} onSettings={() => setStatus('SETTINGS')} onHelp={goToHelp} />}

      {status === 'RECORDING' && wakeLockUnsupported && (
        <div className="shrink-0 text-xs text-center px-4 py-2"
          style={{ background: 'var(--bg-raised)', color: 'var(--text-on-raised-muted)', borderBottom: '1px solid var(--border)' }}>
          Screen may sleep — increase screen timeout in device settings
        </div>
      )}

      <div className="flex-1 flex flex-col items-center px-3 overflow-hidden pb-8">
        {status === 'IDLE'         && <IdleView history={history.history} fullHistory={fullHistory} onStart={handleStart} onManualEntry={() => setShowManualEntry(true)} onEdit={handleEdit} onDelete={setItemToDelete} onViewDetail={goToDetail} medicationGroups={medicationGroups} allActiveMedications={allActiveMedications} onSaveDoses={handleSaveDoses} durationFormat={settings.durationFormat} dateFormat={settings.dateFormat} timeFormat={settings.timeFormat} />}
        {status === 'RECORDING'    && <RecordingView elapsed={timer.elapsed} startTime={timer.startTime} laps={timer.laps} onLap={timer.recordLap} onStop={handleStop} onEmergencyStop={handleEmergencyStop} onQuickNote={l => wizard.addQuickNote(l, timer.elapsed)} userMode={settings.userMode} quickNoteLabels={activeQuickNoteLabels} emergencyMedications={emergencyMedications} neurologistName={settings.neurologistName} neurologistContact={settings.neurologistContact} emergencyContact={settings.emergencyContact} durationFormat={settings.durationFormat} />}
        {status === 'TAGGING'      && <TaggingView {...wizard} elapsed={timer.elapsed} laps={timer.laps} startTime={timer.startTime} onSave={handleSave} onSkip={handleSkipTagging} onCancel={handleCancel} durationFormat={settings.durationFormat} />}
        {status === 'HISTORY'      && <HistoryView onBack={() => setStatus('IDLE')} onEdit={handleEdit} onDelete={setItemToDelete} onViewDetail={goToDetail} historyPageSize={settings.historyPageSize} settings={settings} />}
        {status === 'SETTINGS'     && <SettingsView settings={settings} onUpdate={updateSettings} onReset={resetSettings} onBack={() => setStatus('IDLE')} pwa={pwa} notificationPermission={notifications.permission} onRequestNotificationPermission={async () => { const p = await notifications.requestPermission(); if (p === 'granted') notifications.scheduleForToday(meds.medications); }} onSync={() => setSyncModal({ open: true, connectToken: null, offerSDP: null })} />}
        {status === 'EVENT_DETAIL' && <EventDetailView eventId={detailEventId} onEdit={handleEdit} onClose={() => setStatus(previousStatus)} durationFormat={settings.durationFormat} dateFormat={settings.dateFormat} timeFormat={settings.timeFormat} />}
        {status === 'HELP'         && <HelpView onBack={() => setStatus('IDLE')} onAbout={goToAbout} />}
        {status === 'ABOUT'        && <AboutView onBack={() => setStatus(previousStatus)} />}
      </div>

      {itemToDelete && <DeleteModal onConfirm={handleDeleteConfirm} onCancel={() => setItemToDelete(null)} />}
      {showManualEntry && <ManualEntrySheet onConfirm={handleManualCreate} onClose={() => setShowManualEntry(false)} />}
      <SyncModal
        isOpen={syncModal.open}
        onClose={() => setSyncModal({ open: false, connectToken: null, offerSDP: null })}
        connectToken={syncModal.connectToken}
        offerSDP={syncModal.offerSDP}
      />

      <PWAInstallBanner isVisible={pwa.isVisible} isIOS={pwa.isIOS} install={pwa.install} dismiss={pwa.dismiss} showManualInstructions={pwa.showManualInstructions} dismissManual={pwa.dismissManual} />
      {toastMsg && (
        <div
          className="fixed bottom-6 left-4 right-4 z-50 py-3 px-5 rounded-2xl text-sm font-bold text-center"
          style={{ backgroundColor: '#dc2626', color: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
        >
          {toastMsg}
        </div>
      )}
      {pwa.needRefresh && (
        <div
          className="fixed top-0 left-0 right-0 z-50 py-2 px-4 flex items-center justify-between text-xs font-bold"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          <span>App update available</span>
          <button onClick={() => pwa.updateServiceWorker()} className="underline">Reload</button>
        </div>
      )}
    </div>
  );
}

export default App;
