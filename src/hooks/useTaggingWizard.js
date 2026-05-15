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

  const setActiveEvent = (id) => {
    setActiveEventId(id);
  };

  const setManualDuration = (phase, seconds) => {
    setManualDurationsState(prev => ({ ...prev, [phase]: seconds }));
    setEditedTimers(prev => prev.includes(phase) ? prev : [...prev, phase]);
  };

  const loadForEdit = (event) => {
    setEditingId(event.id);
    setActiveEventId(event.id);
    setTempSymptomList(event.symptoms || []);
    setNotes(event.notes || '');
    setManualDurationsState(event.manualDurations || {});
    setEditedTimers(event.editedTimers || []);
    setTaggingStep('SUMMARY');
  };

  const handleFinalSave = async () => {
    const targetId = editingId || activeEventId;
    if (!targetId) throw new Error('No active event to save');

    let type = selections.type;
    if (!type && editingId) {
      const existing = await db.events.get(editingId);
      type = existing?.type || 'Uncategorized';
    }

    await db.events.update(targetId, {
      type: type || 'Uncategorized',
      symptoms: [...tempSymptomList],
      notes,
      isComplete: true,
      isEdited: !!editingId,
      lastModified: Date.now(),
      manualDurations,
      editedTimers,
      // Keep event.duration in sync with any manual total edit so every view reads the same value
      ...(manualDurations?.total != null ? { duration: manualDurations.total } : {}),
    });

    reset();
  };

  const reset = () => {
    setNotes('');
    setActiveEventId(null);
    setEditingId(null);
    setTempSymptomList([]);
    setTaggingStep('TYPE');
    setSelections(EMPTY_SELECTIONS);
    setManualDurationsState({});
    setEditedTimers([]);
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
    editingId, activeEventId,
    manualDurations, editedTimers,
    setManualDuration,
    setActiveEvent,
    loadForEdit,
    handleFinalSave,
    reset,
    moveSymptom,
    addQuickNote
  };
}
