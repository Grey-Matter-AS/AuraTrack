import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '../utils/formatters';

const ALERT_THRESHOLD = 300;  // 5 minutes
const AUTO_STOP_AT    = 720;  // 12 minutes

function RedAlert({ elapsed, onClose, emergencyMedications = [], neurologistName, neurologistContact, emergencyContact }) {
  const { t } = useTranslation();
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 select-none overflow-y-auto"
      style={{ backgroundColor: 'rgba(185,28,28,0.97)', backdropFilter: 'blur(4px)' }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center text-xl font-black transition-all active:scale-90"
        style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}
      >
        ✕
      </button>

      {/* Content */}
      <p className="text-[10px] font-black tracking-[0.5em] text-red-200 uppercase mb-4">{t('alert.medical_alert')}</p>

      <div className="text-7xl mb-3">⚠</div>

      <h1 className="text-4xl font-black text-white uppercase tracking-tight text-center mb-1">
        {t('alert.unresponsive')}
      </h1>
      <p className="text-xl font-black text-red-200 uppercase tracking-widest text-center mb-5">
        {t('alert.medical_emergency')}
      </p>

      <div className="w-full max-w-xs rounded-3xl p-4 mb-4 text-center space-y-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
        <p className="text-red-100 text-sm font-bold">{t('alert.call_services')}</p>
        <p className="text-red-300 text-xs">{t('alert.dont_leave')}</p>
      </div>

      {/* Emergency medications */}
      {emergencyMedications.length > 0 && (
        <div className="w-full max-w-xs rounded-3xl p-4 mb-4 text-center"
          style={{ backgroundColor: '#fff', border: '3px solid #dc2626' }}>
          <p className="text-red-700 text-[10px] font-black uppercase tracking-widest mb-2">
            {t('alert.administer_med')}
          </p>
          {emergencyMedications.map(med => (
            <p key={med.id} className="text-red-800 text-lg font-black">
              {med.name} {med.dose}{med.unit}
            </p>
          ))}
        </div>
      )}

      {/* Contact info */}
      {(neurologistName || neurologistContact || emergencyContact) && (
        <div className="w-full max-w-xs rounded-2xl p-4 mb-4 space-y-2"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
          {(neurologistName || neurologistContact) && (
            <div className="flex justify-between items-start gap-2">
              <p className="text-red-300 text-[9px] font-black uppercase tracking-widest shrink-0">{t('alert.neurologist')}</p>
              <p className="text-white text-xs font-bold text-right">
                {[neurologistName, neurologistContact].filter(Boolean).join('  ·  ')}
              </p>
            </div>
          )}
          {emergencyContact && (
            <div className="flex justify-between items-start gap-2">
              <p className="text-red-300 text-[9px] font-black uppercase tracking-widest shrink-0">{t('alert.emergency_contact')}</p>
              <p className="text-white text-xs font-bold text-right">{emergencyContact}</p>
            </div>
          )}
        </div>
      )}

      {/* Live elapsed */}
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300 mb-1">{t('alert.elapsed')}</p>
      <p className="text-6xl font-mono font-black text-white tabular-nums">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </p>

      <p className="text-red-300 text-[10px] mt-3 font-bold">{t('recording.auto_stop_notice')}</p>
    </div>
  );
}

