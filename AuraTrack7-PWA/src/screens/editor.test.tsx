// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { newId, type Seizure } from '@auratrack/model';
import { TEST_PIN_KDF, createStoreApi } from '@auratrack/store';
import { act, cleanup, fireEvent, render, screen, waitFor, within, configure } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { AppApi } from '../app/AppContext';
import { fakeEnv, T0 } from '../recording/fakeEnv';
import AppRoot from './AppRoot';

// The seizure editor, the between-seizures log and the saved sets, on the real store in memory. Nothing is mocked.

// Under coverage, with every test file running at once, the first screen can take longer than a second
configure({ asyncUtilTimeout: 8000 });

const PIN = '2468';
let counter = 0;
type Saved = Seizure & { id: string };

function setup() {
  const f = fakeEnv({}, T0);
  const { api } = createStoreApi({
    name: `editor-${Date.now()}-${counter++}`,
    options: { pinKdf: TEST_PIN_KDF, now: f.env.now },
  });
  const client = new Proxy({} as AppApi, {
    get: (_t, method: string) => async (arg: unknown) =>
      (api as unknown as Record<string, (a: unknown) => unknown>)[method]!(arg),
  });
  return { f, api, client, mount: () => render(<AppRoot client={client} env={f.env} />) };
}
type Ctx = ReturnType<typeof setup>;

const base = (patientId: string, over: Record<string, unknown> = {}) => ({
  patientId,
  timeZone: 'Europe/Oslo',
  phases: {
    start: { at: T0 - 3_600_000, source: 'timed' as const },
    auraEnd: { at: T0 - 3_590_000, source: 'timed' as const },
    seizureEnd: { at: T0 - 3_500_000, source: 'timed' as const },
    recoveryEnd: null,
  },
  status: 'recorded' as const,
  typeCode: null,
  ilae: null,
  symptoms: [],
  afterFindings: [],
  recoveryMinutes: null,
  recoveryOngoing: false,
  triggerCodes: [],
  notes: '',
  video: null,
  isManualEntry: false,
  isEmergencyStop: false,
  recordedBy: 'carer' as const,
  eegSessionId: null,
  ...over,
});

async function seed(ctx: Ctx, seizure: Record<string, unknown> | null = {}) {
  await ctx.api.create({ credential: { pin: PIN } });
  const patientId = newId();
  await ctx.api.createRecord({
    type: 'patient',
    values: { id: patientId, patientId, name: 'Alex', dateOfBirth: null, emergencyContact: '', color: '#336699' },
  });
  let id: string | null = null;
  if (seizure)
    id = ((await ctx.api.createRecord({ type: 'seizure', values: base(patientId, seizure) })) as { id: string }).id;
  return { patientId, id };
}

async function openEditor(ctx: Ctx) {
  const user = userEvent.setup();
  ctx.mount();
  await user.click(await screen.findByRole('button', { name: /Add details|Edit/ }));
  await screen.findByText(/Seizure details|Past seizure/);
  return user;
}

