// @vitest-environment jsdom
import { newId } from '@auratrack/model';
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reportsEnv, type ReportsEnv } from '../reports/env';
import { PIN, T0, makeSeizure, openPlace, seed, setup } from './testSupport';

// Backup, restore, a backup of one person, moving to a new phone, bringing in a 6.1 file, and the recovery kit. The real store,
// the real encryption; only the file dialog and the worker are replaced.
configure({ asyncUtilTimeout: 8000 });

const original = { ...reportsEnv };
let saved: { bytes: Uint8Array | string; fileName: string; mime: string }[] = [];
beforeEach(() => {
  saved = [];
  Object.assign(reportsEnv, {
    save: async (bytes, fileName, mime) => {
      saved.push({ bytes, fileName, mime });
      return 'saved';
    },
    makePdf: async () => new TextEncoder().encode('%PDF-fake'),
  } satisfies Partial<ReportsEnv>);
});
afterEach(() => {
  cleanup();
  Object.assign(reportsEnv, original);
});

type Ctx = ReturnType<typeof setup>;
const PHRASE = 'a long passphrase';

async function openBackup(ctx: Ctx) {
  const user = userEvent.setup();
  ctx.mount();
  await screen.findByRole('button', { name: 'Start timer' });
  await openPlace(user, 'More');
  await user.click(await screen.findByRole('button', { name: 'Backup and restore' }));
  await screen.findByText('Make a backup');
  return user;
}

/** Puts a file into a file chooser, the way the browser does. The text is given straight, as jsdom has no File.text(). */
function choose(button: string, name: string, text: string) {
  const picker = screen.getByRole('button', { name: button });
  const input = picker.nextElementSibling as HTMLInputElement;
  const file = new File([text], name);
  Object.defineProperty(file, 'text', { value: async () => text });
  fireEvent.change(input, { target: { files: [file] } });
}

async function fillPhrases(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Passphrase \(at least 8/), PHRASE);
  await user.type(screen.getByLabelText('Passphrase again'), PHRASE);
}

