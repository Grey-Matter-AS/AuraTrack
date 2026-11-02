import {
  loadHousehold,
  registerPatient,
  removeDevice as removeFromHousehold,
  startHousehold,
  updateDevice,
  type HouseholdState,
} from '@auratrack/sync';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useApp } from '../app/AppContext';
import { HouseholdService, type MeetingNote, type ServiceSnapshot } from './service';
import { householdEnv } from './transport';

// The household for the screens: the service that keeps this device reachable and looks for the others, what it knows
// (devices, last meetings), and the few things a person can do (start, rename, follow, remove, leave, look now).

export interface ChangesNote {
  count: number;
  name: string;
}

export interface HouseholdApi {
  snapshot: ServiceSnapshot;
  /** This device's id in the household, once the store is open. */
  deviceId: string | null;
  start(args: { name: string; deviceName: string }): Promise<void>;
  rename(deviceName: string): Promise<void>;
  setFollows(args: { all: boolean; ids: string[] }): Promise<void>;
  removeDevice(deviceId: string): Promise<void>;
  leave(): Promise<void>;
  searchNow(): void;
  note: ChangesNote | null;
  dismissNote(): void;
  /** True when this phone has nothing in it, so it may join a household. */
  canJoin(): Promise<boolean>;
}

const OFF: ServiceSnapshot = { status: 'off', household: null, last: null, removed: false, listening: false };
const Context = createContext<HouseholdApi | null>(null);

/** The household, or null when the screen is shown without the provider (a few tests). */
export const useHouseholdOptional = (): HouseholdApi | null => useContext(Context);
export function useHousehold(): HouseholdApi {
  const value = useContext(Context);
  if (!value) throw new Error('useHousehold must be used inside HouseholdProvider');
  return value;
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const { api, phase, patients, revision } = app;
  const [who, setWho] = useState<{ householdId: string; deviceId: string } | null>(null);
  const [note, setNote] = useState<ChangesNote | null>(null);
  const recordingRef = useRef(false);
  const refreshApp = useRef(app.actions.refresh);
  const recording = app.recording.session !== null;
  const refresh = app.actions.refresh;
  useEffect(() => {
    recordingRef.current = recording;
    refreshApp.current = refresh;
  });

  useEffect(() => {
    if (phase !== 'ready') return;
    let alive = true;
    void api.status().then((s) => alive && setWho(s.info));
    return () => {
      alive = false;
    };
  }, [api, phase, revision]);

  const ownWho = phase === 'ready' ? who : null;
  const service = useMemo(() => {
    if (!ownWho) return null;
    /* eslint-disable react-hooks/refs -- the service reads these two only when it runs, never while rendering */
    return new HouseholdService({
      api,
      who: ownWho,
      transport: householdEnv.transport(),
      now: Date.now,
      isBusy: () => recordingRef.current,
      onApplied: (n: MeetingNote) => {
        setNote((old) => ({ count: (old?.count ?? 0) + n.applied, name: n.peerName }));
        void refreshApp.current();
      },
    });
    /* eslint-enable react-hooks/refs */
  }, [api, ownWho]);

  useEffect(() => {
    if (!service) return;
    void service.start().catch(() => undefined);
    return () => service.stop();
  }, [service]);

  const snapshot = useSyncExternalStore(
    service ? service.subscribe : (): (() => void) => () => undefined,
    service ? service.snapshot : () => OFF,
  );

  // A person added here is listed in the household (with a key), and what is saved is passed on while reachable
  const inHousehold = snapshot.household !== null;
  useEffect(() => {
    if (!service || !inHousehold) return;
    void (async () => {
      let changed = false;
      for (const p of patients) changed = (await registerPatient(api, p.id, Date.now())) || changed;
      if (changed) await service.refresh();
    })().catch(() => undefined);
  }, [service, inHousehold, patients, api]);
  useEffect(() => {
    if (revision > 0) service?.extend();
  }, [revision, service]);

  const changeState = useCallback(
    async (change: (state: HouseholdState) => HouseholdState) => {
      const state = await loadHousehold(api);
      if (!state) return;
      await api.saveHouseholdState({ state: change(state) });
      await service?.refresh();
    },
    [api, service],
  );

  const value = useMemo<HouseholdApi>(
    () => ({
      snapshot,
      deviceId: ownWho?.deviceId ?? null,
      note,
      dismissNote: () => setNote(null),
      searchNow: () => service?.searchNow(),
      canJoin: async () => (await api.storeIsEmpty()) && snapshot.household === null,
      start: async ({ name, deviceName }) => {
        if (!ownWho) return;
        await startHousehold(api, ownWho, {
          name: name.trim(),
          deviceName: deviceName.trim(),
          patientIds: patients.map((p) => p.id),
          now: Date.now(),
        });
        await service?.refresh();
      },
      rename: (deviceName) =>
        changeState((s) => (ownWho ? updateDevice(s, ownWho.deviceId, { name: deviceName.trim() }, Date.now()) : s)),
      setFollows: ({ all, ids }) =>
        changeState((s) =>
          ownWho
            ? updateDevice(
                s,
                ownWho.deviceId,
                all ? { followAll: true } : { followAll: false, follows: ids },
                Date.now(),
              )
            : s,
        ),
      removeDevice: (deviceId) => changeState((s) => removeFromHousehold(s, deviceId, Date.now())),
      leave: async () => {
        await api.saveHouseholdState({ state: null });
        await service?.refresh();
      },
    }),
    [snapshot, ownWho, note, service, api, patients, changeState],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
