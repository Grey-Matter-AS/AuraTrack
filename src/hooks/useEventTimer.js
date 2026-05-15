import { useState, useEffect } from 'react';
import { haptic } from '../utils/hapticFeedback';

export function useEventTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [laps, setLaps] = useState({ aura: null, seizure: null, recovery: null });

  useEffect(() => {
    let interval;
    if (isRunning && startTime) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  const startTimer = () => {
    const now = Date.now();
    setStartTime(now);
    setElapsed(0);
    setLaps({ aura: null, seizure: null, recovery: null });
    setIsRunning(true);
    localStorage.setItem('aura_startTime', now);
    localStorage.setItem('aura_status', 'RECORDING');
    localStorage.setItem('aura_startDateReadable', new Date(now).toLocaleDateString());
    localStorage.setItem('aura_startTimeReadable', new Date(now).toLocaleTimeString());
  };

  const stopTimer = () => {
    setIsRunning(false);
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    const finalLaps = { ...laps, recovery: endTime };
    const date = localStorage.getItem('aura_startDateReadable');
    const time = localStorage.getItem('aura_startTimeReadable');
    ['aura_startTime', 'aura_status', 'aura_startDateReadable', 'aura_startTimeReadable'].forEach(k => localStorage.removeItem(k));
    return { startTime, endTime, duration, laps: finalLaps, date, time };
  };

  const recordLap = (phase) => {
    setLaps(prev => ({ ...prev, [phase]: Date.now() }));
    haptic(100);
  };

  const restore = (savedStartTime) => {
    setStartTime(savedStartTime);
    setElapsed(Math.floor((Date.now() - savedStartTime) / 1000));
    setIsRunning(true);
  };

  const setElapsedForEdit = (duration) => {
    setElapsed(duration);
  };

  return { startTime, elapsed, laps, startTimer, stopTimer, recordLap, restore, setElapsedForEdit };
}
