import React, { useState, useEffect } from 'react';
import { useEventTimer } from './hooks/useEventTimer';
import { useEventHistory } from './hooks/useEventHistory';
import { useTaggingWizard } from './hooks/useTaggingWizard';
import { useSettings } from './hooks/useSettings';
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
      <button onClick={onHistory} className="text-slate-600 text-[10px] font-black uppercase tracking-widest active:text-slate-400 transition-colors px-2 py-1">
        HISTORY
      </button>
      <div className="text-center">
        <h1 className="text-[10px] font-black tracking-[0.4em] text-slate-600 uppercase opacity-50">AURATRACK</h1>
        <div className="h-1 w-4 bg-red-600 mx-auto mt-1 rounded-full opacity-40" />
      </div>
      <button onClick={onSettings} className="text-slate-600 text-xl active:text-slate-400 transition-colors px-2 py-1">
        ⚙
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
  const { settings, updateSettings } = useSettings();

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
    const ev = timer.stopTimer();
    const id = await db.events.add({ ...ev, type: 'Uncategorized', isComplete: false, editLog: [], userModeAtTime: settings.userMode });
    wizard.setActiveEvent(id);
    setStatus('TAGGING');
  };

  const handleEdit = (event) => { wizard.loadForEdit(event); timer.setElapsedForEdit(event.duration); setStatus('TAGGING'); };
  const handleSave = async () => { await wizard.handleFinalSave(); await history.load(); setStatus('IDLE'); };
  const handleCancel = () => { wizard.reset(); setStatus('IDLE'); };
  const handleDeleteConfirm = async () => { await history.deleteEvent(itemToDelete); await history.load(); setItemToDelete(null); };

  const goToDetail = (id) => { setDetailEventId(id); setStatus('EVENT_DETAIL'); };
  const showHeader = !['RECORDING', 'TAGGING'].includes(status);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0f172a] font-sans text-slate-100 overflow-hidden select-none">
      {showHeader && <Header onHistory={() => setStatus('HISTORY')} onSettings={() => setStatus('SETTINGS')} />}

      <div className="flex-1 flex flex-col items-center px-6 overflow-hidden pb-8">
        {status === 'IDLE'         && <IdleView history={history.history} onStart={handleStart} onEdit={handleEdit} onDelete={setItemToDelete} onViewDetail={goToDetail} />}
        {status === 'RECORDING'    && <RecordingView elapsed={timer.elapsed} startTime={timer.startTime} laps={timer.laps} onLap={timer.recordLap} onStop={handleStop} onQuickNote={l => wizard.addQuickNote(l, timer.elapsed)} userMode={settings.userMode} />}
        {status === 'TAGGING'      && <TaggingView {...wizard} elapsed={timer.elapsed} laps={timer.laps} startTime={timer.startTime} onSave={handleSave} onCancel={handleCancel} />}
        {status === 'HISTORY'      && <HistoryView onBack={() => setStatus('IDLE')} onEdit={handleEdit} onDelete={setItemToDelete} onViewDetail={goToDetail} historyPageSize={settings.historyPageSize} />}
        {status === 'SETTINGS'     && <SettingsView settings={settings} onUpdate={updateSettings} onBack={() => setStatus('IDLE')} />}
        {status === 'EXPORT'       && <ExportView onBack={() => setStatus('IDLE')} />}
        {status === 'EVENT_DETAIL' && <EventDetailView eventId={detailEventId} onEdit={handleEdit} onClose={() => setStatus('IDLE')} />}
      </div>

      {itemToDelete && <DeleteModal onConfirm={handleDeleteConfirm} onCancel={() => setItemToDelete(null)} />}
    </div>
  );
}

export default App;
