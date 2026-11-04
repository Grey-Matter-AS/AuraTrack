import { createContext, useContext, useMemo, type ReactNode } from 'react';

// The few words the kit itself shows. Labels for everything else come from the screens, which get them from
// packages/i18n; the app wraps itself in <UiStringsProvider> with the current language. English is the default.
export interface UiStrings {
  close: string;
  back: string;
  choose: string;
  selectDate: string;
  selectTime: string;
  selectDateTime: string;
  selectMonth: string;
  /** "2 of 4" */
  position: (n: number, total: number) => string;
  /** Names the tab picker for a screen reader */
  chooseTab: string;
  switchPatient: string;
}

export const ENGLISH: UiStrings = {
  close: 'Close',
  back: 'Back',
  choose: 'Choose…',
  selectDate: 'Select date',
  selectTime: 'Select time',
  selectDateTime: 'Select date & time',
  selectMonth: 'Select month',
  position: (n, total) => `${n} of ${total}`,
  chooseTab: 'Choose a section',
  switchPatient: 'Switch person',
};

const StringsContext = createContext<UiStrings>(ENGLISH);

export function UiStringsProvider({ strings, children }: { strings: Partial<UiStrings>; children: ReactNode }) {
  const merged = useMemo(() => ({ ...ENGLISH, ...strings }), [strings]);
  return <StringsContext.Provider value={merged}>{children}</StringsContext.Provider>;
}

export const useUiStrings = (): UiStrings => useContext(StringsContext);
