import { labelText, message, type Language, type MessageKey, type MessageParams } from '@auratrack/i18n';
import {
  clusterWarningAtStart,
  newId,
  pastSeizureProblem,
  pastSeizureValues,
  SETTING_DEFS,
  type CustomCode,
  type InterictalEvent,
  type Medication,
  type SymptomSet,
  type BodyArea,
  type PhaseName,
  type Patient,
  type PastSeizureInput,
  type Seizure,
  type Setting,
  type SettingKey,
  type SettingValue,
} from '@auratrack/model';
import {
  createPasskey,
  fromBase64Url,
  passkeySecret,
  toBase64Url,
  type LockedStatus,
  type PasskeyEnv,
  type PasskeyRecord,
  type RecoveryReport,
  type StoreApi,
} from '@auratrack/store';
import { connect, type Client, type PortLike } from '@auratrack/store/rpc';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  RecordingController,
  browserRecordingEnv,
  defaultRecordingSettings,
  type RecordingEnv,
  type RecordingSnapshot,
} from '../recording/controller';
import { resolveSettings, settingRecord, type ResolvedSettings } from './settings';

// The app's state: the store (in a worker), the person being tracked, their seizures and settings, and the recording.
// Screens read this and call its actions; none of them talks to the store directly.

export type AppApi = Client<StoreApi>;
export type Phase = 'loading' | 'setup' | 'locked' | 'ready' | 'error';

const LANGUAGE_KEY = 'auratrack.language';
const LANGUAGES: readonly Language[] = ['en', 'nb', 'nn', 'da', 'sv', 'fi', 'de', 'fr', 'es'];
const asLanguage = (value: unknown): Language => LANGUAGES.find((l) => l === value) ?? 'en';
const storedLanguage = (): Language => {
  try {
    return asLanguage(globalThis.localStorage?.getItem(LANGUAGE_KEY));
  } catch {
    return 'en';
  }
};

export interface AppState {
  phase: Phase;
  error: string | null;
  language: Language;
  t: (key: MessageKey, params?: MessageParams) => string;
  label: (code: string) => string;
  patients: Patient[];
  patient: Patient | null;
  /** The active person's seizures, newest first. */
  seizures: Seizure[];
  /** Saved symptom sets (F-304), the household's own symptoms (F-303) and the between-seizures log (F-313). */
  sets: SymptomSet[];
  customCodes: CustomCode[];
  between: InterictalEvent[];
  /** The active person's rescue medication, for the emergency alert. */
  rescue: { name: string; dose: number | null; unit: string }[];
  settings: ResolvedSettings;
  locked: LockedStatus | null;
  recovery: RecoveryReport;
  /** How many seizures fall in the cluster window including the recording just started (null: no cluster). */
  cluster: { count: number; window: number } | null;
  controller: RecordingController;
  recording: RecordingSnapshot;
  busy: boolean;
  wrongPin: boolean;
  /** The passkey that unlocks this store (Face ID, fingerprint), and whether this browser can use one. */
  passkey: PasskeyRecord | null;
  passkeySupported: boolean;
  passkeyFailed: boolean;
  actions: {
    /** Runs before the app locks by itself (the editor saves what it holds). */
    beforeLock(fn: (() => Promise<void>) | null): void;
    setupPasskey(pin: string): Promise<'ok' | 'wrong_pin' | 'unsupported' | 'failed'>;
    removePasskey(): Promise<void>;
    unlockWithPasskey(): Promise<void>;
    setup(args: { name: string; pin: string }): Promise<void>;
    unlock(pin: string): Promise<void>;
    lock(): Promise<void>;
    startRecording(): void;
    closeRecording(): Promise<void>;
    setSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void>;
    switchPatient(): Promise<void>;
    logPast(input: Omit<PastSeizureInput, 'patientId' | 'recordedBy' | 'timeZone'>): Promise<'saved' | string>;
    deleteSeizure(id: string): Promise<void>;
    /** Like saveSeizure, but a failure is thrown to the caller (used before the app locks by itself). */
    saveStrict(id: string, patch: Partial<Seizure>): Promise<void>;
    /** Saves the changes made in the editor to a seizure. */
    saveSeizure(id: string, patch: Partial<Seizure>): Promise<void>;
    history(id: string): Promise<{ at: number; kind: string; fields: string[] }[]>;
    saveSet(args: {
      typeCode: string | null;
      name: string;
      items: { code: string; phase: PhaseName }[];
    }): Promise<void>;
    renameSet(id: string, name: string): Promise<void>;
    deleteSet(id: string): Promise<void>;
    /** Adds the household's own symptom and returns its code. */
    addCustomSymptom(name: string): Promise<string>;
    logBetween(args: { symptomCode: string; occurredAt: number; area: BodyArea | null; notes: string }): Promise<void>;
    deleteBetween(id: string): Promise<void>;
    keepSeizure(id: string): Promise<void>;
    answerRecovery(args: { seizureId: string; ended: boolean; at?: number }): Promise<void>;
    refresh(): Promise<void>;
  };
}