const get = async (ctx: Ctx, id: string) => (await ctx.client.get({ type: 'seizure', id })) as unknown as Saved;
const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}`) });

afterEach(cleanup);

describe('the editor, tab by tab', () => {
  it('sets the type and the ILAE answers, and saves the seizure as complete', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(screen.getByRole('button', { name: /^Focal Aware$/i }));
    await user.click(screen.getByRole('button', { name: 'Focal onset' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved).toMatchObject({ typeCode: 'seizure_type.focal_aware', status: 'complete', ilae: { onset: 'focal' } });
  });

  it('shows the tabs for the type: an aura-only seizure has no During tab', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openEditor(ctx);
    expect(screen.getAllByRole('tab').map((t) => t.textContent?.split(/(?=[a-z]*\d| not| type)/)[0])).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^During/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Aura only/i }));
    expect(screen.queryByRole('tab', { name: /^During/ })).toBeNull();
  });

  it('adds a symptom in the right phase, with the first one starred, and saves its place in the order', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('During'));
    await user.type(screen.getByLabelText('Search'), 'rhythmic');
    await user.click(await screen.findByRole('button', { name: /Rhythmic Shaking/i }));
    expect(await screen.findByText(/★/)).toBeTruthy();
    await user.click(tab('Before'));
    await user.type(screen.getByLabelText('Search'), 'deja');
    await user.click(await screen.findByRole('button', { name: /Deja Vu/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.symptoms.map((s) => [s.phase, s.order, s.isFirst])).toEqual([
      ['before', 0, true],
      ['during', 1, false],
    ]);
  });

  it('asks for a body area only where the symptom has a place, and saves the area', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Before'));
    await user.type(screen.getByLabelText('Search'), 'deja');
    await user.click(await screen.findByRole('button', { name: /Deja Vu/i }));
    expect(screen.queryByRole('button', { name: 'Add area' })).toBeNull();
    await user.click(tab('During'));
    await user.type(screen.getByLabelText('Search'), 'rhythmic');
    await user.click(await screen.findByRole('button', { name: /Rhythmic Shaking/i }));
    await user.click(screen.getByRole('button', { name: 'Add area' }));
    await user.click(screen.getByRole('button', { name: /^Arms$/ }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.symptoms.find((s) => s.phase === 'during')?.area?.region).toBe('body.arms');
    expect(saved.symptoms.find((s) => s.phase === 'before')?.area).toBeNull();
  });

  it('saves the time of the first warning sign in seconds', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Before'));
    await user.type(screen.getByLabelText('How long before the seizure did the first warning sign start?'), '2');
    await user.click(screen.getByRole('button', { name: 'Hours' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    expect((await get(ctx, id!)).prodromeSecondsBefore).toBe(7200);
  });

  it("saves triggers, findings afterwards (also in the person's own words), and the recovery", async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Before'));
    await user.click(screen.getByRole('button', { name: /Stress/i }));
    await user.click(tab('After'));
    await user.type(screen.getByLabelText('Something else (in your own words)'), 'Wanted to sleep');
    await user.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
    await user.type(screen.getByLabelText('Back to normal after (minutes)'), '20');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.triggerCodes).toHaveLength(1);
    expect(saved.afterFindings).toEqual([{ code: 'after.custom', customLabel: 'Wanted to sleep', areas: [] }]);
    expect(saved.recoveryMinutes).toBe(20);
  });

  it('keeps the symptoms exactly as recorded when only the notes are edited', async () => {
    const ctx = setup();
    const symptoms = [
      {
        id: newId(),
        code: 'symptom.big_shaking_jerking.rhythmic_shaking',
        area: null,
        moment: 0,
        order: 0,
        sincePrevious: { kind: 'exact', ms: 4321 },
        isFirst: true,
        phase: 'during',
      },
      {
        id: newId(),
        code: 'symptom.eyes.staring_blankly',
        area: null,
        moment: 1,
        order: 1,
        sincePrevious: { kind: 'exact', ms: 12_345 },
        isFirst: false,
      },
    ];
    const { id } = await seed(ctx, { symptoms });
    const user = await openEditor(ctx);
    await user.click(tab('Notes'));
    await user.type(screen.getByLabelText('Notes for the neurologist'), 'Slept after');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.symptoms).toEqual(symptoms); // not one value changed, not even the phase that was never set
    expect(saved.notes).toBe('Slept after');
  });

  it('marks an edited time as edited, and leaves the others as they were timed', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Notes'));
    const seizure = screen.getByLabelText('Seizure (seconds)');
    await user.type(seizure, '45');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const phases = (await get(ctx, id!)).phases;
    expect(phases.start.source).toBe('timed');
    expect(phases.seizureEnd?.source).toBe('edited');
    expect(phases.seizureEnd!.at - phases.auraEnd!.at).toBe(45_000);
  });

  it('asks when the seizure ended after the timer stopped itself, and saves it as entered later', async () => {
    const ctx = setup();
    const { id } = await seed(ctx, {
      isEmergencyStop: true,
      phases: { start: { at: T0 - 3_600_000, source: 'timed' }, auraEnd: null, seizureEnd: null, recoveryEnd: null },
    });
    const user = await openEditor(ctx);
    await user.click(tab('Notes'));
    expect(screen.getByText(/stopped itself at 12 minutes/)).toBeTruthy();
    const when = screen.getByLabelText('When did the seizure end?') as HTMLInputElement;
    await user.clear(when);
    await user.type(when, '2025-10-09T12:20');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const phases = (await get(ctx, id!)).phases;
    expect(phases.seizureEnd?.source).toBe('entered-later');
  });

  it('lists what changed and when in the edit history', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(screen.getByRole('button', { name: /^Focal Aware$/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    await ctx.client.update({ type: 'seizure', id: id!, patch: { notes: 'later' } });
    cleanup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('tab', { name: /^Notes/ }));
    await screen.findByText('Edit history');
    const list = (await screen.findAllByRole('list')).find((l) => /recorded/.test(l.textContent ?? ''))!;
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expect(list.textContent).toMatch(/recorded/);
    expect(list.textContent).toMatch(/seizure type/);
    expect(list.textContent).toMatch(/notes/);
  });
});

describe('the start time', () => {
  it('moves every time with it, and marks them as edited', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const before = (await get(ctx, id!)).phases;
    const user = await openEditor(ctx);
    await user.click(tab('Notes'));
    const when = screen.getByLabelText('When did it start?') as HTMLInputElement;
    fireEvent.change(when, { target: { value: '2025-10-01T08:30' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const after = (await get(ctx, id!)).phases;
    expect(after.start.at).toBe(new Date('2025-10-01T08:30').getTime());
    expect(after.start.source).toBe('edited');
    expect(after.seizureEnd!.at - after.start.at).toBe(before.seizureEnd!.at - before.start.at); // the length is kept
  });
});

describe('leaving, discarding and reviewing', () => {
  it('asks before leaving with unsaved changes, and leaves nothing changed when you leave', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(screen.getByRole('button', { name: /^Focal Aware$/i }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Leave' }));
    await screen.findByRole('button', { name: 'Start timer' });
    expect((await get(ctx, id!)).typeCode).toBeNull();
  });

  it('leaves at once when nothing changed', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await screen.findByRole('button', { name: 'Start timer' });
  });

  it('discards by marking the seizure cancelled, and Home asks what to do with it', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Notes'));
    await user.click(screen.getByRole('button', { name: 'Discard this seizure' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Discard this seizure' }),
    );
    expect(await screen.findByText('A recording was cancelled')).toBeTruthy();
    expect((await get(ctx, id!)).cancelled).toBe(true);
  });

  it('shows everything in order in Review, and Save there completes the seizure', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('During'));
    await user.type(screen.getByLabelText('Search'), 'rhythmic');
    await user.click(await screen.findByRole('button', { name: /Rhythmic Shaking/i }));
    await user.click(screen.getByRole('button', { name: 'Review' }));
    const timeline = await screen.findByRole('list', { name: 'Seizure timeline' });
    expect(within(timeline).getByText(/Rhythmic Shaking/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    expect((await get(ctx, id!)).status).toBe('complete');
  });

  it('moves a symptom down and removes one, in the timeline', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('During'));
    for (const q of ['rhythmic', 'blank']) {
      await user.clear(screen.getByLabelText('Search'));
      await user.type(screen.getByLabelText('Search'), q);
      await user.click(
        (await screen.findAllByRole('button', { name: new RegExp(q === 'blank' ? 'Staring' : 'Rhythmic', 'i') }))[0]!,
      );
    }
    await user.click(screen.getAllByRole('button', { name: 'Move down' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Remove' }).at(-1)!);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.symptoms).toHaveLength(1);
    expect(saved.symptoms[0]?.code).toBe('symptom.eyes.staring_blankly');
  });
});

describe('your own symptoms and saved sets', () => {
  it('adds your own symptom, shows it in your words, and keeps it for next time', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('During'));
    await user.type(screen.getByLabelText('Your own symptom'), 'Hums a tune');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect((await screen.findAllByText('Hums a tune')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.symptoms[0]?.code).toMatch(/^custom\./);
    const codes = (await ctx.client.list({ type: 'customCode' })) as unknown as {
      code: string;
      label: string;
      kind: string;
    }[];
    expect(codes).toMatchObject([{ kind: 'symptom', label: 'Hums a tune', code: saved.symptoms[0]?.code }]);
  });

  it('saves the symptoms as a set, offers it in the next seizure, and manages it from Home', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('During'));
    await user.type(screen.getByLabelText('Search'), 'rhythmic');
    await user.click(await screen.findByRole('button', { name: /Rhythmic Shaking/i }));
    await user.click(screen.getByRole('button', { name: 'Save these symptoms as a set' }));
    const sheet = await screen.findByRole('dialog', { name: 'Save these symptoms as a set' });
    const name = within(sheet).getByLabelText('Name of the set');
    await user.clear(name);
    await user.type(name, 'Usual start');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Save these symptoms as a set' })).toBeNull());
    const sets = (await ctx.client.list({ type: 'symptomSet' })) as unknown as { name: string; items: unknown[] }[];
    expect(sets).toMatchObject([
      { name: 'Usual start', items: [{ code: 'symptom.big_shaking_jerking.rhythmic_shaking', phase: 'during' }] },
    ]);
    expect(screen.getByRole('button', { name: '+ Usual start' })).toBeTruthy();

    // Home → the sets screen
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(await screen.findByRole('button', { name: 'Leave' }));
    await user.click(await screen.findByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('button', { name: 'Symptom sets and your own symptoms' }));
    expect(await screen.findByText('Usual start')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const rename = await screen.findByLabelText('Name of the set');
    await user.clear(rename);
    await user.type(rename, 'Start');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Start')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await ctx.client.list({ type: 'symptomSet' })).toHaveLength(0));
  });
});

describe('between seizures', () => {
  it('logs a symptom between seizures with a time, a place and a note, and shows it on Home', async () => {
    const ctx = setup();
    await seed(ctx, null);
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Log a symptom between seizures' }));
    const sheet = await screen.findByRole('dialog', { name: 'Between seizures' });
    const groups = within(sheet).getByLabelText('Group') as HTMLSelectElement;
    await user.selectOptions(groups, groups.options[3]!.value);
    const symptom = within(sheet).getByLabelText('Symptom') as HTMLSelectElement;
    await user.selectOptions(symptom, symptom.options[1]!.value);
    await user.click(within(sheet).getByRole('button', { name: 'Where on the body' }));
    await user.click(await screen.findByRole('button', { name: /^Arms$/ }));
    await user.click(screen.getAllByRole('button', { name: 'Done' }).at(-1)!);
    await user.type(within(sheet).getByLabelText('Note'), 'After lunch');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Between seizures' })).toBeNull());
    const [entry] = (await ctx.client.list({ type: 'interictalEvent' })) as unknown as {
      id: string;
      notes: string;
      area: { region: string } | null;
    }[];
    expect(entry).toMatchObject({ notes: 'After lunch', area: { region: 'body.arms' } });
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await ctx.client.list({ type: 'interictalEvent' })).toHaveLength(0));
  });
});

describe("the clock is the test's", () => {
  it('has a clock that does not move on its own', () => {
    const ctx = setup();
    expect(ctx.f.env.now()).toBe(T0);
    void act;
  });
});

describe('the top bar over the editor', () => {
  const typeNote = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(tab('Notes'));
    await user.type(screen.getByLabelText('Notes for the neurologist'), 'Slept after');
  };
  const lockAndOpen = async (ctx: Ctx, user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'Lock the app' }));
    await screen.findByText('AuraTrack is locked');
    await ctx.client.unlock({ credential: { pin: PIN } });
  };

  it('Lock saves what the editor holds, as changes', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await typeNote(user);
    await lockAndOpen(ctx, user);
    expect((await get(ctx, id!)).notes).toBe('Slept after');
  });

  it('Go to Home asks first when there are unsaved edits, and Stay keeps them', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openEditor(ctx);
    await typeNote(user);
    await user.click(screen.getByRole('button', { name: 'Go to Home' }));
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
    expect((screen.getByLabelText('Notes for the neurologist') as HTMLTextAreaElement).value).toBe('Slept after');
  });

  it('edits left behind are gone: a later lock does not save them', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await typeNote(user);
    await user.click(screen.getByRole('button', { name: 'Go to Home' }));
    await user.click(await screen.findByRole('button', { name: 'Leave' }));
    await screen.findByRole('button', { name: 'Start timer' });
    await lockAndOpen(ctx, user);
    expect((await get(ctx, id!)).notes).toBe('');
  });
});
