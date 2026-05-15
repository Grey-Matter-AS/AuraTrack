import React, { useState, useEffect, useRef } from 'react';
import { useEventTimer } from './hooks/useEventTimer';
import { useEventHistory } from './hooks/useEventHistory';
import { useTaggingWizard } from './hooks/useTaggingWizard';
import { useSettings } from './hooks/useSettings';
import { setHapticEnabled } from './utils/hapticFeedback';
import { db } from './data/db';
import { DeleteModal } from './components/DeleteModal';
import IdleView from './pages/IdleView';
import RecordingView from './pages/RecordingView';
import TaggingView from './pages/TaggingView';
import HistoryView from './pages/HistoryView';
import SettingsView from './pages/SettingsView';
import ExportView from './pages/ExportView';
import EventDetailView from './pages/EventDetailView';

function Header({ onSettings, onHistory }) {
  return (
    <div className="pt-8 pb-2 shrink-0 flex items-center justify-between px-6">
      <button
        onClick={onHistory}
        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
      >
        HISTORY
      </button>
      <div className="text-center">
        <h1 className="text-[10px] font-black tracking-[0.4em] text-[var(--text-faint)] uppercase opacity-50">AURATRACK</h1>
        <div className="h-1 w-4 bg-[var(--accent)] mx-auto mt-1 rounded-full opacity-60" />
      </div>
      <button
        onClick={onSettings}
        className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
        style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
      >
        ⚙ SETTINGS
      </button>
    </div>
  );
}

function App() {
  const [status, setStatus] = useState('IDLE');
  const [itemToDelete, setItemToDelete] = useState(null);
  const [detailEventId, setDetailEventId] = useState(null);

  const timer = useEventTimer();
  const history = useEventHistory();
  const wizard = useTaggingWizard();
  const { settings, updateSettings, resetSettings } = useSettings();
  const stoppingRef = useRef(false);

  // Sync haptic preference to the module singleton
  useEffect(() => { setHapticEnabled(settings.hapticFeedback); }, [settings.hapticFeedback]);

  // Crash recovery: resume timer if browser closed during recording
  useEffect(() => {
    const saved = localStorage.getItem('aura_startTime');
    if (localStorage.getItem('aura_status') === 'RECORDING' && saved) {
      timer.restore(parseInt(saved));
      setStatus('RECORDING');
    }
  }, []);

  useEffect(() => { if (status === 'IDLE') history.load(); }, [status]);

  const handleStart = () => { wizard.reset(); timer.startTimer(); setStatus('RECORDING'); };

  const handleStop = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const ev = timer.stopTimer();
      const id = await db.events.add({ ...ev, type: 'Uncategorized', isComplete: false, editLog: [], userModeAtTime: settings.userMode });
      wizard.setActiveEvent(id);
      setStatus('TAGGING');
    } finally {
      stoppingRef.current = false;
    }
  };

  const handleEdit = (event) => { wizard.loadForEdit(event); timer.setElapsedForEdit(event.duration); setStatus('TAGGING'); };
  const handleSave = async () => {
    try {
      await wizard.handleFinalSave();
      await history.load();
      setStatus('IDLE');
    } catch (err) {
      console.error('Save failed — staying on tagging screen:', err);
    }
  };
  const handleCancel = () => { wizard.reset(); setStatus('IDLE'); };
  const handleDeleteConfirm = async () => { await history.deleteEvent(itemToDelete); await history.load(); setItemToDelete(null); };

  const handleEmergencyStop = async () => {
    const ev = timer.stopTimer();
    await db.events.add({
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
  };

  const goToDetail = (id) => { setDetailEventId(id); setStatus('EVENT_DETAIL'); };
  const showHeader = !['RECORDING', 'TAGGING'].includes(status);

  // Active quick note labels (filter empties)
  const activeQuickNoteLabels = (settings.quickNoteLabels || []).filter(l => l.trim());

  return (
    <div
      className="flex flex-col h-screen w-full font-sans overflow-hidden select-none"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
      data-theme={settings.theme}
      data-accent={settings.accentColor}
      data-font-size={settings.fontSize}
    >
      {showHeader && <Header onHistory={() => setStatus('HISTORY')} onSettings={() => setStatus('SETTINGS')} />}

      <div className="flex-1 flex flex-col items-center px-6 overflow-hidden pb-8">
        {status === 'IDLE'         && <IdleView history={history.history} onStart={handleStart} onEdit={handleEdit} onDelete={setItemToDelete} onViewDetail={goToDetail} />}
        {status === 'RECORDING'    && <RecordingView elapsed={timer.elapsed} startTime={timer.startTime} laps={timer.laps} onLap={timer.recordLap} onStop={handleStop} onEmergencyStop={handleEmergencyStop} onQuickNote={l => wizard.addQuickNote(l, timer.elapsed)} userMode={settings.userMode} quickNoteLabels={activeQuickNoteLabels} />}
        {status === 'TAGGING'      && <TaggingView {...wizard} elapsed={timer.elapsed} laps={timer.laps} startTime={timer.startTime} onSave={handleSave} onCancel={handleCancel} />}
        {status === 'HISTORY'      && <HistoryView onBack={() => setStatus('IDLE')} onEdit={handleEdit} onDelete={setItemToDelete} onViewDetail={goToDetail} onExport={() => setStatus('EXPORT')} historyPageSize={settings.historyPageSize} />}
        {status === 'SETTINGS'     && <SettingsView settings={settings} onUpdate={updateSettings} onReset={resetSettings} onBack={() => setStatus('IDLE')} />}
        {status === 'EXPORT'       && <ExportView onBack={() => setStatus('HISTORY')} settings={settings} />}
        {status === 'EVENT_DETAIL' && <EventDetailView eventId={detailEventId} onEdit={handleEdit} onClose={() => setStatus('IDLE')} />}
      </div>

      {itemToDelete && <DeleteModal onConfirm={handleDeleteConfirm} onCancel={() => setItemToDelete(null)} />}
    </div>
  );
}

export default App;
