import type { MessageKey, MessageParams } from '@auratrack/i18n';
import type { CustomCode, Seizure, SymptomSet } from '@auratrack/model';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../app/AppContext';
import { draftFromSeizure, patchFromDraft, type Draft } from './draft';

// The editor's state: the draft being edited, the draft as it was opened (so only changes are saved), and the words and
// lists the editor's parts need. It lives above the screen stack, so the editor and Review see the same draft.

interface Session {
  original: Seizure;
  initial: Draft;
  draft: Draft;
}

interface EditorState {
  draft: Draft;
  setDraft: (update: Draft | ((previous: Draft) => Draft)) => void;
  initial: Draft;
  original: Seizure;
  dirty: boolean;
  language: string;
  t: (key: MessageKey, params?: MessageParams) => string;
  label: (code: string) => string;
  sets: SymptomSet[];
  customCodes: CustomCode[];
  seizures: Seizure[];
  /** The change to save now, with the status the seizure should have after saving. */
  patch: (status?: Seizure['status']) => Partial<Seizure>;
}

interface Host {
  session: Session | null;
  /** Opens the editor on a seizure: a fresh working copy. */
  open: (seizure: Seizure) => void;
  close: () => void;
  /** A seizure to open as soon as Home is on screen (after a recording, "Add details"). */
  pending: string | null;
  openLater: (id: string | null) => void;
  setDraft: EditorState['setDraft'];
}

const HostContext = createContext<Host | null>(null);

export function EditorHost({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [pending, openLater] = useState<string | null>(null);
  const open = useCallback((seizure: Seizure) => {
    const initial = draftFromSeizure(seizure);
    setSession({ original: seizure, initial, draft: initial });
  }, []);
  const close = useCallback(() => setSession(null), []);
  const setDraft = useCallback<EditorState['setDraft']>(
    (update) => setSession((s) => (s ? { ...s, draft: typeof update === 'function' ? update(s.draft) : update } : s)),
    [],
  );
  // If the app locks by itself while edits are open, they are saved first (as changes, not as "complete")
  const app = useApp();
  const { beforeLock, saveStrict } = app.actions;
  useEffect(() => {
    if (!session) return beforeLock(null);
    const { initial, draft, original } = session;
    beforeLock(async () => {
      const patch = patchFromDraft(initial, draft, original);
      if (Object.keys(patch).length > 0) await saveStrict(original.id, patch);
    });
    return () => beforeLock(null);
  }, [session, beforeLock, saveStrict]);
  const value = useMemo(
    () => ({ session, open, close, pending, openLater, setDraft }),
    [session, open, close, pending, setDraft],
  );
  return <HostContext.Provider value={value}>{children}</HostContext.Provider>;
}

export function useEditorHost(): Host {
  const value = useContext(HostContext);
  if (!value) throw new Error('useEditorHost must be used inside EditorHost');
  return value;
}

export function useEditor(): EditorState {
  const host = useEditorHost();
  const app = useApp();
  const { session } = host;
  if (!session) throw new Error('The editor is not open');
  const { draft, initial, original } = session;
  return {
    draft,
    setDraft: host.setDraft,
    initial,
    original,
    dirty: JSON.stringify(draft) !== JSON.stringify(initial),
    language: app.language,
    t: app.t,
    label: app.label,
    sets: app.sets,
    customCodes: app.customCodes,
    seizures: app.seizures,
    patch: (status) => patchFromDraft(initial, status ? { ...draft, status } : draft, original),
  };
}
