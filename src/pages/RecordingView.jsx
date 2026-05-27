import React, { useState, useEffect, useRef } from 'react';

const ALERT_THRESHOLD = 300;  // 5 minutes
const AUTO_STOP_AT    = 720;  // 12 minutes

function RedAlert({ elapsed, onClose, emergencyMedications = [], neurologistName, neurologistContact, emergencyContact }) {
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
      <p className="text-[10px] font-black tracking-[0.5em] text-red-200 uppercase mb-4">MEDICAL ALERT</p>

      <div className="text-7xl mb-3">⚠</div>

      <h1 className="text-4xl font-black text-white uppercase tracking-tight text-center mb-1">
        UNRESPONSIVE
      </h1>
      <p className="text-xl font-black text-red-200 uppercase tracking-widest text-center mb-5">
        MEDICAL EMERGENCY
      </p>

      <div className="w-full max-w-xs rounded-3xl p-4 mb-4 text-center space-y-1"
        style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
        <p className="text-red-100 text-sm font-bold">CALL EMERGENCY SERVICES NOW</p>
        <p className="text-red-300 text-xs">Do not leave the patient unattended</p>
      </div>

      {/* Emergency medications */}
      {emergencyMedications.length > 0 && (
        <div className="w-full max-w-xs rounded-3xl p-4 mb-4 text-center"
          style={{ backgroundColor: '#fff', border: '3px solid #dc2626' }}>
          <p className="text-red-700 text-[10px] font-black uppercase tracking-widest mb-2">
            Administer Emergency Medication
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
              <p className="text-red-300 text-[9px] font-black uppercase tracking-widest shrink-0">Neurologist</p>
              <p className="text-white text-xs font-bold text-right">
                {[neurologistName, neurologistContact].filter(Boolean).join('  ·  ')}
              </p>
            </div>
          )}
          {emergencyContact && (
            <div className="flex justify-between items-start gap-2">
              <p className="text-red-300 text-[9px] font-black uppercase tracking-widest shrink-0">Emergency Contact</p>
              <p className="text-white text-xs font-bold text-right">{emergencyContact}</p>
            </div>
          )}
        </div>
      )}

      {/* Live elapsed */}
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300 mb-1">Elapsed</p>
      <p className="text-6xl font-mono font-black text-white tabular-nums">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </p>

      <p className="text-red-300 text-[10px] mt-3 font-bold">Timer auto-stops at 12:00</p>
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
}) {
  const [showMarkers, setShowMarkers] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const emergencyFiredRef = useRef(false);

  const getDiff = (start, end) => {
    if (!start) return 0;
    return Math.floor(((end || Date.now()) - start) / 1000);
  };

  const auraDuration     = getDiff(startTime, laps.aura);
  const seizureDuration  = laps.aura ? getDiff(laps.aura, laps.seizure) : 0;
  const recoveryDuration = laps.seizure ? getDiff(laps.seizure, null) : 0;

  // Trigger alert at 5-minute threshold
  useEffect(() => {
    if (alertDismissed) return;
    const triggerPatient   = userMode !== 'CARETAKER' && elapsed >= ALERT_THRESHOLD;
    const triggerCaretaker = userMode === 'CARETAKER'  && laps.aura && !laps.seizure && seizureDuration >= ALERT_THRESHOLD;
    if (triggerPatient || triggerCaretaker) setShowAlert(true);
  }, [elapsed, seizureDuration, laps, userMode, alertDismissed]);

  // Auto-stop at 12 minutes — ref guard ensures it fires exactly once
  useEffect(() => {
    if (elapsed >= AUTO_STOP_AT && !emergencyFiredRef.current) {
      emergencyFiredRef.current = true;
      onEmergencyStop?.();
    }
  }, [elapsed]);

  const dismissAlert = () => {
    setShowAlert(false);
    setAlertDismissed(true);
  };

  return (
    <>
      {/* RED ALERT — fullscreen overlay, stays on top of everything */}
      {showAlert && <RedAlert elapsed={elapsed} onClose={dismissAlert} emergencyMedications={emergencyMedications} neurologistName={neurologistName} neurologistContact={neurologistContact} emergencyContact={emergencyContact} />}

      <div className="flex-1 min-h-0 flex flex-col items-center justify-between w-full max-w-md sm:max-w-xl md:max-w-2xl mx-auto px-4 py-6 animate-in fade-in">

        {/* 1. TOP: Phase Breakdown */}
        {userMode === 'CARETAKER' && (
          <div className="grid grid-cols-3 gap-3 w-full mb-2 shrink-0">
            <div className="py-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Aura</p>
              <p className="text-2xl font-mono font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{auraDuration}s</p>
            </div>
            <div className="py-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Seizure</p>
              <p className="text-2xl font-mono font-bold leading-none"
                style={{ color: laps.aura && !laps.seizure && seizureDuration >= 240 ? '#ef4444' : 'var(--text-primary)' }}>
                {seizureDuration}s
              </p>
            </div>
            <div className="py-3 rounded-2xl text-center" style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Recovery</p>
              <p className="text-2xl font-mono font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{recoveryDuration}s</p>
            </div>
          </div>
        )}

        {/* 2. MAIN TIMER */}
        <div className="flex-1 flex flex-col justify-center text-center py-4">
          <p className="text-xs font-black uppercase tracking-[0.4em] mb-2" style={{ color: 'var(--text-dim)' }}>Total Elapsed</p>
          <div
            className="text-[11vh] font-mono font-black tracking-tighter tabular-nums leading-none"
            style={{ color: elapsed >= 240 && userMode !== 'CARETAKER' ? '#ef4444' : 'var(--text-primary)' }}
          >
            {elapsed}<span className="text-[4vh] ml-2 font-sans font-bold" style={{ color: 'var(--text-faint)' }}>S</span>
          </div>
          {/* Warning ring at 4 min (1 min before alert) */}
          {elapsed >= 240 && elapsed < ALERT_THRESHOLD && (
            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mt-2 animate-pulse">
              {userMode === 'CARETAKER' ? 'LONG SEIZURE — MONITOR CLOSELY' : 'APPROACHING ALERT THRESHOLD'}
            </p>
          )}
        </div>

        {/* 3. DYNAMIC ACTION AREA */}
        <div className="w-full flex gap-4 min-h-[25vh] items-stretch transition-all duration-500 mb-6">

          {/* LEFT COLUMN: Phase Buttons */}
          <div className={`flex flex-col gap-4 transition-all duration-500 ${showMarkers ? 'w-[48%]' : 'w-full'}`}>
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
                  {laps.aura ? 'AURA ENDED ✓' : 'END AURA'}
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
                  {laps.seizure ? 'SEIZURE ENDED ✓' : 'END SEIZURE'}
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
              {showMarkers ? 'CLOSE NOTES' : '+ EVENT NOTE'}
            </button>
          </div>

          {/* RIGHT COLUMN: Marker Sidebar */}
          {showMarkers && (
            <div className="w-[52%] grid grid-cols-1 gap-3 animate-in slide-in-from-right fade-in duration-300">
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
        <div className="w-full shrink-0">
          <button
            onClick={onStop}
            className="w-full py-[clamp(1rem,4vh,2.5rem)] text-5xl font-black rounded-[3rem] active:scale-95 transition-transform uppercase"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-base)', border: '10px solid var(--bg-base)', boxShadow: '0 0 60px rgba(255,255,255,0.1)' }}
          >
            STOP
          </button>
          {userMode === 'PATIENT' && (
            <p className="text-center text-xs mt-4 uppercase font-black tracking-[0.2em]" style={{ color: 'var(--text-dim)' }}>
              Self Mode Enabled
            </p>
          )}
        </div>

      </div>
    </>
  );
}

export default RecordingView;