const Context = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

export function createWorkerClient(): AppApi {
  const worker = new Worker(new URL('../store.worker.ts', import.meta.url), { type: 'module' });
  return connect<StoreApi>(worker as unknown as PortLike, { waitForReady: true });
}

const NO_RECOVERY: RecoveryReport = { running: [], autoStopped: [] };
const message_ = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Locks after this long with no touch, even with the screen on. */
const IDLE_LOCK_MS = 5 * 60 * 1000;

/** The browser's passkeys, if it has them. */
function browserPasskeyEnv(): PasskeyEnv | null {
  const g = globalThis as { PublicKeyCredential?: unknown; navigator?: Navigator; location?: Location };
  if (!g.PublicKeyCredential || !g.navigator?.credentials || !g.location) return null;
  return {
    credentials: g.navigator.credentials as unknown as PasskeyEnv['credentials'],
    rpId: g.location.hostname,
    rpName: 'AuraTrack',
  };
}

export function AppProvider({
  client,
  env,
  passkeyEnv,
  children,
}: {
  client: AppApi;
  /** The browser parts of recording; tests give fakes. */
  env?: RecordingEnv;
  /** The browser's passkeys; null means the browser has none. Tests give a stand-in. */
  passkeyEnv?: PasskeyEnv | null;
  children: ReactNode;
}) {
  const [clockEnv] = useState(() => env ?? browserRecordingEnv());
  const [passkeys] = useState(() => (passkeyEnv === undefined ? browserPasskeyEnv() : passkeyEnv));
  const [passkey, setPasskey] = useState<PasskeyRecord | null>(null);
  const [passkeyFailed, setPasskeyFailed] = useState(false);
  const beforeLockRef = useRef<(() => Promise<void>) | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(storedLanguage);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [seizures, setSeizures] = useState<Seizure[]>([]);
  const [sets, setSets] = useState<SymptomSet[]>([]);
  const [customCodes, setCustomCodes] = useState<CustomCode[]>([]);
  const [between, setBetween] = useState<InterictalEvent[]>([]);
  const [rescue, setRescue] = useState<AppState['rescue']>([]);
  const [settingRecords, setSettingRecords] = useState<Setting[]>([]);
  const [locked, setLocked] = useState<LockedStatus | null>(null);
  const [recovery, setRecovery] = useState<RecoveryReport>(NO_RECOVERY);
  const [cluster, setCluster] = useState<AppState['cluster']>(null);
  const [busy, setBusy] = useState(false);
  const [wrongPin, setWrongPin] = useState(false);
  const [controller] = useState(
    () => new RecordingController(sendTo(client, false), clockEnv, defaultRecordingSettings()),
  );
  const recording = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  const patient = patients.find((p) => p.id === activeId) ?? patients[0] ?? null;
  const settings = useMemo(() => resolveSettings(settingRecords, patient?.id ?? null), [settingRecords, patient?.id]);

  // What the recording controller needs from the settings
  useEffect(() => {
    controller.setSettings({
      wakeLock: settings.wakeLock,
      haptics: settings.recordingHaptics,
      sound: settings.alertSound,
      plan: settings.plan,
    });
  }, [controller, settings]);

  useEffect(() => {
    controller.setTransport(sendTo(client, phase === 'ready'));
  }, [client, controller, phase]);

  const loadLocked = useCallback(async () => {
    const status = await client.lockedStatus();
    setLocked(status);
    setPasskey((await client.status()).passkey);
    return status;
  }, [client]);

  /** Reads everything the screens show. */
  const loadAll = useCallback(async () => {
    const list = (await client.list({ type: 'patient' })) as unknown as Patient[];
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    setPatients(sorted);
    const status = await loadLocked();
    const wanted = sorted.find((p) => p.id === status.screen.patientId) ?? sorted[0] ?? null;
    setActiveId(wanted?.id ?? null);
    const records = (await client.list({ type: 'setting' })) as unknown as Setting[];
    setSettingRecords(records);
    const all = (await client.list({ type: 'seizure' })) as unknown as Seizure[];
    setSeizures(all.filter((s) => s.patientId === wanted?.id).sort((a, b) => b.phases.start.at - a.phases.start.at));
    const sets_ = (await client.list({ type: 'symptomSet' })) as unknown as SymptomSet[];
    setSets(sets_.filter((x) => x.patientId === wanted?.id));
    setCustomCodes((await client.list({ type: 'customCode' })) as unknown as CustomCode[]);
    const inBetween = (await client.list({ type: 'interictalEvent' })) as unknown as InterictalEvent[];
    setBetween(inBetween.filter((x) => x.patientId === wanted?.id).sort((a, b) => b.occurredAt - a.occurredAt));
    const meds = (await client.list({ type: 'medication' })) as unknown as Medication[];
    setRescue(
      meds
        .filter((m) => m.patientId === wanted?.id && m.active && (m.isRescue || m.showInEmergency))
        .map((m) => ({ name: m.name, dose: m.dose, unit: m.unit })),
    );
    const resolved = resolveSettings(records, wanted?.id ?? null);
    setLanguage(resolved.language);
    try {
      globalThis.localStorage?.setItem(LANGUAGE_KEY, resolved.language);
    } catch {
      // private browsing: the language is simply not remembered before unlock
    }
  }, [client, loadLocked]);

  const recover = useCallback(async () => {
    const found = await client.recordingRecover();
    setRecovery(found);
  }, [client]);

  // First look: is there a store, and is it open?
  useEffect(() => {
    void Promise.resolve()
      .then(async () => {
        const status = await client.status();
        if (!status.exists) return setPhase('setup');
        if (!status.unlocked) {
          const lockedStatus = await loadLocked();
          if (lockedStatus.session?.status === 'running') controller.adopt(lockedStatus.session);
          return setPhase('locked');
        }
        await loadAll();
        await recover();
        setPhase('ready');
      })
      .catch((e: unknown) => {
        setError(message_(e));
        setPhase('error');
      });
  }, [client, controller, loadAll, loadLocked, recover]);

  const guarded = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(message_(e));
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }, []);

  // Lock by itself: after the app has been in the background for the set time, or untouched for five minutes. Never while a
  // recording runs. What the editor holds is saved first (kept as a change to the seizure, not as "complete").
  const lockNow = useCallback(async () => {
    if (controller.getSnapshot().session?.status === 'running') return;
    try {
      await beforeLockRef.current?.();
    } catch {
      return; // if the edits could not be saved, stay unlocked rather than lose them
    }
    setBusy(true);
    try {
      await client.lock();
      setSeizures([]);
      setSettingRecords([]);
      setPatients([]);
      await loadLocked();
      setPhase('locked');
    } finally {
      setBusy(false);
    }
  }, [client, controller, loadLocked]);

  useEffect(() => {
    if (phase !== 'ready' || !settings.appLockEnabled) return;
    let hiddenAt: number | null = null;
    const away = settings.autoLockSeconds * 1000;
    const stopWatching = clockEnv.onVisibility(() => {
      if (!clockEnv.visible()) {
        hiddenAt = clockEnv.now();
        if (away === 0) void lockNow(); // lock as the app goes away, so the app switcher shows it locked
      } else if (hiddenAt !== null) {
        const gone = clockEnv.now() - hiddenAt;
        hiddenAt = null;
        if (gone >= away) void lockNow();
      }
    });
    let idle: unknown = null;
    const touched = (): void => {
      if (idle !== null) clockEnv.clearTimeout(idle);
      idle = clockEnv.setTimeout(() => {
        // Watching a recording is not being idle: wait another five minutes after it
        if (controller.getSnapshot().session?.status === 'running') touched();
        else void lockNow();
      }, IDLE_LOCK_MS);
    };
    const touches = ['pointerdown', 'keydown', 'scroll'] as const;
    touches.forEach((name) => window.addEventListener(name, touched, { passive: true }));
    touched();
    return () => {
      stopWatching();
      touches.forEach((name) => window.removeEventListener(name, touched));
      if (idle !== null) clockEnv.clearTimeout(idle);
    };
  }, [
    phase,
    settings.appLockEnabled,
    settings.autoLockSeconds,
    clockEnv,
    lockNow,
    controller,
    recording.session?.status,
  ]);

  const t = useCallback((key: MessageKey, params?: MessageParams) => message(language, key, params), [language]);
  const label = useCallback(
    (code: string) => customCodes.find((c) => c.code === code)?.label ?? labelText(language, code),
    [language, customCodes],
  );

  const actions = useMemo<AppState['actions']>(() => {
    const writeSetting = async <K extends SettingKey>(key: K, value: SettingValue<K>) => {
      const records = (await client.list({ type: 'setting' })) as unknown as Setting[];
      const existing = settingRecord(records, key, patient?.id ?? null);
      if (existing) await client.update({ type: 'setting', id: existing.id, patch: { value } });
      else
        await client.createRecord({
          type: 'setting',
          values: { patientId: patient?.id ?? newId(), scope: SETTING_DEFS[key].scope, key, value },
        });
    };
    return {
      setup: ({ name, pin }) =>
        guarded(async () => {
          await client.create({ credential: { pin } });
          const id = newId();
          await client.createRecord({
            type: 'patient',
            values: { id, patientId: id, name: name.trim(), dateOfBirth: null, emergencyContact: '', color: '#336699' },
          });
          await loadAll();
          setRecovery(NO_RECOVERY);
          setPhase('ready');
        }),
      unlock: (pin) =>
        guarded(async () => {
          setWrongPin(false);
          try {
            await client.unlock({ credential: { pin } });
          } catch (e) {
            if (e instanceof Error && e.name === 'WrongSecretError') return setWrongPin(true);
            throw e;
          }
          await loadAll();
          await recover();
          setPhase('ready');
        }),
      unlockWithPasskey: () =>
        guarded(async () => {
          setPasskeyFailed(false);
          const status = await client.status();
          if (!passkeys || !status.passkey) return setPasskeyFailed(true);
          try {
            const secret = await passkeySecret(passkeys, {
              credentialId: fromBase64Url(status.passkey.credentialId),
              prfSalt: fromBase64Url(status.passkey.prfSalt),
            });
            await client.unlock({ credential: { secret } });
          } catch {
            return setPasskeyFailed(true); // cancelled, refused, or not this phone's: the PIN still works
          }
          await loadAll();
          await recover();
          setPhase('ready');
        }),
      beforeLock: (fn) => {
        beforeLockRef.current = fn;
      },
      setupPasskey: async (pin) => {
        if (!passkeys) return 'unsupported';
        try {
          const { handle, secret } = await createPasskey(
            passkeys,
            patient?.id ?? newId(),
            patient?.name ?? 'AuraTrack',
          );
          const record = { credentialId: toBase64Url(handle.credentialId), prfSalt: toBase64Url(handle.prfSalt) };
          try {
            await client.addPasskey({ credential: { pin }, secret, handle: record });
          } catch (e) {
            if (e instanceof Error && e.name === 'WrongSecretError') return 'wrong_pin';
            throw e;
          }
          setPasskey(record);
          return 'ok';
        } catch {
          return 'failed';
        }
      },
      removePasskey: () =>
        guarded(async () => {
          await client.removePasskey();
          setPasskey(null);
        }),
      lock: () =>
        guarded(async () => {
          await client.lock();
          setSeizures([]);
          setSettingRecords([]);
          setPatients([]);
          await loadLocked();
          setPhase('locked');
        }),
      startRecording: () => {
        const id = patient?.id ?? locked?.screen.patientId ?? null;
        if (!id) return;
        const starts = phase === 'ready' ? seizures.map((s) => s.phases.start.at) : (locked?.recentStarts ?? []);
        const plan = settings.plan;
        const warning = clusterWarningAtStart(starts, controller.now(), plan);
        setCluster(warning.warn ? { count: warning.count, window: plan.clusterWindowMinutes } : null);
        controller.start({
          patientId: id,
          recordedBy: settings.recordedBy,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      },
      closeRecording: () =>
        guarded(async () => {
          if (controller.getSnapshot().session?.status === 'running') controller.finish();
          await controller.settled();
          controller.clear();
          setCluster(null);
          if (phase === 'ready') await loadAll();
          else await loadLocked();
        }),
      setSetting: (key, value) =>
        guarded(async () => {
          await writeSetting(key, value);
          await loadAll();
        }),
      switchPatient: () =>
        guarded(async () => {
          if (patients.length < 2) return;
          const next = patients[(patients.findIndex((p) => p.id === patient?.id) + 1) % patients.length];
          if (next) await client.refreshLockedScreen({ patientId: next.id });
          await loadAll();
        }),
      logPast: async (input) => {
        if (!patient) return 'none';
        const full: PastSeizureInput = {
          ...input,
          patientId: patient.id,
          recordedBy: settings.recordedBy,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        const problem = pastSeizureProblem(full, Date.now());
        if (problem) return problem;
        await client.createRecord({ type: 'seizure', values: pastSeizureValues(full) });
        await loadAll();
        return 'saved';
      },
      deleteSeizure: (id) =>
        guarded(async () => {
          await client.remove({ type: 'seizure', id });
          await loadAll();
        }),
      keepSeizure: (id) =>
        guarded(async () => {
          await client.update({ type: 'seizure', id, patch: { cancelled: false } });
          await loadAll();
        }),
      saveStrict: async (id, patch) => {
        await client.update({ type: 'seizure', id, patch: patch as never });
      },
      saveSeizure: (id, patch) =>
        guarded(async () => {
          await client.update({ type: 'seizure', id, patch: patch as never });
          await loadAll();
        }),
      history: (id) => client.history({ type: 'seizure', id }),
      saveSet: ({ typeCode, name, items }) =>
        guarded(async () => {
          if (!patient || items.length === 0) return;
          await client.createRecord({
            type: 'symptomSet',
            values: {
              patientId: patient.id,
              seizureTypeCode: typeCode,
              name: name.trim().slice(0, 120),
              items: items.slice(0, 40),
            },
          });
          await loadAll();
        }),
      renameSet: (id, name) =>
        guarded(async () => {
          await client.update({ type: 'symptomSet', id, patch: { name: name.trim().slice(0, 120) } });
          await loadAll();
        }),
      deleteSet: (id) =>
        guarded(async () => {
          await client.remove({ type: 'symptomSet', id });
          await loadAll();
        }),
      addCustomSymptom: async (name) => {
        const code = `custom.${newId()}`;
        await client.createRecord({
          type: 'customCode',
          values: {
            patientId: patient?.id ?? newId(),
            kind: 'symptom',
            code,
            label: name.trim().slice(0, 120),
            parentCode: null,
          },
        });
        await loadAll();
        return code;
      },
      logBetween: ({ symptomCode, occurredAt, area, notes }) =>
        guarded(async () => {
          if (!patient) return;
          await client.createRecord({
            type: 'interictalEvent',
            values: {
              patientId: patient.id,
              occurredAt,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              symptomCode,
              area,
              notes: notes.slice(0, 5000),
              recordedBy: settings.recordedBy,
            },
          });
          await loadAll();
        }),
      deleteBetween: (id) =>
        guarded(async () => {
          await client.remove({ type: 'interictalEvent', id });
          await loadAll();
        }),
      answerRecovery: ({ seizureId, ended, at }) =>
        guarded(async () => {
          const session = recovery.running.find((s) => s.seizureId === seizureId);
          if (session && ended && at !== undefined) {
            const kind = session.seizureEnd === null ? 'end_seizure' : 'back_to_normal';
            await client.recordingEvent({ seizureId, event: { kind, id: newId(), at, late: true } });
          }
          setRecovery((r) => ({ ...r, running: r.running.filter((s) => s.seizureId !== seizureId) }));
          if (session && !ended) controller.adopt(session);
          await loadAll();
        }),
      refresh: () => guarded(loadAll),
    };
  }, [
    client,
    controller,
    guarded,
    loadAll,
    loadLocked,
    locked,
    passkeys,
    patient,
    patients,
    phase,
    recover,
    recovery.running,
    seizures,
    settings,
  ]);

  const value: AppState = {
    phase,
    error,
    language,
    t,
    label,
    patients,
    patient,
    seizures,
    sets,
    customCodes,
    between,
    rescue,
    settings,
    locked,
    recovery,
    cluster,
    controller,
    recording,
    busy,
    wrongPin,
    passkey,
    passkeySupported: passkeys !== null,
    passkeyFailed,
    actions,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Unlocked: the store saves each tap. Locked: the tap is posted to the drop box with the public key. */
function sendTo(client: AppApi, unlocked: boolean) {
  return {
    send: (seizureId: string, event: Parameters<AppApi['recordingEvent']>[0]['event']) =>
      unlocked ? client.recordingEvent({ seizureId, event }) : client.lockedPost({ event }),
  };
}
