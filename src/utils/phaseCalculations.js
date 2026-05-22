export function phaseDurs(e) {
  const m = e.manualDurations || {};
  return {
    aura:     m.aura     ?? (e.laps?.aura && e.startTime         ? Math.round((e.laps.aura - e.startTime) / 1000)         : 0),
    seizure:  m.seizure  ?? (e.laps?.aura && e.laps?.seizure     ? Math.round((e.laps.seizure - e.laps.aura) / 1000)       : 0),
    recovery: m.recovery ?? (e.laps?.seizure && e.laps?.recovery ? Math.round((e.laps.recovery - e.laps.seizure) / 1000)   : 0),
  };
}
