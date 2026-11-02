import { labelText, message, type Language, type MessageKey, type MessageParams } from '@auratrack/i18n';
import {
  clusterWarningAtStart,
  dueReminders,
  planEegLinks,
  newId,
  planMissedDoses,
  slotDayKey,
  pastSeizureProblem,
  pastSeizureValues,
  SETTING_DEFS,
  type ChangePlan,
  type CustomCode,
  type DoseDraft,
  type DoseLog,
  type DoseLogValues,
  type DoseReminder,
  type EegActivity,
  type EegSession,
  type InterictalEvent,
  type Medication,
  type MedicationChange,
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
  type StoredType,
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
import { APP_VERSION } from '../version';
import { VideoRecorder, downloadBlob, videoFileName, type Clip, type VideoStatus } from '../recording/video';
import { makeFormats, type Formats } from './formats';
import { resolveSettings, settingRecord, type ResolvedSettings } from './settings';

// The app's state: the store (in a worker), the person being tracked, their seizures and settings, and the recording.
// Screens read this and call its actions; none of them talks to the store directly.

export type AppApi = Client<StoreApi>;
export type Phase = 'loading' | 'setup' | 'joining' | 'locked' | 'ready' | 'error';

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
  /** Dates, times and lengths of time as the display settings say. */
  fmt: Formats;
  patients: Patient[];
  patient: Patient | null;
  /** The active person's seizures, newest first. */
  seizures: Seizure[];
  /** Saved symptom sets (F-304), the household's own symptoms (F-303) and the between-seizures log (F-313). */
  sets: SymptomSet[];
  customCodes: CustomCode[];
  between: InterictalEvent[];
  /** The active person's medicines (stopped ones too), their history, and their dose logs. */
  medications: Medication[];
  medChanges: MedicationChange[];
  doseLogs: DoseLog[];
  /** The active person's EEG diary: sessions and what happened in them. */
  eegSessions: EegSession[];
  eegActivities: EegActivity[];
  /** Doses to remind about now, for every person on this device (F-509). */
  reminders: DoseReminder[];
  /** The active person's rescue medication, for the emergency alert. */
  rescue: { name: string; dose: number | null; unit: string }[];
  settings: ResolvedSettings;
  locked: LockedStatus | null;
  recovery: RecoveryReport;
  /** How many seizures fall in the cluster window including the recording just started (null: no cluster). */
  cluster: { count: number; window: number } | null;
  controller: RecordingController;
  recording: RecordingSnapshot;
  /** The camera during a recording (F-209): its state, the picture for a small preview, and what happened to the clip. */
  video: { status: VideoStatus; stream: MediaStream | null; notice: 'saved' | 'download' | 'failed' | null };
  busy: boolean;
  wrongPin: boolean;
  /** The store, for screens that read a record type of their own (see useRecords), and a number that changes whenever data did. */
  api: AppApi;
  revision: number;
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
    /** Opens the app with the printed recovery kit and sets a new PIN. 'wrong_kit' when the kit is not this phone's. */
    unlockWithKit(kit: string, newPin: string): Promise<'ok' | 'wrong_kit'>;
    setup(args: { name: string; pin: string }): Promise<void>;
    /** Makes the store for a phone that will join a household (no person yet); the join screen follows. */
    beginJoin(pin: string): Promise<void>;
    /** The phone has joined: open the app. The people arrive with the first meeting. */
    finishJoin(): Promise<void>;
    unlock(pin: string): Promise<void>;
    lock(): Promise<void>;
    startRecording(): void;
    closeRecording(): Promise<void>;
    setSetting<K extends SettingKey>(key: K, value: SettingValue<K>): Promise<void>;
    switchPatient(): Promise<void>;
    /** Makes this person the one the app shows and records for. */
    selectPatient(id: string): Promise<void>;
    /** Removes a person and what belongs to them (their medicines' change history stays, it can only be added to). */
    removePatient(id: string): Promise<void>;
    /** Erases everything on this device after the PIN is checked; the app goes back to set-up. */
    eraseAll(pin: string): Promise<'ok' | 'wrong_pin'>;
    /** Changes one of the emergency plan's numbers for everyone on this device (alert minutes, cluster count, cluster window). */
    setPlan(key: 'emergencyAlertMinutes' | 'clusterMinCount' | 'clusterWindowMinutes', value: number): Promise<void>;
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
    /** Adds the household's own wellbeing factor and returns its code. */
    addCustomFactor(name: string): Promise<string>;
    logBetween(args: { symptomCode: string; occurredAt: number; area: BodyArea | null; notes: string }): Promise<void>;
    deleteBetween(id: string): Promise<void>;
    keepSeizure(id: string): Promise<void>;
    answerRecovery(args: { seizureId: string; ended: boolean; at?: number }): Promise<void>;
    refresh(): Promise<void>;
    /** Starts, changes, stops or corrects a medicine, and adds the record to its history. */
    changeMedication(plan: ChangePlan): Promise<void>;
    /** Removes a medicine that was entered by mistake, with its dose logs. Its history stays (it can only be added to). */
    deleteMedication(id: string): Promise<void>;
    /** Writes dose logs (marked taken, an extra dose). */
    logDoses(values: DoseLogValues[]): Promise<void>;
    editDose(id: string, patch: Partial<Pick<DoseLog, 'status' | 'takenAt' | 'note'>>): Promise<void>;
    /** Hides the note about what happened to the last video. */
    dismissVideoNotice(): void;
    /** Hides a reminder until the app is opened again. */
    dismissReminder(key: string): void;
    /** Plain record writes for the screens of M4 (medications, EEG, wellbeing, patients). Each one refreshes what is shown. */
    createRecord(type: StoredType, values: Record<string, unknown>): Promise<Record<string, unknown>>;
    updateRecord(type: StoredType, id: string, patch: Record<string, unknown>): Promise<void>;
    removeRecord(type: StoredType, id: string): Promise<void>;
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

/** Record types that belong to one person. Medicine changes can only be added to, so they are not removed with the person. */
const PATIENT_OWNED: StoredType[] = [
  'seizure',
  'interictalEvent',
  'symptomSet',
  'medication',
  'doseLog',
  'wellbeingEntry',
  'eegActivity',
  'eegSession',
  'customCode',
];

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
  const [allMeds, setAllMeds] = useState<Medication[]>([]);
  const [allChanges, setAllChanges] = useState<MedicationChange[]>([]);
  const [allLogs, setAllLogs] = useState<DoseLog[]>([]);
  const [allEegSessions, setAllEegSessions] = useState<EegSession[]>([]);
  const [allEegActivities, setAllEegActivities] = useState<EegActivity[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [reminderNow, setReminderNow] = useState(0);
  const sweeping = useRef(false);
  const [video, setVideo] = useState<AppState['video']>({ status: 'off', stream: null, notice: null });
  const recorderRef = useRef<VideoRecorder | null>(null);
  const clipRef = useRef<Promise<Clip | null> | null>(null);
  const [rescue, setRescue] = useState<AppState['rescue']>([]);
  const [settingRecords, setSettingRecords] = useState<Setting[]>([]);
  const [locked, setLocked] = useState<LockedStatus | null>(null);
  const [recovery, setRecovery] = useState<RecoveryReport>(NO_RECOVERY);
  const [cluster, setCluster] = useState<AppState['cluster']>(null);
  const [busy, setBusy] = useState(false);
  const [wrongPin, setWrongPin] = useState(false);
  const [revision, setRevision] = useState(0);
  const [controller] = useState(
    () => new RecordingController(sendTo(client, false), clockEnv, defaultRecordingSettings()),
  );
  const recording = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  const patient = patients.find((p) => p.id === activeId) ?? patients[0] ?? null;
  const settings = useMemo(() => resolveSettings(settingRecords, patient?.id ?? null), [settingRecords, patient?.id]);

  // How the screens look: the root element carries the choices (tokens.css reads them)
  useEffect(() => {
    const root = globalThis.document?.documentElement;
    if (!root) return;
    root.dataset['theme'] = settings.theme;
    root.dataset['accent'] = settings.accentColor;
    root.dataset['fontSize'] = settings.fontSize;
  }, [settings.theme, settings.accentColor, settings.fontSize]);

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

  /**
   * Reads everything the screens show, and tidies what depends on it (missed doses, EEG links). Runs one at a time: two
   * reads at once could each act on what the other has just changed.
   */
  const loadChain = useRef<Promise<unknown>>(Promise.resolve());
  const loadAllNow = useCallback(async () => {
    const list = (await client.list({ type: 'patient' })) as unknown as Patient[];
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    setPatients(sorted);
    const status = await loadLocked();
    const wanted = sorted.find((p) => p.id === status.screen.patientId) ?? sorted[0] ?? null;
    setActiveId(wanted?.id ?? null);
    const records = (await client.list({ type: 'setting' })) as unknown as Setting[];
    setSettingRecords(records);
    let all = (await client.list({ type: 'seizure' })) as unknown as Seizure[];
    let sessions = (await client.list({ type: 'eegSession' })) as unknown as EegSession[];
    let activities = (await client.list({ type: 'eegActivity' })) as unknown as EegActivity[];
    // A seizure that began during an EEG session is tied to it, and an activity running then is stopped
    if (await sweepEeg(client, all, sessions, activities, controller.now())) {
      all = (await client.list({ type: 'seizure' })) as unknown as Seizure[];
      sessions = (await client.list({ type: 'eegSession' })) as unknown as EegSession[];
      activities = (await client.list({ type: 'eegActivity' })) as unknown as EegActivity[];
    }
    setAllEegSessions(sessions);
    setAllEegActivities(activities);
    setSeizures(all.filter((s) => s.patientId === wanted?.id).sort((a, b) => b.phases.start.at - a.phases.start.at));
    const sets_ = (await client.list({ type: 'symptomSet' })) as unknown as SymptomSet[];
    setSets(sets_.filter((x) => x.patientId === wanted?.id));
    setCustomCodes((await client.list({ type: 'customCode' })) as unknown as CustomCode[]);
    const inBetween = (await client.list({ type: 'interictalEvent' })) as unknown as InterictalEvent[];
    setBetween(inBetween.filter((x) => x.patientId === wanted?.id).sort((a, b) => b.occurredAt - a.occurredAt));
    const meds = (await client.list({ type: 'medication' })) as unknown as Medication[];
    setAllMeds(meds);
    setAllChanges((await client.list({ type: 'medicationChange' })) as unknown as MedicationChange[]);
    setAllLogs((await client.list({ type: 'doseLog' })) as unknown as DoseLog[]);
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
    await sweepDoses(client, sorted, meds, resolved, controller.now(), sweeping, setAllLogs);
    setRevision((n) => n + 1);
  }, [client, controller, loadLocked]);
  const loadAll = useCallback((): Promise<void> => {
    const run = loadChain.current.then(loadAllNow);
    loadChain.current = run.catch(() => undefined);
    return run;
  }, [loadAllNow]);

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

  // The 12-minute stop (or a finish from elsewhere) ends the filming at once, so the clip is not longer than the seizure
  useEffect(() => {
    const camera = recorderRef.current;
    if (!camera || recording.session?.status === 'running' || camera.status !== 'recording' || clipRef.current) return;
    clipRef.current = camera.stop();
  }, [recording.session?.status]);

  // Doses to remind about, for everyone on this device: looked at again every half minute while the app is open
  useEffect(() => {
    if (phase !== 'ready' || !settings.doseReminders) return;
    let timer: unknown = null;
    const look = () => {
      setReminderNow(clockEnv.now());
      timer = clockEnv.setTimeout(look, 30_000);
    };
    look();
    return () => {
      if (timer !== null) clockEnv.clearTimeout(timer);
    };
  }, [phase, settings.doseReminders, clockEnv]);
  const reminders = useMemo(
    () =>
      phase === 'ready' && settings.doseReminders && reminderNow > 0
        ? dueReminders({ medications: allMeds, changes: allChanges, logs: allLogs, now: reminderNow }).filter(
            (r) => !dismissed.includes(r.key),
          )
        : [],
    [phase, settings.doseReminders, reminderNow, allMeds, allChanges, allLogs, dismissed],
  );
  // A reminder shows as a system notification too, once, where the browser allows it
  const notified = useRef(new Set<string>());
  useEffect(() => {
    for (const r of reminders) {
      if (notified.current.has(r.key)) continue;
      notified.current.add(r.key);
      void showNotification(r.name, `${r.scheduledTime}${r.dose !== null ? ` · ${r.dose} ${r.unit}` : ''}`, r.key);
    }
  }, [reminders]);

  const medications = useMemo(() => allMeds.filter((m) => m.patientId === patient?.id), [allMeds, patient?.id]);
  const eegSessions = useMemo(
    () => allEegSessions.filter((x) => x.patientId === patient?.id),
    [allEegSessions, patient?.id],
  );
  const eegActivities = useMemo(
    () => allEegActivities.filter((x) => x.patientId === patient?.id),
    [allEegActivities, patient?.id],
  );
  const medChanges = useMemo(() => allChanges.filter((c) => c.patientId === patient?.id), [allChanges, patient?.id]);
  const doseLogs = useMemo(() => allLogs.filter((l) => l.patientId === patient?.id), [allLogs, patient?.id]);

  const t = useCallback((key: MessageKey, params?: MessageParams) => message(language, key, params), [language]);
  const label = useCallback(
    (code: string) => customCodes.find((c) => c.code === code)?.label ?? labelText(language, code),
    [language, customCodes],
  );

  const fmt = useMemo(
    () =>
      makeFormats(language, settings, {
        h: message(language, 'unit.h'),
        min: message(language, 'unit.min'),
        s: message(language, 'unit.s'),
      }),
    [language, settings],
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
          // A new store has nothing "new": it starts at this version, so "What's new" shows only after an update
          await client.createRecord({
            type: 'setting',
            values: { patientId: id, scope: 'device', key: 'whatsNewSeen', value: APP_VERSION },
          });
          await loadAll();
          setRecovery(NO_RECOVERY);
          setPhase('ready');
        }),
      beginJoin: (pin) =>
        guarded(async () => {
          await client.create({ credential: { pin } });
          setPhase('joining');
        }),
      finishJoin: () =>
        guarded(async () => {
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
      unlockWithKit: async (kit, newPin) => {
        setBusy(true);
        try {
          try {
            await client.unlock({ credential: { recoveryKit: kit.trim() } });
          } catch (e) {
            if (e instanceof Error && (e.name === 'WrongSecretError' || e.name === 'InvalidKitError'))
              return 'wrong_kit';
            throw e;
          }
          await client.changePin({ current: { recoveryKit: kit.trim() }, newPin });
          await loadAll();
          await recover();
          setPhase('ready');
          return 'ok';
        } finally {
          setBusy(false);
        }
      },
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
        const startedAt = controller.now();
        controller.start({
          patientId: id,
          recordedBy: settings.recordedBy,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        // The camera opens after Start has answered, and only with the app unlocked (a video is sealed with the data key)
        if (phase === 'ready' && settings.videoEnabled) {
          const camera = (recorderRef.current ??= new VideoRecorder());
          clipRef.current = null;
          setVideo({ status: 'starting', stream: null, notice: null });
          void camera
            .start({
              facing: settings.videoCamera,
              startAt: startedAt,
              label: fmt.when(startedAt),
              now: () => controller.now(),
            })
            .then((status) => setVideo({ status, stream: camera.preview, notice: null }));
        }
      },
      closeRecording: () =>
        guarded(async () => {
          const seizureId = controller.getSnapshot().session?.seizureId ?? null;
          const camera = recorderRef.current;
          const filming = camera !== null && (camera.status === 'recording' || clipRef.current !== null);
          if (controller.getSnapshot().session?.status === 'running') controller.finish();
          const clip = filming ? await (clipRef.current ?? camera.stop()) : null;
          clipRef.current = null;
          await controller.settled();
          if (clip && seizureId && phase === 'ready') {
            const name = videoFileName(controller.getSnapshot().session?.start ?? controller.now(), clip.mime);
            try {
              await client.videoPut({
                seizureId,
                mime: clip.mime,
                bytes: new Uint8Array(await clip.blob.arrayBuffer()),
                fileName: name,
              });
              setVideo({ status: 'off', stream: null, notice: 'saved' });
            } catch {
              // The phone could not keep it (no space): the person gets the file instead of losing it
              try {
                downloadBlob(clip.blob, name);
                setVideo({ status: 'off', stream: null, notice: 'download' });
              } catch {
                setVideo({ status: 'off', stream: null, notice: 'failed' });
              }
            }
          } else setVideo((v) => ({ ...v, status: 'off', stream: null }));
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
      selectPatient: (id) =>
        guarded(async () => {
          await client.refreshLockedScreen({ patientId: id });
          await loadAll();
        }),
      removePatient: (id) =>
        guarded(async () => {
          if (patients.length < 2) return;
          for (const type of PATIENT_OWNED) {
            const rows = (await client.list({ type })) as unknown as { id: string; patientId?: string }[];
            for (const row of rows) if (row.patientId === id) await client.remove({ type, id: row.id });
          }
          await client.remove({ type: 'patient', id });
          const next = patients.find((p) => p.id !== id);
          if (next && patient?.id === id) await client.refreshLockedScreen({ patientId: next.id });
          await loadAll();
        }),
      eraseAll: async (pin) => {
        try {
          await client.erase({ credential: { pin } });
        } catch (e) {
          if (e instanceof Error && e.name === 'WrongSecretError') return 'wrong_pin';
          throw e;
        }
        setSeizures([]);
        setSettingRecords([]);
        setPatients([]);
        setBetween([]);
        setSets([]);
        setCustomCodes([]);
        setPasskey(null);
        setPhase('setup');
        return 'ok';
      },
      setPlan: (key, value) =>
        guarded(async () => {
          const records = (await client.list({ type: 'setting' })) as unknown as Setting[];
          const existing = records.filter((r) => r.key === key).sort((a, b) => b.createdAt - a.createdAt)[0];
          if (existing) await client.update({ type: 'setting', id: existing.id, patch: { value } });
          else
            await client.createRecord({
              type: 'setting',
              values: { patientId: patient?.id ?? newId(), scope: 'device', key, value },
            });
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
      addCustomFactor: async (name) => {
        const code = `custom.${newId()}`;
        await client.createRecord({
          type: 'customCode',
          values: {
            patientId: patient?.id ?? newId(),
            kind: 'factor',
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
      changeMedication: (plan) =>
        guarded(async () => {
          await client.changeMedication({ plan });
          await loadAll();
        }),
      deleteMedication: (id) =>
        guarded(async () => {
          const logs = (await client.list({ type: 'doseLog' })) as unknown as DoseLog[];
          for (const log of logs) if (log.medicationId === id) await client.remove({ type: 'doseLog', id: log.id });
          await client.remove({ type: 'medication', id });
          await loadAll();
        }),
      logDoses: (values) =>
        guarded(async () => {
          const logs = (await client.list({ type: 'doseLog' })) as unknown as DoseLog[];
          for (const value of values) {
            // A slot the sweep already wrote as missed or assumed is updated, not given a second log
            const existing =
              value.scheduledTime === null
                ? undefined
                : logs.find(
                    (l) =>
                      l.medicationId === value.medicationId &&
                      l.scheduledTime === value.scheduledTime &&
                      slotDayKey(value.scheduledTime as string, l.takenAt) ===
                        slotDayKey(value.scheduledTime as string, value.takenAt) &&
                      l.status !== 'taken' &&
                      l.status !== 'late',
                  );
            if (existing)
              await client.update({
                type: 'doseLog',
                id: existing.id,
                patch: { status: value.status, takenAt: value.takenAt, note: value.note },
              });
            else await client.createRecord({ type: 'doseLog', values: value });
          }
          await loadAll();
        }),
      editDose: (id, patch) =>
        guarded(async () => {
          await client.update({ type: 'doseLog', id, patch });
          await loadAll();
        }),
      dismissVideoNotice: () => setVideo((v) => ({ ...v, notice: null })),
      dismissReminder: (key) => setDismissed((list) => [...list, key]),
      createRecord: async (type, values) => {
        const created = await client.createRecord({ type, values });
        await loadAll();
        return created;
      },
      updateRecord: async (type, id, patch) => {
        await client.update({ type, id, patch });
        await loadAll();
      },
      removeRecord: async (type, id) => {
        await client.remove({ type, id });
        await loadAll();
      },
    };
  }, [
    client,
    controller,
    fmt,
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
    fmt,
    patients,
    patient,
    seizures,
    sets,
    customCodes,
    between,
    medications,
    medChanges,
    doseLogs,
    eegSessions,
    eegActivities,
    reminders,
    rescue,
    settings,
    locked,
    recovery,
    cluster,
    controller,
    recording,
    video,
    busy,
    wrongPin,
    api: client,
    revision,
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

/**
 * Writes the "missed" or "assumed" log for each scheduled dose that passed without one (F-507, F-508). It runs after every
 * read, and only writes what is missing, so running it twice changes nothing. One run at a time.
 */
async function sweepDoses(
  client: AppApi,
  people: readonly Patient[],
  medications: readonly Medication[],
  settings: ResolvedSettings,
  now: number,
  busy: { current: boolean },
  setLogs: (logs: DoseLog[]) => void,
): Promise<void> {
  if (busy.current || medications.length === 0) return;
  busy.current = true;
  try {
    const changes = (await client.list({ type: 'medicationChange' })) as unknown as MedicationChange[];
    const logs = (await client.list({ type: 'doseLog' })) as unknown as DoseLog[];
    let wrote = false;
    for (const person of people) {
      const drafts: DoseDraft[] = planMissedDoses({
        medications: medications.filter((m) => m.patientId === person.id && m.active),
        changes: changes.filter((c) => c.patientId === person.id),
        logs: logs.filter((l) => l.patientId === person.id),
        now,
        assume: settings.assumeDosesTaken,
        assumeSince: settings.assumeDosesTakenSince === '' ? null : settings.assumeDosesTakenSince,
      });
      for (const draft of drafts) {
        await client.createRecord({
          type: 'doseLog',
          values: { patientId: person.id, note: '', ...draft },
        });
        wrote = true;
      }
    }
    if (wrote) setLogs((await client.list({ type: 'doseLog' })) as unknown as DoseLog[]);
  } finally {
    busy.current = false;
  }
}

/** A system notification, if the browser allows one. Best effort: a reminder also shows on Home. */
async function showNotification(title: string, body: string, tag: string): Promise<void> {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const registration = await globalThis.navigator?.serviceWorker?.getRegistration();
    if (registration) await registration.showNotification(title, { body, tag });
    else new Notification(title, { body, tag });
  } catch {
    // no notification: the reminder card on Home is still there
  }
}

/** Ties seizures to the EEG session they happened in (see planEegLinks). True when anything was written. Safe to run again. */
async function sweepEeg(
  client: AppApi,
  seizures: readonly Seizure[],
  sessions: readonly EegSession[],
  activities: readonly EegActivity[],
  now: number,
): Promise<boolean> {
  if (sessions.length === 0) return false;
  const plan = planEegLinks({ sessions, activities, seizures, now });
  for (const link of plan.links) {
    await client.createRecord({ type: 'eegActivity', values: link.reference });
    await client.update({ type: 'seizure', id: link.seizureId, patch: { eegSessionId: link.sessionId } });
  }
  for (const stop of plan.stops)
    await client.update({
      type: 'eegActivity',
      id: stop.activityId,
      patch: { endTime: stop.endTime, durationSec: stop.durationSec },
    });
  for (const r of plan.refreshes)
    await client.update({
      type: 'eegActivity',
      id: r.activityId,
      patch: { endTime: r.endTime, durationSec: r.durationSec, activityCode: r.activityCode },
    });
  return plan.links.length + plan.stops.length + plan.refreshes.length > 0;
}