describe('making a backup', () => {
  it('saves one encrypted file named with the date, and remembers when', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await ctx.client.createRecord({
      type: 'seizure',
      values: makeSeizure(patientId, 60, 40, { notes: 'a very private note' }),
    });
    const user = await openBackup(ctx);
    expect((screen.getByRole('button', { name: 'Make the backup file' }) as HTMLButtonElement).disabled).toBe(true);
    await fillPhrases(user);
    await user.click(screen.getByRole('button', { name: 'Make the backup file' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.fileName).toMatch(/^auratrack-backup-\d{4}-\d{2}-\d{2}\.atbak$/);
    expect(saved[0]!.bytes as string).not.toContain('a very private note');
    expect(await screen.findByText('Backup saved')).toBeTruthy();
    await waitFor(async () => {
      const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string; value: number }[];
      expect(rows.find((r) => r.key === 'lastBackupAt')?.value).toBeGreaterThan(0);
    });
  });

  it('does not count a backup that was cancelled in the save dialog', async () => {
    const ctx = setup();
    await seed(ctx);
    reportsEnv.save = async () => 'cancelled';
    const user = await openBackup(ctx);
    await fillPhrases(user);
    await user.click(screen.getByRole('button', { name: 'Make the backup file' }));
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Make the backup file' }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(screen.queryByText('Backup saved')).toBeNull();
    const rows = (await ctx.client.list({ type: 'setting' })) as unknown as { key: string }[];
    expect(rows.some((r) => r.key === 'lastBackupAt')).toBe(false);
  });

  it('can be of one person only, when there are more than one', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    const samId = newId();
    await ctx.client.createRecord({
      type: 'patient',
      values: { id: samId, patientId: samId, name: 'Sam', dateOfBirth: null, emergencyContact: '', color: '#7e22ce' },
    });
    await ctx.client.createRecord({ type: 'seizure', values: makeSeizure(patientId, 60, 40, { notes: 'alex only' }) });
    await ctx.client.createRecord({ type: 'seizure', values: makeSeizure(samId, 60, 40, { notes: 'sam only' }) });
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openPlace(user, 'More');
    await user.click(await screen.findByRole('button', { name: 'Backup and restore' }));
    await user.click(await screen.findByRole('button', { name: 'Sam' }));
    await fillPhrases(user);
    await user.click(screen.getByRole('button', { name: 'Make the backup file' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    const check = await ctx.client.checkBackup({ text: saved[0]!.bytes as string, passphrase: PHRASE });
    expect(check.patients).toEqual(['Sam']);
    expect(check.counts.records['seizure']).toBe(1);
  });

  it('wants a passphrase of 8 characters typed twice', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openBackup(ctx);
    await user.type(screen.getByLabelText(/^Passphrase \(at least 8/), 'short');
    expect(await screen.findByText('At least 8 characters.')).toBeTruthy();
    await user.clear(screen.getByLabelText(/^Passphrase \(at least 8/));
    await user.type(screen.getByLabelText(/^Passphrase \(at least 8/), PHRASE);
    await user.type(screen.getByLabelText('Passphrase again'), 'different words');
    expect(await screen.findByText('The two passphrases are not the same.')).toBeTruthy();
  });
});

describe('restoring a backup', () => {
  async function aBackup() {
    const a = setup();
    const { patientId } = await seed(a, { name: 'Alex' });
    for (const i of [1, 2, 3])
      await a.client.createRecord({
        type: 'seizure',
        values: makeSeizure(patientId, 100 * i, 30, { notes: `from phone A ${i}` }),
      });
    const file = await a.client.backup({ passphrase: PHRASE });
    return { text: file.text, patientId };
  }

  it('checks the file first and says what is in it, then restores it, and the records are there as they were', async () => {
    const { text } = await aBackup();
    const ctx = setup();
    await seed(ctx, { name: 'Kari' });
    const user = await openBackup(ctx);
    choose('Choose a backup file', 'backup.atbak', text);
    await screen.findByText('backup.atbak');
    await user.type(screen.getByLabelText('Passphrase of the backup'), PHRASE);
    await user.click(screen.getByRole('button', { name: 'Check the file' }));
    expect(await screen.findByText(/^Made /)).toBeTruthy();
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText(/Seizures: 3/)).toBeTruthy();
    expect(await ctx.client.list({ type: 'seizure' })).toHaveLength(0); // nothing changed yet
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Everything in the backup is now here, exactly as it was.')).toBeTruthy();
    const notes = ((await ctx.client.list({ type: 'seizure' })) as unknown as { notes: string }[])
      .map((s) => s.notes)
      .sort();
    expect(notes).toEqual(['from phone A 1', 'from phone A 2', 'from phone A 3']);
    expect(await ctx.client.list({ type: 'patient' })).toHaveLength(2); // Kari stays, Alex is added
  });

  it('says so for a wrong passphrase, and for a file that is not a backup', async () => {
    const { text } = await aBackup();
    const ctx = setup();
    await seed(ctx);
    const user = await openBackup(ctx);
    choose('Choose a backup file', 'backup.atbak', text);
    await user.type(await screen.findByLabelText('Passphrase of the backup'), 'not the passphrase');
    await user.click(screen.getByRole('button', { name: 'Check the file' }));
    expect(await screen.findByText('That passphrase does not open this file. Check it and try again.')).toBeTruthy();
    choose('Choose another file', 'notes.txt', 'hello, this is not json');
    await user.click(await screen.findByRole('button', { name: 'Check the file' }));
    expect(await screen.findByText('This is not an AuraTrack backup file.')).toBeTruthy();
    expect(await ctx.client.list({ type: 'seizure' })).toHaveLength(0);
  });

  it('refuses to restore a backup that does not match its own counts', async () => {
    const { text } = await aBackup();
    const damaged = JSON.stringify({ ...JSON.parse(text), ciphertext: 'AAAA' + JSON.parse(text).ciphertext.slice(4) });
    const ctx = setup();
    await seed(ctx);
    const user = await openBackup(ctx);
    choose('Choose a backup file', 'backup.atbak', damaged);
    await user.type(await screen.findByLabelText('Passphrase of the backup'), PHRASE);
    await user.click(screen.getByRole('button', { name: 'Check the file' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
  });
});

const OLD_FILE = JSON.stringify({
  schema: 'auratrack.backup',
  version: 2,
  exportedAt: T0,
  data: {
    settings: [{ key: 'personName', value: 'Old Patient' }],
    events: [
      {
        uuid: 'ev-1',
        startTime: T0 - 86_400_000,
        date: 'x',
        time: 'y',
        duration: 90,
        type: 'Focal Aware',
        symptoms: [],
        triggers: [],
        notes: 'from version 6',
        isComplete: true,
        isEdited: false,
        isManualEntry: false,
        isEmergencyStop: false,
        userModeAtTime: 'CARETAKER',
        videoAttached: false,
        editLog: [],
        postIctal: { findings: [] },
        laps: {},
        manualDurations: { total: 90 },
      },
    ],
    medications: [],
    medicationLogs: [],
    medicationChanges: [],
    eegSessions: [],
    eegActivities: [],
    wellbeingEntries: [],
    tombstones: [],
  },
});

describe('bringing in a version 6 file', () => {
  it('brings it in, accounts for every record, and says the numbers match', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openBackup(ctx);
    choose('Choose a version 6 backup file', 'old.json', OLD_FILE);
    await user.click(await screen.findByRole('button', { name: 'Bring it in' }));
    const result = await screen.findByRole('status', {}, { timeout: 15_000 });
    expect(result.textContent).toMatch(/Brought in \d+ of \d+ records/);
    expect(await screen.findByText('The numbers match the backup file.')).toBeTruthy();
    const notes = ((await ctx.client.list({ type: 'seizure' })) as unknown as { notes: string }[]).map((s) => s.notes);
    expect(notes).toEqual(['from version 6']);
  });

  it('is safe to do twice: the second time brings nothing new', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openBackup(ctx);
    choose('Choose a version 6 backup file', 'old.json', OLD_FILE);
    await user.click(await screen.findByRole('button', { name: 'Bring it in' }));
    await screen.findByText('The numbers match the backup file.');
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Bring it in' }) as HTMLButtonElement).disabled).toBe(false),
    );
    await user.click(screen.getByRole('button', { name: 'Bring it in' }));
    await waitFor(async () => expect(await ctx.client.list({ type: 'seizure' })).toHaveLength(1));
    expect(await screen.findByText(/Already here from an earlier import/)).toBeTruthy();
  });

  it('says so for a file that is not from version 6', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openBackup(ctx);
    choose('Choose a version 6 backup file', 'x.json', '{"hello": "world"}');
    await user.click(await screen.findByRole('button', { name: 'Bring it in' }));
    expect(await screen.findByText('The file could not be read. Nothing was changed.')).toBeTruthy();
  });
});

describe('the recovery kit', () => {
  it('needs the PIN, then shows the code and the QR code, and saves the page as a PDF', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openBackup(ctx);
    await user.type(screen.getByLabelText('Your PIN'), '1111');
    await user.click(screen.getByRole('button', { name: 'Make the recovery kit' }));
    expect(await screen.findByText('That PIN is not right. Try again.')).toBeTruthy();
    await user.clear(screen.getByLabelText('Your PIN'));
    await user.type(screen.getByLabelText('Your PIN'), PIN);
    await user.click(screen.getByRole('button', { name: 'Make the recovery kit' }));
    expect(await screen.findByRole('img', { name: 'QR code of the recovery kit' })).toBeTruthy();
    expect(screen.getByText(/^AT7KIT1\./)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save the page as PDF' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.fileName).toMatch(/^auratrack-recovery-kit-\d{4}-\d{2}-\d{2}\.pdf$/);
    void within;
  });

  it('opens the app from the PIN screen when the PIN is forgotten, and sets a new PIN', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    const { kit } = await ctx.client.recoveryKit({ credential: { pin: PIN } });
    await user.click(screen.getByRole('button', { name: 'Lock the app' }));
    await user.click(await screen.findByRole('button', { name: 'Forgot the PIN?' }));
    const sheet = await screen.findByRole('dialog', { name: 'Open with the recovery kit' });
    await user.type(within(sheet).getByLabelText('Code from the kit'), 'AT7KIT1.not-a-real-kit.abc');
    await user.type(within(sheet).getByLabelText('New PIN (at least 4 digits)'), '9753');
    await user.type(within(sheet).getByLabelText('PIN again'), '9753');
    await user.click(within(sheet).getByRole('button', { name: 'Open and set the new PIN' }));
    expect(await within(sheet).findByText(/does not open the data on this device/)).toBeTruthy();
    const code = within(sheet).getByLabelText('Code from the kit');
    await user.clear(code);
    await user.type(code, kit);
    await user.click(within(sheet).getByRole('button', { name: 'Open and set the new PIN' }));
    await screen.findByRole('button', { name: 'Start timer' });
    // The new PIN works, the old one does not
    await user.click(screen.getByRole('button', { name: 'Lock the app' }));
    await user.type(await screen.findByLabelText('PIN'), PIN);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(await screen.findByText('That PIN is not right. Try again.')).toBeTruthy();
    await user.clear(screen.getByLabelText('PIN'));
    await user.type(screen.getByLabelText('PIN'), '9753');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await screen.findByRole('button', { name: 'Start timer' });
  });
});
