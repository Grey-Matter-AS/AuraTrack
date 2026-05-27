import React from 'react';
import pkg from '../../package.json';
import { ScrollFade } from '../components/ScrollFade';

const GITHUB_URL = 'https://github.com/Grey-Matter-AS/AuraTrack';

export default function AboutView({ onBack }) {
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
          About
        </h2>
      </div>

      <ScrollFade className="space-y-4" wrapperClassName="flex-1">

        <div className="text-center py-5">
          <h1 className="text-2xl font-black tracking-[0.3em] uppercase" style={{ color: 'var(--text-primary)' }}>
            AURATRACK
          </h1>
          <div className="h-1 w-8 bg-[var(--accent)] mx-auto mt-2 rounded-full" />
          <span
            className="inline-block mt-3 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest"
            style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}
          >
            v{pkg.version}
          </span>
        </div>

        <Section title="About">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            AuraTrack is a privacy-first seizure tracking app for people with epilepsy and their caregivers.
            Record seizures in real time, annotate events with clinical detail, track medications, and generate
            structured reports for your neurologist — all stored locally on your device.
          </p>
        </Section>

        <Section title="Developer">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Grey Matter AS</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold px-3 py-1.5 rounded-xl active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--accent)', border: '1px solid var(--border)' }}
            >
              GitHub ↗
            </a>
          </div>
        </Section>

        <Section title="Privacy">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            All data is stored exclusively on your device using IndexedDB. Nothing is transmitted to any external
            server. Your health data never leaves your device.
          </p>
        </Section>

        <Section title="Medical Disclaimer">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            AuraTrack is a personal logging tool and is <strong style={{ color: 'var(--text-primary)' }}>not a medical device</strong>.
            It is not intended to diagnose, treat, or replace professional medical advice. Always consult a qualified
            healthcare provider regarding your condition and treatment.
          </p>
        </Section>

        <Section title="Open Source & Feedback">
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
            AuraTrack is open source. Report bugs or suggest features on GitHub Issues.
          </p>
          <div className="flex gap-3">
            <a
              href={`${GITHUB_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-[11px] font-bold py-2.5 rounded-xl active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              License
            </a>
            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-[11px] font-bold py-2.5 rounded-xl active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              Report an Issue
            </a>
          </div>
        </Section>

        <div className="pb-4" />
      </ScrollFade>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-dim)' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
