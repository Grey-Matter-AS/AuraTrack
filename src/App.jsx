import React, { useState, useEffect } from 'react';
import { db } from './db';
import { SYMPTOM_WIZARD, REGION_WIZARD } from './constants';
import { DeleteModal, WizardMenu } from './components/Shared';
import Summary from './components/Summary';
import RecordingView from './components/RecordingView';

function App() {
  const [status, setStatus] = useState('IDLE');
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState([]);
  const [taggingStep, setTaggingStep] = useState('TYPE'); 
  const [tempSymptomList, setTempSymptomList] = useState([]);
  const [notes, setNotes] = useState("");
  const [userMode, setUserMode] = useState('CARETAKER'); // Switch to 'PATIENT' to test single button
  const [laps, setLaps] = useState({ aura: null, seizure: null, recovery: null });


  const [selections, setSelections] = useState({
    type:'', group: '', symptom: '', detail: '',
    region: '', subRegion: '', specificPart: ''
  });

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [editingId, setEditingId] = useState(null);


  // Effect 1: The "Memory Check" (Runs once on startup)
  useEffect(() => {
    const savedStart = localStorage.getItem('aura_startTime');
    const savedStatus = localStorage.getItem('aura_status');

    if (savedStatus === 'RECORDING' && savedStart) {
      const startTimeParsed = parseInt(savedStart);
      setStartTime(startTimeParsed);
      setStatus('RECORDING');
      setElapsed(Math.floor((Date.now() - startTimeParsed) / 1000));
    }
  }, []);

  // Effect 2: The "Timer Tick" (Runs whenever status changes)
  useEffect(() => {
    let interval;
    if (status === 'RECORDING') {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, startTime]); 

  const startRecording = () => {
     // Clear all temporary data for the new session
    setEditingId(null);
    setTempSymptomList([]);
    setNotes(""); 
    
    const now = Date.now();
    const startTimeReadable = new Date(now).toLocaleTimeString();
    const startDateReadable = new Date(now).toLocaleDateString();

    setStartTime(now);
    setElapsed(0);
    setStatus('RECORDING');

    localStorage.setItem('aura_startTime', now);
    localStorage.setItem('aura_status', 'RECORDING');
    localStorage.setItem('aura_startDateReadable', startDateReadable);
    localStorage.setItem('aura_startTimeReadable', startTimeReadable);
  };

  const stopRecording = async () => {
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    // 1. Finalize the 'recovery' lap automatically if it wasn't marked
    const finalLaps = { ...laps, recovery: endTime };

    // 2. Build the data object
    const eventData = {
      startTime: startTime,
      endTime: endTime,
      duration: duration,
      laps: finalLaps, // Save the aura/seizure/recovery timestamps
      userModeAtTime: userMode, // Useful for Phase 6 reports
      date: localStorage.getItem('aura_startDateReadable'),
      time: localStorage.getItem('aura_startTimeReadable'),
      type: 'Uncategorized',
      isComplete: false, // Remains false until the Summary/Tagging is done
      editLog: [] // Prep for Phase 4
    };

    // 3. Save to DB and clear local storage
    await db.events.add(eventData);
    localStorage.clear();
    
    // 4. Move to tagging state
    setStatus('TAGGING');
  };


  const loadHistory = async () => {
    const allEvents = await db.events.orderBy('startTime').reverse().limit(5).toArray();
    setHistory(allEvents);
  };

  useEffect(() => {
    if (status === 'IDLE') {
      loadHistory();
    }
  }, [status]);

  const confirmDelete = async () => {
   if (itemToDelete) {
      await db.events.delete(itemToDelete);
      await loadHistory();
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    }
  };

  const startEdit = (event) => {
    setEditingId(event.id);
    setElapsed(event.duration); // Set the timer display to the saved duration
    setTempSymptomList(event.symptoms || []);
    setNotes(event.notes || ""); // Populate notes
    setTaggingStep('SUMMARY'); // Jumps to the Summary screen
    setStatus('TAGGING');
  };

  const handleFinalSave = async () => {
    const lastEntry = await db.events.toCollection().last();
    const targetId = editingId || lastEntry.id;

    await db.events.update(targetId, { 
      type: selections.type || (editingId ? (history.find(e => e.id === editingId)?.type) : 'Uncategorized'),
      symptoms: [...tempSymptomList],
      notes: notes,
      isComplete: true,
      isEdited: !!editingId,
      lastModified: Date.now()
    });
    setNotes("");
    await loadHistory();
    setStatus('IDLE');
    setEditingId(null); 
    setTempSymptomList([]);
    setTaggingStep('TYPE');
    setSelections({ type: '', group: '', symptom: '', detail: '', region: '', subRegion: '', specificPart: '' });
    setLaps({ aura: null, seizure: null, recovery: null });
  };

  const handleCancel = () => {
    setNotes("");
    setEditingId(null);
    setTempSymptomList([]);
    setTaggingStep('TYPE');
    setStatus('IDLE');
    setSelections({ type: '', group: '', symptom: '', detail: '', region: '', subRegion: '', specificPart: '' });
    setLaps({ aura: null, seizure: null, recovery: null });
  };

  const recordLap = (phase) => {
    const now = Date.now();
    setLaps(prev => ({ ...prev, [phase]: now }));
    
    if ("vibrate" in navigator) {
      navigator.vibrate(100); // Haptic Confirmation (Phase 2 Rule)
    }
  };

  const addQuickNote = (label) => {
    // Uses the current 'elapsed' timer value for the timestamp
    const newNote = `[T+${elapsed}s] ${label}`;
    
    setNotes(prev => prev ? `${prev}\n${newNote}` : newNote);
    
    if ("vibrate" in navigator) {
      navigator.vibrate(50); // Haptic feedback
    }
  };

  const moveSymptom = (index, direction) => {
    const newList = [...tempSymptomList];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;

    // Boundary check: don't move past the start or end of the list
    if (targetIndex < 0 || targetIndex >= newList.length) return;

    // Swap the items
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    
    setTempSymptomList(newList);
    if ("vibrate" in navigator) navigator.vibrate(40);
  };



  return (
  /* Updated: Fixed height and locked overflow for Native App feel */
  <div className="flex flex-col h-screen w-full bg-[#0f172a] font-sans text-slate-100 overflow-hidden select-none">
    
    {/* 1. Header (Updated to Clinical Standard) */}
    <div className="pt-8 pb-2 text-center shrink-0">
      <h1 className="text-[10px] font-black tracking-[0.4em] text-slate-600 uppercase opacity-50">
        AURATRACK
      </h1>
      <div className="h-1 w-4 bg-red-600 mx-auto mt-1 rounded-full opacity-40"></div>
    </div>

    {/* 2. Main Content Area (Updated: overflow-hidden so children handle the scrolling) */}
    <div className="flex-1 flex flex-col items-center px-6 overflow-hidden pb-8">
      
      {/* IDLE STATE */}
      {status === 'IDLE' && (
        /* flex-1 and overflow-y-auto here allows ONLY the history to scroll */
        <div className="flex-1 flex flex-col items-center w-full max-w-md overflow-hidden">
          <div className="py-10 shrink-0">
            <button 
              onClick={startRecording}
              className="w-60 h-60 bg-red-600 hover:bg-red-500 active:scale-95 transition-all rounded-full shadow-[0_0_60px_rgba(225,29,72,0.4)] flex items-center justify-center text-white text-4xl font-black border-[12px] border-[#1e293b] ring-4 ring-red-900/20"
            >
              START
            </button>
          </div>

          <div className="w-full flex-1 flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-4 px-2 shrink-0">
              <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Recent Events</h3>
              {history.length > 0 && (
                <span className="text-[9px] text-slate-600 font-bold bg-slate-900 px-2 py-1 rounded">LAST 5</span>
              )}
            </div>
            
            <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar">
              {history.length === 0 ? (
                <div className="border-2 border-dashed border-slate-800 rounded-3xl py-8 text-center">
                  <p className="text-slate-600 italic text-sm">No events recorded yet.</p>
                </div>

                ) : (
                  history.map((event) => (
                    <div key={event.id} className="bg-[#1e293b] p-4 rounded-2xl border border-slate-700/50 flex justify-between items-center shadow-lg group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-bold">{event.type || 'Unknown'}</p>
                          {event.isEdited && <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold">Edited</span>}
                        </div>
                        <p className="text-slate-500 text-[11px] font-medium">{event.date} • {event.time}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="bg-[#0f172a] px-3 py-1 rounded-lg border border-slate-800 mr-2">
                          <span className="text-red-500 font-mono font-black text-lg">{event.duration}s</span>
                        </div>
                        
                        {/* Text-based Buttons */}
                        <button 
                          onClick={() => startEdit(event)}
                          className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase px-2 py-1 border border-blue-900/50 rounded tracking-wider"
                        >
                          View / Edit
                        </button>
                        
                        <button 
                          onClick={() => { setItemToDelete(event.id); setIsDeleteModalOpen(true); }}
                          className="text-[10px] font-bold text-red-500 hover:text-red-400 uppercase px-2 py-1 border border-red-900/50 rounded tracking-wider"
                        >
                          Delete
                        </button>
                      </div>    
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* RECORDING STATE */}
        {status === 'RECORDING' && (
          <RecordingView 
            elapsed={elapsed}
            startTime={startTime}
            laps={laps}
            onLap={recordLap}
            onStop={stopRecording}
            onQuickNote={addQuickNote}
            userMode={userMode}
          />
        )}
        {/* TAGGING STATE */}
        {status === 'TAGGING' && (
          /* 1. Added h-[calc(100dvh-2rem)] to keep the container inside the screen mobile-safely */
          <div className="flex-1 flex flex-col items-center w-full max-w-md h-[calc(100dvh-2rem)] overflow-hidden animate-in fade-in slide-in-from-bottom-6">
            
            {/* Wizard Card */}
            {/* 2. Added min-h-0: This is the flexbox "secret sauce" that allows a child to shrink below its content size */}
            <div className="w-full h-full min-h-0 bg-[#1e293b] p-6 rounded-[2rem] shadow-2xl border border-slate-700/50 flex flex-col overflow-hidden">
                        
              {/* 3. The Scroll Container */}
              {/* This wraps all your steps and ensures that if WizardMenu or Summary is tall, it scrolls HERE instead of pushing the card down */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                  
                  {/* 1. SEIZURE TYPE (Step 1) */}
                  {taggingStep === 'TYPE' && (
                    <WizardMenu 
                      title="Step 1: Seizure Type" 
                      options={['Tonic-Clonic', 'Focal Aware', 'Focal Impaired', 'Absence', 'Aura Only']}
                      onPick={async (val) => {
                        const targetId = editingId || (await db.events.toCollection().last()).id;
                        await db.events.update(targetId, { type: val });
                        setSelections({ ...selections, type: val });
                        setTaggingStep('S_CAT');
                        await loadHistory();
                      }} 
                    />
                  )}

                {/* 2. SYMPTOM DRILL-DOWN (3 Layers) */}
                {taggingStep === 'S_CAT' && (
                  <WizardMenu title="What kind of feeling?" options={Object.keys(SYMPTOM_WIZARD)} 
                    onPick={(v) => { setSelections({...selections, group: v}); setTaggingStep('S_SYM'); }} />
                )}
                {taggingStep === 'S_SYM' && (
                  <WizardMenu title={selections.group} options={Object.keys(SYMPTOM_WIZARD[selections.group])}
                    onPick={(v) => { setSelections({...selections, symptom: v}); setTaggingStep('S_DET'); }}
                    onBack={() => setTaggingStep('S_CAT')} />
                )}
                {taggingStep === 'S_DET' && (
                  <WizardMenu 
                    title={selections.symptom} 
                    options={SYMPTOM_WIZARD[selections.group][selections.symptom].options.map(o => o.label)}
                    onPick={(label) => { 
                      const optionObj = SYMPTOM_WIZARD[selections.group][selections.symptom].options.find(o => o.label === label);
                      const groupConfig = SYMPTOM_WIZARD[selections.group][selections.symptom];

                      const updatedSelections = { 
                        ...selections, 
                        detail: label, 
                        medical: optionObj.med,
                        region: optionObj.forceRegion || '',
                        subRegion: optionObj.forceSubRegion || '' 
                      };
                      setSelections(updatedSelections);

                      // 🚀 DIRECT TELEPORT LOGIC
                      if (optionObj.forceSubRegion) {
                        // Jump straight to the final parts list (e.g., Left Eye, Right Eye, Both Eyes)
                        setTaggingStep('R_DET'); 
                        return;
                      }

                      // STANDARD SMART BRANCHING
                      if (groupConfig.skipRegion) {
                        const bundle = { 
                          symptom: selections.symptom, 
                          detail: label, 
                          medical: optionObj.med,
                          region: "N/A", 
                          specificPart: "Internal/General" 
                        };
                        setTempSymptomList([...tempSymptomList, bundle]);
                        setTaggingStep('SUMMARY');
                      } 
                      else if (optionObj.forceRegion) {
                        // Jumps to Sub-Category selection (e.g. Eyes, Mouth, Cheeks)
                        setTaggingStep('R_SUB'); 
                      } 
                      else {
                        // Standard Manual Path
                        setTaggingStep('R_CAT'); 
                      }
                    }}

                    onBack={() => setTaggingStep('S_SYM')} 
                  />
                )}

                {/* 3. REGION DRILL-DOWN (3 Layers) */}
                {taggingStep === 'R_CAT' && (
                  <WizardMenu title="Where did it happen?" options={Object.keys(REGION_WIZARD)}
                    onPick={(v) => { setSelections({...selections, region: v}); setTaggingStep('R_SUB'); }} />
                )}
                {taggingStep === 'R_SUB' && (
                  <WizardMenu 
                    title={selections.region} 
                    /* 🚀 This pulls the correct list (e.g., Head & Face -> Eyes, Mouth) */
                    options={Object.keys(REGION_WIZARD[selections.region])}
                    onPick={(v) => { 
                      setSelections({...selections, subRegion: v}); 
                      setTaggingStep('R_DET'); 
                    }}
                    onBack={() => {
                      // If we got here via a shortcut, 'Back' should take us to symptoms
                      const optionObj = SYMPTOM_WIZARD[selections.group][selections.symptom].options.find(o => o.label === selections.detail);
                      if (optionObj.forceRegion) {
                        setTaggingStep('S_DET');
                      } else {
                        setTaggingStep('R_CAT');
                      }
                    }} 
                  />
                )}
                {taggingStep === 'R_DET' && (
                  <WizardMenu title={selections.subRegion} options={REGION_WIZARD[selections.region][selections.subRegion]}
                    onPick={(v) => {
                      const bundle = { 
                        symptom: selections.symptom, detail: selections.detail, 
                        region: selections.region, specificPart: v 
                      };
                      setTempSymptomList([...tempSymptomList, bundle]);
                      setTaggingStep('SUMMARY');
                    }}
                    onBack={() => {
                      const optionObj = SYMPTOM_WIZARD[selections.group][selections.symptom].options.find(o => o.label === selections.detail);
                      // If we teleported here, go back to Symptom Details
                      if (optionObj.forceSubRegion) {
                        setTaggingStep('S_DET');
                      } else {
                        setTaggingStep('R_SUB');
                      }
                    }}
                    />
                )}

                {/* 4. SUMMARY / LOOP HUB */}
                {taggingStep === 'SUMMARY' && (
                  <Summary 
                    tempSymptomList={tempSymptomList}
                    setTempSymptomList={setTempSymptomList}
                    notes={notes}
                    setNotes={setNotes}
                    elapsed={elapsed}
                    laps={laps}
                    startTime={startTime}
                    onAddAnother={() => setTaggingStep('S_CAT')}
                    onSave={handleFinalSave}
                    onCancel={handleCancel}
                    onRemoveSymptom={(index) => {
                      // We create a new list excluding the item at the clicked index
                      const newList = tempSymptomList.filter((_, i) => i !== index);
                      setTempSymptomList(newList);
                    }} 
                    onMoveSymptom={moveSymptom}
                  />
                )}
                </div>
            </div>
          </div>
        )}
      </div>

          {isDeleteModalOpen && (
            <DeleteModal 
              onConfirm={confirmDelete} 
              onCancel={() => setIsDeleteModalOpen(false)} 
            />
          )}
  </div>
);
}


export default App;
