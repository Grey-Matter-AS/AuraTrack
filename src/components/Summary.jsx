import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '../utils/formatters';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TRIGGERS } from '../data/constants';
import { CheckIcon, CloseIcon, EditIcon, GripIcon, TrashIcon } from './AppIcons';

const POST_ICTAL_FINDINGS = [
  'Confusion',
  'Sleepiness',
  'Weakness',
  'Speech difficulty',
];

// ─── Drag handle ───────────────────────────────────────────────
function DragHandle(props) {
  const { t } = useTranslation();
  return (
    <div
      {...props}
      className="flex flex-col items-center justify-center shrink-0 cursor-grab active:cursor-grabbing min-w-[44px] min-h-[44px] rounded-lg"
      style={{ touchAction: 'none', color: 'var(--text-dim)', gap: '1px' }}
      aria-label={t('summary.drag_to_reorder')}
    >
      <GripIcon className="w-4 h-4" />
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
        <p className="text-sm uppercase tracking-tight leading-none mb-1 truncate" style={{ color: 'var(--action-blue)' }}>
          {symptom.symptom}
        </p>
        <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
          {symptom.region} › {symptom.specificPart}
        </p>
      </div>

      <button
        onClick={() => onRemove(index)}
        className="app-icon-action app-icon-action--danger shrink-0"
        aria-label="Remove symptom"
      >
        <TrashIcon className="w-4 h-4" />
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
              <span className="app-status-badge app-status-badge--info ml-1.5 align-middle !px-1.5 !py-0.5 !text-[8px]">
                edited
              </span>
            )}
          </p>
          <button
            onClick={() => setStage('confirm')}
            className="app-icon-action app-icon-action--accent !min-h-[36px] !min-w-0 !px-3 !text-[9px]"
          >
            <EditIcon className="w-3.5 h-3.5 shrink-0" />
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
            <CheckIcon className="w-4 h-4" />
          </button>
          <button onClick={cancelEdit}
            className="min-w-[40px] min-h-[40px] px-2 rounded-lg font-black text-xs active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}>
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Editable total duration (larger display) ─────────────────
function EditableTotalTimer({ calcValue, manualDurations, editedTimers, onSetManualDuration, durationFormat = 'seconds' }) {
  const { t } = useTranslation();
  const fmtDur = (s) => durationFormat === 'human' ? formatDuration(s) : `${s}s`;
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
            {fmtDur(displayValue)}
          </p>
          {isEdited && (
            <span className="app-status-badge app-status-badge--info !px-1.5 !py-0.5 !text-[8px]">
              edited
            </span>
          )}
          <button
            onClick={() => setStage('confirm')}
            className="app-icon-action app-icon-action--accent !min-h-[36px] !min-w-0 !px-3 !text-[9px]"
          >
            <EditIcon className="w-3.5 h-3.5 shrink-0" />
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
            <CheckIcon className="w-4 h-4 inline-block mr-1.5 align-[-3px]" /> {t('summary.save')}
          </button>
          <button onClick={cancelEdit}
            className="min-h-[44px] px-4 rounded-xl text-sm font-black uppercase active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}>
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Inline date/time editor for edit-mode / manual entries ──
function DateTimeOverrideRow({ startTime, overrideDateTime, onSetEventDateTime }) {
  const { t } = useTranslation();
  const [fallbackStartTime] = useState(() => Date.now());
  const d   = new Date(startTime || fallbackStartTime);
  const pad = n => String(n).padStart(2, '0');
  const defDate = overrideDateTime?.date ?? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const defTime = overrideDateTime?.time ?? `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const today   = new Date().toISOString().slice(0, 10);
  const inputSt = { backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

  return (
    <div className="mb-4 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-faint)' }}>
        {t('summary.event_datetime')}
      </p>
      <div className="flex gap-2 date-time-row">
        <input
          type="date"
          max={today}
          value={defDate}
          onChange={e => onSetEventDateTime(e.target.value, defTime)}
          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm font-bold outline-none"
          style={inputSt}
        />
        <input
          type="time"
          value={defTime}
          onChange={e => onSetEventDateTime(defDate, e.target.value)}
          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm font-bold outline-none"
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
  postIctal = { findings: [], paralysisLocations: [] },
  onTogglePostIctalFinding,
  onEditPostIctalParalysis,
  onRemovePostIctalParalysisLocation,
  elapsed,
  laps,
  startTime,
  manualDurations,
  editedTimers,
  onSetManualDuration,
  onAddAnother,
  onSaveFavorite,
  onSave,
  onSkip,
  onCancel,
  onRemoveSymptom,
  // Date/time override (edit mode backdating + manual entry)
  editingId,
  isManualEntry,
  overrideDateTime,
  onSetEventDateTime,
  durationFormat = 'seconds',
}) {
  const { t } = useTranslation();
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
    <div className="flex flex-col w-full mx-auto px-1">

      {/* 1. CLINICAL DURATION BREAKDOWN */}
      <div className="app-surface-card p-5 mb-5">

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
            durationFormat={durationFormat}
          />
          <div className="text-right shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-dim)' }}>LOG STATUS</p>
            <p className="app-status-badge app-status-badge--success">VERIFIED</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <EditableTimer phase="aura"     label="AURA"     color="#f59e0b"
            calcValue={auraDur}     manualDurations={manualDurations} editedTimers={editedTimers} onSetManualDuration={handleSetManualDuration} />
          <EditableTimer phase="seizure"  label="SEIZURE"  color="#ef4444"
            calcValue={seizureDur}  manualDurations={manualDurations} editedTimers={editedTimers} onSetManualDuration={handleSetManualDuration} />
          <EditableTimer phase="recovery" label="RECOVERY" color="var(--action-blue)"
            calcValue={recoveryDur} manualDurations={manualDurations} editedTimers={editedTimers} onSetManualDuration={handleSetManualDuration} />
        </div>
      </div>

      {/* 2. MIDDLE CONTENT */}
      <div className="space-y-5 pb-6">

        {/* Symptom list with drag-to-reorder */}
        <div className="app-section-card">
          <p className="text-center font-black uppercase text-[11px] tracking-[0.3em] mb-1" style={{ color: 'var(--text-faint)' }}>
            LOGGED SYMPTOMS
          </p>
          {tempSymptomList.length > 1 && (
            <p className="text-center text-[9px] mb-4" style={{ color: 'var(--text-faint)' }}>
              Hold &amp; drag ≡ to reorder
            </p>
          )}

          {tempSymptomList.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed rounded-[1.5rem]" style={{ borderColor: 'var(--border)' }}>
              <p className="italic text-sm" style={{ color: 'var(--text-faint)' }}>{t('tagging.no_ictal_symptoms', 'No ictal symptoms tagged yet.')}</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={itemsWithId.map(s => s._id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
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
                      <p className="text-sm uppercase tracking-tight leading-none truncate" style={{ color: 'var(--action-blue)' }}>
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

          <div className="app-balanced-grid mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={onAddAnother}
              className="app-action-tile app-action-tile--compact app-action-tile--center font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
            >
              <span className="app-chip-text">+ ADD ANOTHER SYMPTOM</span>
            </button>

            {onSaveFavorite && tempSymptomList.length > 0 && (
              <button
                onClick={onSaveFavorite}
                className="app-action-tile app-action-tile--compact app-action-tile--center font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all"
                style={{ backgroundColor: 'var(--action-blue)', color: '#fff', border: '1px solid var(--action-blue-border)' }}
              >
                <span className="app-chip-text">Save Current Symptoms as Favorite Set</span>
              </button>
            )}
          </div>
        </div>

        {/* Post-ictal findings */}
        <div className="app-section-card w-full">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3 ml-1" style={{ color: 'var(--text-dim)' }}>
            {t('tagging.post_ictal_findings', 'After-seizure symptoms')} <span className="font-normal normal-case tracking-normal" style={{ color: 'var(--text-faint)' }}>({t('tagging.recovery_phase', 'recovery phase')})</span>
          </p>
          <div className="app-choice-grid--compact mb-4">
            {POST_ICTAL_FINDINGS.map((finding) => {
              const selected = postIctal.findings.includes(finding);
              return (
                <button
                  key={finding}
                  onClick={() => onTogglePostIctalFinding?.(finding)}
                  className="app-action-tile app-action-tile--compact app-action-tile--center text-[11px] font-black tracking-wide transition-all active:scale-95"
                  style={selected
                    ? { backgroundColor: 'var(--action-blue)', color: '#fff', border: '1.5px solid var(--action-blue-border)' }
                    : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1.5px solid var(--border)' }}
                >
                  <span className="app-chip-text">{finding}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-[1.5rem] p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>{t('tagging.post_ictal_paralysis', 'After-seizure paralysis')}</p>
              </div>
              <button
                onClick={onEditPostIctalParalysis}
                className="shrink-0 min-h-[40px] px-3 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                {t('tagging.add_area', '+ Add Area')}
              </button>
            </div>

            {postIctal.paralysisLocations.length === 0 ? (
              <p className="text-[11px] mb-3" style={{ color: 'var(--text-faint)' }}>
                {t('tagging.no_paralysis_areas', 'No paralysis areas logged.')}
              </p>
            ) : (
              <div className="space-y-2 mb-3">
                {postIctal.paralysisLocations.map((location, index) => (
                  <div key={`${location.region}-${location.subRegion}-${location.specificPart}-${index}`} className="flex items-center gap-3 rounded-2xl px-3 py-2" style={{ backgroundColor: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--action-blue)' }}>
                        {t('tagging.todds_paralysis', "Todd's paralysis")}
                      </p>
                      <p className="text-[11px] leading-snug break-words" style={{ color: 'var(--text-secondary)' }}>
                        {location.region} › {location.subRegion} › {location.specificPart}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemovePostIctalParalysisLocation?.(index)}
                      className="app-icon-action app-icon-action--danger shrink-0"
                      aria-label={t('tagging.remove_area', 'Remove area')}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
              {t('tagging.post_ictal_paralysis_help', "Record Todd's paralysis with exact affected body parts.")}
            </p>
          </div>
        </div>

        {/* Trigger chips */}
        <div className="app-section-card w-full">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3 ml-1" style={{ color: 'var(--text-dim)' }}>
            POSSIBLE TRIGGERS <span className="font-normal normal-case tracking-normal" style={{ color: 'var(--text-faint)' }}>(optional)</span>
          </p>
          <div className="app-choice-grid--compact">
            {TRIGGERS.map(t => {
              const selected = triggers.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => onTriggerToggle?.(t)}
                  className="app-action-tile app-action-tile--compact app-action-tile--center text-[11px] font-black uppercase tracking-wide transition-all active:scale-95"
                  style={selected
                    ? { backgroundColor: 'var(--action-blue)', color: '#fff', border: '1.5px solid var(--action-blue-border)' }
                    : { backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1.5px solid var(--border)' }
                  }
                >
                  <span className="app-chip-text">{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="app-section-card w-full">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3 ml-1" style={{ color: 'var(--text-dim)' }}>
            CLINICAL OBSERVATIONS
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full rounded-[2rem] p-5 text-base min-h-[140px] outline-none transition-all resize-none"
            style={{ backgroundColor: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            placeholder={t('event_card.notes_placeholder')}
          />
        </div>
      </div>

      {/* 3. BOTTOM ACTIONS */}
      <div className="app-section-card mt-2">
        <button
          onClick={onSave}
          className="w-full min-h-[4.75rem] px-5 bg-green-600 text-white rounded-[1.85rem] font-black uppercase text-sm tracking-[0.2em] shadow-xl active:scale-95 transition-transform"
        >
          FINISH & SAVE LOG
        </button>

        <div className="app-balanced-grid mt-3">
          {onSkip && (
            <button
              onClick={onSkip}
              className="app-action-tile app-action-tile--compact app-action-tile--center font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              style={{ backgroundColor: '#334155', border: '2px solid #f59e0b', color: '#facc15' }}
            >
              {t('tagging.save_timing_only')}
            </button>
          )}

          <button
            onClick={onCancel}
            className="app-action-tile app-action-tile--compact app-action-tile--center font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
            style={{ backgroundColor: '#dc2626', border: '2px solid #991b1b', color: '#fff' }}
          >
            CANCEL & DISCARD
          </button>
        </div>
      </div>
    </div>
  );
}

export default Summary;