function RecordingView({
  elapsed,
  startTime,
  laps,
  onLap,
  onStop,
  onEmergencyStop,
  onQuickNote,
  userMode,
  quickNoteLabels = ['FELL', 'RESCUE MED', 'NOT RESPONDING', 'FULL BODY', 'LEFT SIDE', 'RIGHT SIDE'],
  emergencyMedications = [],
  neurologistName,
  neurologistContact,
  emergencyContact,
  durationFormat = 'seconds',
  onStartVideo,
  onStopVideo,
  onSwitchCamera,
  videoRecording = false,
  videoSupported = false,
  videoError = '',
  previewStream = null,
  canSwitchCamera = false,
}) {
  const { t } = useTranslation();
  const fmtDur = (s) => durationFormat === 'human' ? formatDuration(s) : `${s}s`;
  const seizureStartLabel = startTime ? new Date(startTime).toLocaleString() : '';
  const [showMarkers, setShowMarkers] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const emergencyFiredRef = useRef(false);
  const previewRef = useRef(null);

  const getDiff = (start, end) => {
    if (!start) return 0;
    if (!end) return elapsed;
    return Math.floor((end - start) / 1000);
  };

  const auraDuration     = getDiff(startTime, laps.aura);
  const seizureDuration  = laps.aura ? getDiff(laps.aura, laps.seizure) : 0;
  const recoveryDuration = laps.seizure ? getDiff(laps.seizure, null) : 0;

  // Trigger alert at 5-minute threshold
  useEffect(() => {
    if (alertDismissed) return;
    if (elapsed >= ALERT_THRESHOLD) {
      setShowAlert(true);
    }
  }, [elapsed, alertDismissed]);

  // Auto-stop at 12 minutes — ref guard ensures it fires exactly once
  useEffect(() => {
    if (elapsed >= AUTO_STOP_AT && !emergencyFiredRef.current) {
      emergencyFiredRef.current = true;
      onEmergencyStop?.();
    }
  }, [elapsed, onEmergencyStop]);

  const dismissAlert = () => {
    setShowAlert(false);
    setAlertDismissed(true);
  };

  useEffect(() => {
    if (!previewRef.current) return;
    previewRef.current.srcObject = previewStream || null;
    if (previewStream) previewRef.current.play().catch(() => {});
  }, [previewStream]);

  return (
    <>
      {/* RED ALERT — fullscreen overlay, stays on top of everything */}
      {showAlert && <RedAlert elapsed={elapsed} onClose={dismissAlert} emergencyMedications={emergencyMedications} neurologistName={neurologistName} neurologistContact={neurologistContact} emergencyContact={emergencyContact} />}

      <div data-recording-screen className="flex-1 min-h-full flex flex-col items-center w-full max-w-md sm:max-w-xl md:max-w-2xl mx-auto px-4 py-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-in fade-in gap-4">

        {/* 1. TOP: Phase Breakdown */}
        {userMode === 'CARETAKER' && (
          <div className="grid grid-cols-3 gap-3 w-full mb-2 shrink-0">
            <div className="py-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">{t('recording.aura')}</p>
              <p className="text-2xl font-mono font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{fmtDur(auraDuration)}</p>
            </div>
            <div className="py-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">{t('recording.seizure')}</p>
              <p className="text-2xl font-mono font-bold leading-none"
                style={{ color: laps.aura && !laps.seizure && seizureDuration >= 240 ? '#ef4444' : 'var(--text-primary)' }}>
                {fmtDur(seizureDuration)}
              </p>
            </div>
            <div className="py-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{t('recording.recovery')}</p>
              <p className="text-2xl font-mono font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{fmtDur(recoveryDuration)}</p>
            </div>
          </div>
        )}

        {/* 2. MAIN TIMER */}
        <div className="w-full flex flex-col text-center py-2">
          <div className="flex justify-center mb-4">
            <div className="relative w-32 sm:w-36 aspect-[3/4] rounded-[1.5rem] overflow-hidden" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              {previewStream ? (
                <>
                  <video ref={previewRef} className="w-full h-full object-cover" playsInline muted />
                  <div className="absolute left-2 right-2 bottom-2 px-2 py-1 rounded-lg text-[10px] font-black"
                    style={{ backgroundColor: 'rgba(15,23,42,0.72)', color: '#fff' }}>
                    <div>{seizureStartLabel}</div>
                    <div>
                      T+{String(Math.floor(elapsed / 3600)).padStart(2, '0')}:{String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
                    style={{ backgroundColor: 'rgba(185,28,28,0.88)', color: '#fff' }}>
                    {t('recording.video_badge', 'Video')}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center px-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{t('recording.optional_video', 'Optional video')}</p>
                  <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                    {t('recording.video_hint', 'Start only if it is safe and helpful to capture the seizure.')}
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs font-black uppercase tracking-[0.4em] mb-2" style={{ color: 'var(--text-dim)' }}>{t('recording.total_elapsed')}</p>
          <div
            className="text-[11vh] font-mono font-black tracking-tighter tabular-nums leading-none"
            style={{ color: elapsed >= 240 && userMode !== 'CARETAKER' ? '#ef4444' : 'var(--text-primary)' }}
          >
            {fmtDur(elapsed)}
          </div>
          {/* Warning ring at 4 min (1 min before alert) */}
          {elapsed >= 240 && elapsed < ALERT_THRESHOLD && (
            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mt-2 animate-pulse">
              {userMode === 'CARETAKER' ? t('recording.long_seizure_warning') : t('recording.approaching_threshold')}
            </p>
          )}
          <div className="flex justify-center mt-4 gap-2 flex-wrap">
            <button
              onClick={videoRecording ? onStopVideo : onStartVideo}
              disabled={!videoSupported && !videoRecording}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
              style={{
                backgroundColor: videoRecording ? 'rgba(185,28,28,0.12)' : 'var(--bg-raised)',
                color: videoRecording ? '#ef4444' : 'var(--text-secondary)',
                border: `1px solid ${videoRecording ? 'rgba(185,28,28,0.25)' : 'var(--border)'}`,
              }}
            >
              {videoRecording ? t('recording.stop_video', 'Stop Video') : t('recording.start_video', 'Start Video')}
            </button>
            {canSwitchCamera && (
              <button
                onClick={onSwitchCamera}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                style={{
                  backgroundColor: 'var(--bg-raised)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                {t('recording.switch_camera', 'Switch Camera')}
              </button>
            )}
          </div>
          {videoError && (
            <p className="text-[11px] mt-2" style={{ color: '#fca5a5' }}>{videoError}</p>
          )}
        </div>

        {/* 3. DYNAMIC ACTION AREA */}
        <div className="w-full flex flex-col gap-4 transition-all duration-500 sm:flex-row sm:items-stretch sm:min-h-[25vh]">

          {/* LEFT COLUMN: Phase Buttons */}
          <div className={`flex flex-col gap-4 transition-all duration-500 w-full ${showMarkers ? 'sm:w-[48%]' : 'sm:w-full'}`}>
            {userMode === 'CARETAKER' && (
              <>
                <button
                  disabled={!!laps.aura}
                  onClick={() => onLap('aura')}
                  className={`flex-1 rounded-[2rem] font-black uppercase text-sm tracking-[0.15em] leading-tight transition-all border-[3px] px-2 ${
                    laps.aura
                      ? 'bg-slate-900 border-slate-800 text-slate-700'
                      : 'bg-amber-600 border-amber-400 text-white shadow-xl shadow-amber-900/40 active:scale-95'
                  }`}
                >
                  {laps.aura ? t('recording.aura_ended') : t('recording.end_aura')}
                </button>

                <button
                  disabled={!laps.aura || !!laps.seizure}
                  onClick={() => onLap('seizure')}
                  className={`flex-1 rounded-[2rem] font-black uppercase text-sm tracking-[0.15em] leading-tight transition-all border-[3px] px-2 ${
                    laps.seizure
                      ? 'bg-slate-900 border-slate-800 text-slate-700'
                      : (!laps.aura ? 'opacity-20 border-slate-800' : 'bg-red-600 border-red-400 text-white shadow-xl shadow-red-900/40 active:scale-95')
                  }`}
                >
                  {laps.seizure ? t('recording.seizure_ended') : t('recording.end_seizure')}
                </button>
              </>
            )}

            <button
              onClick={() => setShowMarkers(!showMarkers)}
              className="py-5 rounded-2xl font-black uppercase text-xs tracking-widest border-2 transition-all"
              style={showMarkers
                ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
                : { backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              {showMarkers ? t('recording.close_notes') : t('recording.event_note')}
            </button>
          </div>

          {/* RIGHT COLUMN: Marker Sidebar */}
          {showMarkers && (
            <div className="w-full grid grid-cols-1 gap-3 animate-in slide-in-from-right fade-in duration-300 sm:w-[52%]">
              {quickNoteLabels.map(label => (
                <button
                  key={label}
                  onClick={() => onQuickNote(label)}
                  className="rounded-2xl text-[11px] font-black tracking-tight uppercase transition-all px-3 shadow-lg leading-tight active:scale-95"
                  style={{ backgroundColor: 'var(--bg-raised)', border: '2px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 4. STOP Button */}
        <div
          className="w-full shrink-0 pt-2"
        >
          <button
            onClick={onStop}
            className="w-full py-[clamp(1rem,4vh,2.5rem)] text-5xl font-black rounded-[3rem] active:scale-95 transition-transform uppercase"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-base)', border: '10px solid var(--bg-base)', boxShadow: '0 0 60px rgba(255,255,255,0.1)' }}
          >
            {t('recording.stop')}
          </button>
          {userMode === 'PATIENT' && (
            <p className="text-center text-xs mt-4 uppercase font-black tracking-[0.2em]" style={{ color: 'var(--text-dim)' }}>
              {t('recording.self_mode')}
            </p>
          )}
        </div>

      </div>
    </>
  );
}

export default RecordingView;
