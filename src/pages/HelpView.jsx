import React, { useState } from 'react';
import { ScrollFade } from '../components/ScrollFade';

const SECTIONS = [
  {
    id: 'recording',
    title: 'Recording a Seizure',
    steps: [
      'Tap the large START button when a seizure begins.',
      'In Caretaker mode, tap the phase buttons (End Aura, End Seizure) as each phase transitions. In Self mode the interface is simplified to a single stop button.',
      'Tap + Event Note to stamp a timestamped note mid-recording — use the shortcut buttons for common events like Fell, Rescue Med given, Not Responding, etc.',
      'Tap STOP when the seizure ends. If the timer is still running at 12 minutes, the recording stops automatically and the event is saved.',
    ],
  },
  {
    id: 'tagging',
    title: 'Tagging Events',
    steps: [
      'After stopping, a tagging wizard opens automatically.',
      'Select the seizure type, affected body regions, and any symptoms observed.',
      'Add free-text notes, then tap SAVE. You can edit any event later from History.',
    ],
  },
  {
    id: 'manual',
    title: 'Manual Entry',
    steps: [
      'Tap + Log Past Seizure on the home screen to enter a seizure you did not record in real time.',
      'Set the date, time, and duration, then complete the tagging wizard as usual.',
    ],
  },
  {
    id: 'medications',
    title: 'Medication Tracking',
    steps: [
      'Add your medications in Settings → Medications.',
      'The home screen shows today\'s scheduled doses — tap each medication button to toggle it, then tap Save to log the doses.',
      'Enable dose reminders per medication in Settings → Medications.',
    ],
  },
  {
    id: 'history',
    title: 'History & Export',
    steps: [
      'Open HISTORY to browse, search, and filter all recorded events.',
      'Tap any event to view full detail or edit it.',
      'Use EXPORT (from History) to generate a PDF neurologist report, CSV, or JSON backup.',
    ],
  },
  {
    id: 'settings',
    title: 'Settings & Accessibility',
    steps: [
      'Switch between Self and Caretaker mode in Settings to adjust the interface.',
      'Change theme, font size, and accent colour to suit your preferences.',
      'Add your neurologist\'s name and emergency contacts for quick access during a seizure.',
    ],
  },
];

export default function HelpView({ onBack, onAbout }) {
  const [expanded, setExpanded] = useState(null);

  const toggle = (id) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="flex-1 flex flex-col w-full max-w-md sm:max-w-xl md:max-w-2xl overflow-hidden">

      <div className="flex items-center gap-4 mb-6 shrink-0">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-on-raised)', border: '1px solid var(--border)' }}
        >
          ← BACK
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-dim)' }}>
          Help
        </h2>
      </div>

      <ScrollFade className="space-y-2" wrapperClassName="flex-1">

        {SECTIONS.map(section => (
          <div
            key={section.id}
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
          >
            <button
              onClick={() => toggle(section.id)}
              className="w-full flex items-center justify-between px-4 py-3 active:opacity-70 transition-opacity"
            >
              <span className="text-[11px] font-black uppercase tracking-widest text-left" style={{ color: 'var(--text-primary)' }}>
                {section.title}
              </span>
              <span className="text-[var(--text-dim)] text-xs ml-2 shrink-0">
                {expanded === section.id ? '▲' : '▼'}
              </span>
            </button>

            {expanded === section.id && (
              <div className="px-4 pb-4 space-y-3">
                {section.steps.map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span
                      className="shrink-0 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{step}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <button
          onClick={onAbout}
          className="w-full mt-2 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
          style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
        >
          About AuraTrack
        </button>

        <div className="pb-4" />
      </ScrollFade>
    </div>
  );
}
