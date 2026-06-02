import { useState } from 'react';
import { db } from '../data/db';
import { haptic } from '../utils/hapticFeedback';

const EMPTY_SELECTIONS = { type: '', group: '', symptom: '', detail: '', region: '', subRegion: '', specificPart: '' };

export function useTaggingWizard() {
  const [taggingStep, setTaggingStep] = useState('TYPE');
  const [selections, setSelections] = useState(EMPTY_SELECTIONS);
  const [tempSymptomList, setTempSymptomList] = useState([]);
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [activeEventId, setActiveEventId] = useState(null);
  const [manualDurations, setManualDurationsState] = useState({});
  const [editedTimers, setEditedTimers] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [overrideDateTime, setOverrideDateTimeState] = useState(null); // { date: 'YYYY-MM-DD', time: 'HH:MM' }
  const [isManualEntry, setIsManualEntry] = useState(false);

  const setActiveEvent = (id) => {
    setActiveEventId(id);
  };

  const setManualDuration = (phase, seconds) => {
    setManualDurationsState(prev => ({ ...prev, [phase]: seconds }));
    setEditedTimers(prev => prev.includes(phase) ? prev : [...prev, phase]);
  };

  const triggerToggle = (label) => {
    setTriggers(prev => prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]);
  };

  const setEventDateTime = (date, time) => {
    setOverrideDateTimeState({ date, time });
  };

  const loadForEdit = (event) => {
    const eventType = event.type && event.type !== 'Uncategorized' ? event.type : '';
    setEditingId(event.id);
    setActiveEventId(event.id);
    setSelections({ ...EMPTY_SELECTIONS, type: eventType });
    setTempSymptomList(event.symptoms || []);
    setNotes(event.notes || '');
    setTriggers(event.triggers || []);
    setManualDurationsState(event.manualDurations || {});
    setEditedTimers(event.editedTimers || []);
    setOverrideDateTimeState(null);
    setIsManualEntry(false);
    setTaggingStep(!event.isComplete && !eventType ? 'TYPE' : 'SUMMARY');
  };

  // Called when creating a retrospective entry (Log Past Seizure flow)
  const loadForManualEntry = (id, manualDurs, dateTime) => {
    setActiveEventId(id);
    setEditingId(null);
    setManualDurationsState(manualDurs || {});
    setEditedTimers(Object.keys(manualDurs || {}));
    setOverrideDateTimeState(dateTime); // { date, time }
    setIsManualEntry(true);
    setTaggingStep('TYPE');
  };

  const handleFinalSave = async () => {
    const targetId = editingId || activeEventId;
    if (!targetId) throw new Error('No active event to save');

    const existing = await db.events.get(targetId);
    let type = selections.type;
    if (!type && editingId) {
      type = existing?.type || 'Uncategorized';
    }

    // If user changed the event's date/time, apply it
    const dateTimeOverride = overrideDateTime
      ? (() => {
          const newStartTime = new Date(`${overrideDateTime.date}T${overrideDateTime.time}`).getTime();
          return {
            startTime: newStartTime,
            date: new Date(newStartTime).toLocaleDateString(),
            time: new Date(newStartTime).toLocaleTimeString(),
          };
        })()
      : {};

    // Build edit log entry when editing an existing record
    const newEditLog = existing?.editLog ? [...existing.editLog] : [];
    if (editingId && existing) {
      const resolvedType = type || 'Uncategorized';
      const changedFields = [];
      if (resolvedType !== (existing.type || 'Uncategorized')) changedFields.push('type');
      if (notes !== (existing.notes || '')) changedFields.push('notes');
      if (JSON.stringify(triggers) !== JSON.stringify(existing.triggers || [])) changedFields.push('triggers');
      if (JSON.stringify(tempSymptomList) !== JSON.stringify(existing.symptoms || [])) changedFields.push('symptoms');
      if (JSON.stringify(manualDurations) !== JSON.stringify(existing.manualDurations || {})) changedFields.push('durations');
      if (overrideDateTime) changedFields.push('date/time');
      newEditLog.push({ editedAt: new Date().getTime(), changedFields });
    }

    await db.events.update(targetId, {
      type: type || 'Uncategorized',
      symptoms: [...tempSymptomList],
      notes,
      triggers: [...triggers],
      isComplete: true,
      isEdited: !!editingId,
      lastModified: new Date().getTime(),
      manualDurations,
      editedTimers,
      editLog: newEditLog,
      // Keep event.duration in sync with any manual total edit so every view reads the same value
      ...(manualDurations?.total != null ? { duration: manualDurations.total } : {}),
      ...dateTimeOverride,
    });

    reset();
  };

  const handleDeferredSave = async () => {
    const targetId = editingId || activeEventId;
    if (!targetId) throw new Error('No active event to save');

    const existing = await db.events.get(targetId);
    const type = selections.type || existing?.type || 'Uncategorized';
    const modifiedAt = new Date().getTime();

    const dateTimeOverride = overrideDateTime
      ? (() => {
          const newStartTime = new Date(`${overrideDateTime.date}T${overrideDateTime.time}`).getTime();
          return {
            startTime: newStartTime,
            date: new Date(newStartTime).toLocaleDateString(),
            time: new Date(newStartTime).toLocaleTimeString(),
          };
        })()
      : {};

    const newEditLog = existing?.editLog ? [...existing.editLog] : [];
    if (editingId && existing) {
      const changedFields = [];
      if ((type || 'Uncategorized') !== (existing.type || 'Uncategorized')) changedFields.push('type');
      if (notes !== (existing.notes || '')) changedFields.push('notes');
      if (JSON.stringify(triggers) !== JSON.stringify(existing.triggers || [])) changedFields.push('triggers');
      if (JSON.stringify(tempSymptomList) !== JSON.stringify(existing.symptoms || [])) changedFields.push('symptoms');
      if (JSON.stringify(manualDurations) !== JSON.stringify(existing.manualDurations || {})) changedFields.push('durations');
      if (overrideDateTime) changedFields.push('date/time');
      if (changedFields.length) newEditLog.push({ editedAt: modifiedAt, changedFields });
    }
    const didEdit = newEditLog.length > (existing?.editLog?.length || 0);

    await db.events.update(targetId, {
      type: type || 'Uncategorized',
      symptoms: [...tempSymptomList],
      notes,
      triggers: [...triggers],
      isComplete: existing?.isComplete ?? false,
      isEdited: existing?.isEdited || didEdit,
      lastModified: modifiedAt,
      manualDurations,
      editedTimers,
      editLog: newEditLog,
      ...(manualDurations?.total != null ? { duration: manualDurations.total } : {}),
      ...dateTimeOverride,
    });

    reset();
  };

  const reset = () => {
    setNotes('');
    setActiveEventId(null);
    setEditingId(null);
    setTempSymptomList([]);
    setTriggers([]);
    setTaggingStep('TYPE');
    setSelections(EMPTY_SELECTIONS);
    setManualDurationsState({});
    setEditedTimers([]);
    setOverrideDateTimeState(null);
    setIsManualEntry(false);
  };

  const moveSymptom = (index, direction) => {
    const newList = [...tempSymptomList];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setTempSymptomList(newList);
    haptic(40);
  };

  const addQuickNote = (label, elapsed) => {
    const newNote = `[T+${elapsed}s] ${label}`;
    setNotes(prev => prev ? `${prev}\n${newNote}` : newNote);
    haptic(50);
  };

  return {
    taggingStep, setTaggingStep,
    selections, setSelections,
    tempSymptomList, setTempSymptomList,
    notes, setNotes,
    triggers, triggerToggle,
    editingId, activeEventId,
    manualDurations, editedTimers,
    overrideDateTime, isManualEntry,
    setManualDuration,
    setActiveEvent,
    setEventDateTime,
    loadForEdit,
    loadForManualEntry,
    handleFinalSave,
    handleDeferredSave,
    reset,
    moveSymptom,
    addQuickNote
  };
}
