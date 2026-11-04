import type { ChangeLogEntry } from '@auratrack/model';
import { addDevice, addPatient, createHousehold, updateDevice, type HouseholdState } from './membership';
import { memoryPipe, type PipeOptions } from './memory';
import { runSession, type SessionOptions, type SessionReport, type SyncContext } from './session';

// A device made of plain maps, for testing the meeting protocol without a store.

export class TestNode {
  readonly entries = new Map<string, ChangeLogEntry>();
  state: HouseholdState;
  clock = 1_000_000;
  constructor(
    readonly deviceId: string,
    readonly householdId: string,
    state: HouseholdState,
  ) {
    this.state = state;
  }

  static first(householdId: string, deviceId: string, patients: string[]): TestNode {
    return new TestNode(
      deviceId,
      householdId,
      createHousehold({ householdId, name: 'Home', deviceId, deviceName: deviceId, patientIds: patients, now: 1000 }),
    );
  }

  /** What pairing does: the new device gets the household's state and the patients' keys it will follow. */
  invite(deviceId: string, follows: string[]): TestNode {
    let state = addDevice(this.state, { deviceId, name: deviceId, addedBy: this.deviceId, now: 2000 });
    state = updateDevice(
      state,
      deviceId,
      follows.length === Object.keys(state.membership.patients).length
        ? { followAll: true }
        : { followAll: false, follows },
      2001,
    );
    this.state = state;
    const patients = Object.fromEntries(follows.map((p) => [p, this.state.keyring.patients[p] ?? []]));
    return new TestNode(deviceId, this.householdId, {
      membership: state.membership,
      keyring: { household: state.keyring.household, revoked: state.keyring.revoked, patients },
      lastMet: {},
    });
  }

  follow(patientId: string): void {
    this.state = addPatient(this.state, patientId, 3000);
  }

  add(patientId: string | null, recordId: string, stamp: string, value = 1): ChangeLogEntry {
    const entry: ChangeLogEntry = {
      id: `e-${this.deviceId}-${this.entries.size}-${recordId}`,
      householdId: this.householdId,
      patientId,
      deviceId: this.deviceId,
      stamp,
      at: 0,
      recordType: 'seizure',
      recordId,
      kind: 'update',
      fields: { n: value },
    };
    this.entries.set(entry.id, entry);
    return entry;
  }

  context(): SyncContext {
    return {
      deviceId: this.deviceId,
      householdId: this.householdId,
      state: async () => this.state,
      saveState: async (s) => {
        this.state = s;
      },
      index: async (scope) =>
        [...this.entries.values()]
          .filter((e) => (scope === 'household' ? e.patientId === null : e.patientId === scope))
          .map((e) => ({ id: e.id, stamp: e.stamp })),
      entries: async (ids) => ids.map((id) => this.entries.get(id)).filter((e): e is ChangeLogEntry => e !== undefined),
      apply: async (list) => {
        let applied = 0;
        let duplicates = 0;
        for (const e of list) {
          if (this.entries.has(e.id)) duplicates++;
          else {
            this.entries.set(e.id, e);
            applied++;
          }
        }
        return { applied, duplicates, rejected: 0 };
      },
      now: () => this.clock++,
    };
  }
}

export async function meet(
  a: TestNode,
  b: TestNode,
  pipe: PipeOptions = {},
  options: SessionOptions = { timeoutMs: 2000 },
): Promise<[SessionReport, SessionReport]> {
  const [x, y] = memoryPipe(pipe);
  return Promise.all([runSession(x, a.context(), options), runSession(y, b.context(), options)]);
}

export const stampAt = (day: number, n = 0, node = 'd'): string =>
  `${String(day * 86_400_000 + n).padStart(15, '0')}-00000-${node}`;
