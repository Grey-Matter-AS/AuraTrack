import React, { useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TRIGGERS } from '../data/constants';

// ─── Drag-handle icon — ▲▼ pair signals "drag to reorder" ────
function DragHandle(props) {
  return (
    <div
      {...props}
      className="flex flex-col items-center justify-center shrink-0 cursor-grab active:cursor-grabbing min-w-[44px] min-h-[44px] rounded-lg"
      style={{ touchAction: 'none', color: 'var(--text-dim)', gap: '1px' }}
      aria-label="Drag to reorder"
    >
      <span className="text-[11px] font-black leading-none select-none">▲</span>
      <span className="text-[11px] font-black leading-none select-none">▼</span>
    </div>
  );
}

// ─── One sortable symptom row ─────────────────────────────────
function SortableSymptomRow({ symptom, index, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: symptom._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 rounded-2xl border flex items-center gap-3 shadow-md"
      {...attributes}
    >
      {/* Drag handle — touch-action:none prevents scroll capture on the handle only */}
      <DragHandle {...listeners} />

      <div className="flex-1 min-w-0">
        <p className="text-blue-400 font-black text-sm uppercase tracking-tight leading-none mb-1 truncate">
          {symptom.symptom}
        </p>
        <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
          {symptom.region} › {symptom.specificPart}
        </p>
      </div>

      <button
        onClick={() => onRemove(index)}
        className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-[10px] font-black text-red-500 uppercase rounded-xl border transition-all active:bg-red-600 active:text-white"
        style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)' }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Inline editable timer (phase: aura / seizure / recovery) ─
function EditableTimer({ phase, label, color, calcValue, manualDurations, editedTimers, onSetManualDuration }) {
  const [stage, setStage] = useState('idle'); // idle | confirm | editing
  const [inputVal, setInputVal] = useState('');

  const displayValue = manualDurations?.[phase] ?? calcValue;
  const isEdited     = editedTimers?.includes(phase);

  const startEdit  = () => { setInputVal(String(displayValue)); setStage('editing'); };
  const cancelEdit = () => { setStage('idle'); setInputVal(''); };
  const saveEdit   = () => {
    const val = parseInt(inputVal, 10);
    if (!isNaN(val) && val >= 0) onSetManualDuration(phase, val);
    setStage('idle'); setInputVal('');
  };

  return (
    <div className="text-center">
      <p className="text-[9px] font-black uppercase mb-1" style={{ color }}>{label}</p>

      {stage === 'idle' && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-lg font-mono font-black" style={{ color: 'var(--text-primary)' }}>
            {displayValue}s
            {isEdited && (
              <span className="text-[8px] font-black uppercase ml-1.5 px-1 py-0.5 rounded align-middle"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
                edited
              </span>
            )}
          </p>
          <button
            onClick={() => setStage('confirm')}
            className="min-h-[36px] px-3 rounded-lg text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
          >
            EDIT
          </button>
        </div>
      )}

      {stage === 'confirm' && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold" style={{ color: 'var(--text-dim)' }}>Edit {label.toLowerCase()}?</p>
          <div className="flex gap-1.5 justify-center">
            <button onClick={startEdit}
              className="min-h-[40px] px-3 rounded-lg text-[9px] font-black uppercase bg-amber-500 text-white active:scale-95 transition-transform">
              YES
            </button>
            <button onClick={cancelEdit}
              className="min-h-[40px] px-3 rounded-lg text-[9px] font-black uppercase active:scale-95 transition-transform"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>
              NO
            </button>
          </div>
        </div>
      )}

      {stage === 'editing' && (
        <div className="flex items-center justify-center gap-1.5">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputVal}
            onChange={e => setInputVal(e.target.value.replace(/\D/g, ''))}
            className="w-14 text-center rounded-lg px-1 py-1.5 font-mono font-black outline-none"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }}
            autoFocus
          />
          <span className="text-xs font-bold" style={{ color: 'var(--text-dim)' }}>s</span>
          <button onClick={saveEdit}
            className="min-w-[40px] min-h-[40px] px-2 rounded-lg bg-green-600 text-white font-black text-xs active:scale-95 transition-transform">
            ✓
          </button>
          <button onClick={cancelEdit}
            className="min-w-[40px] min-h-[40px] px-2 rounded-lg font-black text-xs active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
            ✗
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Editable total duration (larger display) ─────────────────
function EditableTotalTimer({ calcValue, manualDurations, editedTimers, onSetManualDuration }) {
  const [stage, setStage] = useState('idle');
  const [inputVal, setInputVal] = useState('');

  const displayValue = manualDurations?.['total'] ?? calcValue;
  const isEdited     = editedTimers?.includes('total');

  const startEdit  = () => { setInputVal(String(displayValue)); setStage('editing'); };
  const cancelEdit = () => { setStage('idle'); setInputVal(''); };
  const saveEdit   = () => {
    const val = parseInt(inputVal, 10);
    if (!isNaN(val) && val >= 0) onSetManualDuration('total', val);
    setStage('idle'); setInputVal('');
  };

  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>
        TOTAL DURATION
      </p>

      {stage === 'idle' && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-4xl font-mono font-black leading-none" style={{ color: 'var(--text-primary)' }}>
            {displayValue}<span className="text-lg font-sans ml-1" style={{ color: 'var(--text-dim)' }}>S</span>
          </p>
          {isEdited && (
            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
              edited
            </span>
          )}
          <button
            onClick={() => setStage('confirm')}
            className="min-h-[36px] px-3 rounded-lg text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
          >
            EDIT
          </button>
        </div>
      )}

      {stage === 'confirm' && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold" style={{ color: 'var(--text-dim)' }}>Edit total duration?</p>
          <div className="flex gap-2">
            <button onClick={startEdit}
              className="min-h-[44px] px-4 rounded-xl text-xs font-black uppercase bg-amber-500 text-white active:scale-95 transition-transform">
              YES, EDIT
            </button>
            <button onClick={cancelEdit}
              className="min-h-[44px] px-4 rounded-xl text-xs font-black uppercase active:scale-95 transition-transform"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {stage === 'editing' && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputVal}
            onChange={e => setInputVal(e.target.value.replace(/\D/g, ''))}
            className="w-24 text-center rounded-xl px-3 py-2 text-2xl font-mono font-black outline-none"
            style={{ backgroundColor: 'var(--bg-raised)', border: '2px solid var(--accent)', color: 'var(--text-primary)' }}
            autoFocus
          />
          <span className="text-lg font-bold" style={{ color: 'var(--text-dim)' }}>s</span>
          <button onClick={saveEdit}
            className="min-h-[44px] px-4 rounded-xl text-sm font-black uppercase bg-green-600 text-white active:scale-95 transition-transform">
            ✓ SAVE
          </button>
          <button onClick={cancelEdit}
            className="min-h-[44px] px-4 rounded-xl text-sm font-black uppercase active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)' }}>
            ✗
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline date/time editor for edit-mode / manual entries ──
function DateTimeOverrideRow({ startTime, overrideDateTime, onSetEventDateTime }) {
  const d   = new Date(startTime || Date.now());
  const pad = n => String(n).padStart(2, '0');
  const defDate = overrideDateTime?.date ?? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const defTime = overrideDateTime?.time ?? `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today   = new Date().toISOString().slice(0, 10);
  const inputSt = { backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

  return (
    <div className="mb-4 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>
        Event Date &amp; Time
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          max={today}
          value={defDate}
          onChange={e => onSetEventDateTime(e.target.value, defTime)}
          className="rounded-xl px-3 py-2 text-sm font-bold outline-none"
          style={inputSt}
        />
        <input
          type="time"
          value={defTime}
          onChange={e => onSetEventDateTime(defDate, e.target.value)}
          className="rounded-xl px-3 py-2 text-sm font-bold outline-none"
          style={inputSt}
        />
      </div>
    </div>
  );
}

// ─── Main Summary component ───────────────────────────────────
function Summary({
  tempSymptomList,
  setTempSymptomList,
  notes,
  setNotes,
  triggers = [],
  onTriggerToggle,
  elapsed,
  laps,
  startTime,
  manualDurations,
  editedTimers,
  onSetManualDuration,
  onAddAnother,
  onSave,
  onCancel,
  onRemoveSymptom,
  // Date/time override (edit mode backdating + manual entry)
  editingId,
  isManualEntry,
  overrideDateTime,
  onSetEventDateTime,
}) {
  const [activeId, setActiveId] = useState(null);

  const auraDur     = laps?.aura    ? Math.floor((laps.aura    - startTime)          / 1000) : 0;
  const seizureDur  = laps?.aura  && laps?.seizure   ? Math.floor((laps.seizure  - laps.aura)    / 1000) : 0;
  const recoveryDur = laps?.seizure && laps?.recovery ? Math.floor((laps.recovery - laps.seizure) / 1000) : 0;

  // When a phase timer is edited, recompute total as sum of all three phases
  const handleSetManualDuration = (phase, val) => {
    onSetManualDuration(phase, val);
    if (phase !== 'total') {
      const a = phase === 'aura'     ? val : (manualDurations?.aura     ?? auraDur);
      const s = phase === 'seizure'  ? val : (manualDurations?.seizure  ?? seizureDur);
      const r = phase === 'recovery' ? val : (manualDurations?.recovery ?? recoveryDur);
      onSetManualDuration('total', a + s + r);
    }
  };

  // Stable IDs for dnd-kit (index-based is fine since list only reorders, never slices)
  const itemsWithId = tempSymptomList.map((s, i) => ({ ...s, _id: `symptom-${i}` }));

  // Activate drag only after 8 px movement to avoid blocking scrolls
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor   = useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } });
  const sensors       = useSensors(pointerSensor, touchSensor);

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = itemsWithId.findIndex(s => s._id === active.id);
    const newIndex = itemsWithId.findIndex(s => s._id === over.id);
    setTempSymptomList(arrayMove(tempSymptomList, oldIndex, newIndex));
  };

  const activeSymptom = activeId ? itemsWithId.find(s => s._id === activeId) : null;

  return (
    <div className="flex flex-col h-full w-full max-w-md sm:max-w-xl md:max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-6 px-1 overflow-hidden">

      {/* 1. CLINICAL DURATION BREAKDOWN */}
      <div className="p-5 rounded-[2.5rem] border mb-4 shrink-0 shadow-lg"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>

        {/* Date/time override row — shown when editing or logging past seizure */}
        {(editingId || isManualEntry) && onSetEventDateTime && (
          <DateTimeOverrideRow
            startTime={startTime}
            overrideDateTime={overrideDateTime}
            onSetEventDateTime={onSetEventDateTime}
          />
        )}

        <div className="flex justify-between items-start mb-4">
          <EditableTotalTimer
            calcValue={elapsed}
            manualDurations={manualDurations}
            editedTimers={editedTimers}
            onSetManualDuration={onSetManualDuration}
          />
          <div className="text-right shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>LOG STATUS</p>
            <p className="text-xs font-black text-green-500 uppercase tracking-tighter">VERIFIED</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <EditableTimer phase="aura"     label="AURA"     color="#f59e0b"
            calcValue={auraDur}     manualDurations={manualDurations} editedTimers={editedTimers} onSetManualDuration={handleSetManualDuration} />
          <EditableTimer phase="seizure"  label="SEIZURE"  color="#ef4444"
            calcValue={seizureDur}  manualDurations={manualDurations} editedTimers={editedTimers} onSetManualDuration={handleSetManualDuration} />
          <EditableTimer phase="recovery" label="RECOVERY" color="#60a5fa"
            calcValue={recoveryDur} manualDurations={manualDurations} editedTimers={editedTimers} onSetManualDuration={handleSetManualDuration} />
        </div>
      </div>

      {/* 2. SCROLLABLE MIDDLE AREA */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar pb-6">

        {/* Symptom list with drag-to-reorder */}
        <div>
          <p className="text-center font-black uppercase text-[11px] tracking-[0.3em] mb-1" style={{ color: 'var(--text-faint)' }}>
            LOGGED SYMPTOMS
          </p>
          {tempSymptomList.length > 1 && (
            <p className="text-center text-[9px] mb-3" style={{ color: 'var(--text-faint)' }}>
              Hold &amp; drag ≡ to reorder
            </p>
          )}

          {tempSymptomList.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed rounded-[2rem]" style={{ borderColor: 'var(--border)' }}>
              <p className="italic text-sm" style={{ color: 'var(--text-faint)' }}>No symptoms tagged yet.</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={itemsWithId.map(s => s._id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {itemsWithId.map((symptom, index) => (
                    <SortableSymptomRow
                      key={symptom._id}
                      symptom={symptom}
                      index={index}
                      onRemove={onRemoveSymptom}
                    />
                  ))}
                </div>
              </SortableContext>

              {/* Ghost while dragging */}
              <DragOverlay>
                {activeSymptom && (
                  <div className="p-3 rounded-2xl border flex items-center gap-3 shadow-2xl opacity-90"
                    style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--accent)' }}>
                    <DragHandle />
                    <div className="flex-1 min-w-0">
                      <p className="text-blue-400 font-black text-sm uppercase tracking-tight leading-none truncate">
                        {activeSymptom.symptom}
                      </p>
                      <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                        {activeSymptom.region} › {activeSymptom.specificPart}
                      </p>
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Trigger chips */}
        <div className="w-full">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3 ml-1" style={{ color: 'var(--text-dim)' }}>
            POSSIBLE TRIGGERS <span className="font-normal normal-case tracking-normal" style={{ color: 'var(--text-faint)' }}>(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {TRIGGERS.map(t => {
              const selected = triggers.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => onTriggerToggle?.(t)}
                  className="px-3 py-2 rounded-full text-[11px] font-black uppercase tracking-wide transition-all active:scale-95"
                  style={selected
                    ? { backgroundColor: 'var(--accent)', color: '#fff', border: '1.5px solid var(--accent)' }
                    : { backgroundColor: 'transparent', color: 'var(--text-dim)', border: '1.5px solid var(--border)' }
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="w-full">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3 ml-1" style={{ color: 'var(--text-dim)' }}>
            CLINICAL OBSERVATIONS
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full rounded-[2rem] p-5 text-base min-h-[140px] outline-none transition-all resize-none"
            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            placeholder="Add triggers, medication info, or post-ictal signs..."
          />
        </div>
      </div>

      {/* 3. FIXED BOTTOM ACTIONS */}
      <div className="flex flex-col gap-3 py-4 shrink-0"
        style={{ borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
        <button
          onClick={onAddAnother}
          className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          + ADD ANOTHER SYMPTOM
        </button>

        <button
          onClick={onSave}
          className="w-full py-6 bg-green-600 text-white rounded-[2.2rem] font-black uppercase text-sm tracking-[0.2em] shadow-xl active:scale-95 transition-transform"
        >
          FINISH & SAVE LOG
        </button>

        <button
          onClick={onCancel}
          className="w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:bg-red-600 active:text-white transition-all"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.4)', color: '#ef4444' }}
        >
          CANCEL & DISCARD
        </button>
      </div>
    </div>
  );
}

export default Summary;
