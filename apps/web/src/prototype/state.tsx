import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Language } from '@auratrack/i18n';
import { labelText } from '@auratrack/i18n';
import { emptyDraft, type Draft } from './data';

interface PrototypeState {
  language: Language;
  setLanguage: (language: Language) => void;
  label: (code: string) => string;
  draft: Draft;
  setDraft: (update: Draft | ((previous: Draft) => Draft)) => void;
  patient: number;
  setPatient: (index: number) => void;
  /** "Self" is the simplified recording screen for a person recording their own seizure. */
  selfMode: boolean;
  setSelfMode: (value: boolean) => void;
  symptomStrip: boolean;
  setSymptomStrip: (value: boolean) => void;
  lockedAlert: 'nothing' | 'rescue' | 'rescue_and_contacts';
  setLockedAlert: (value: 'nothing' | 'rescue' | 'rescue_and_contacts') => void;
  reset: () => void;
}

const Context = createContext<PrototypeState | null>(null);

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [patient, setPatient] = useState(0);
  const [selfMode, setSelfMode] = useState(false);
  const [symptomStrip, setSymptomStrip] = useState(true);
  const [lockedAlert, setLockedAlert] = useState<PrototypeState['lockedAlert']>('rescue_and_contacts');
  const value = useMemo<PrototypeState>(
    () => ({
      language,
      setLanguage,
      label: (code) => labelText(language, code),
      draft,
      setDraft,
      patient,
      setPatient,
      selfMode,
      setSelfMode,
      symptomStrip,
      setSymptomStrip,
      lockedAlert,
      setLockedAlert,
      reset: () => setDraft(emptyDraft()),
    }),
    [language, draft, patient, selfMode, symptomStrip, lockedAlert],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function usePrototype(): PrototypeState {
  const value = useContext(Context);
  if (!value) throw new Error('usePrototype must be used inside PrototypeProvider');
  return value;
}
