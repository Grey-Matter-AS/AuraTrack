// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { newId, type Seizure, type SeizureProfile } from '@auratrack/model';
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
  ilae2025: null,
  profile: null,
  symptoms: [],
  afterFindings: [],
  recoveryOngoing: false,
  triggerCodes: [],
  notes: '',
  video: null,
  isManualEntry: false,
  isEmergencyStop: false,
  recordedBy: 'carer' as const,
  eegSessionId: null,
  prodromeSecondsBefore: null,
  quickNotes: [],
  recordedWhileLocked: false,
  cancelled: false,
  ...over,
});

async function seed(ctx: Ctx, seizure: Record<string, unknown> | null = {}) {
  await ctx.api.create({ credential: { pin: PIN } });
  const patientId = newId();
  await ctx.api.createRecord({
    type: 'patient',
    values: {
      id: patientId,
      patientId,
      name: 'Alex',
      dateOfBirth: null,
      emergencyContact: '',
      emergencyPhone: '',
      color: '#336699',
    },
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
const pressedButton = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');
const START = 'Where did it start?';
const RECALL = 'Could the person remember it afterwards?';
const RESPOND = 'Could the person respond normally during it?';
const BTC = 'Did it become a tonic-clonic seizure on both sides?';
const SIGNS = 'Could others see signs of it?';
const DEJA_VU = 'symptom.emotions_memory.deja_vu_been_here_before';
const SHAKING = 'symptom.big_shaking_jerking.rhythmic_shaking';
const NO_ANSWERS = {
  class: null,
  recall: null,
  responsive: null,
  bilateralTonicClonic: null,
  observable: null,
  generalized: null,
};
/** Taps an answer to one question: the chips of each question are a group named by it. */
const answer = (user: ReturnType<typeof userEvent.setup>, question: string, option: string) =>
  user.click(within(screen.getByRole('group', { name: question })).getByRole('button', { name: option }));
const profile = async (ctx: Ctx, patientId: string, name: string, position: number, over: Record<string, unknown>) =>
  (await ctx.api.createRecord({
    type: 'seizureProfile',
    values: { patientId, name, position, ilae: NO_ANSWERS, signs: [], ...over },
  })) as unknown as SeizureProfile;
const tab = (name: string) => screen.getByRole('tab', { name: new RegExp(`^${name}`) });
/** One phase's band on the timeline: its heading, its own fields, its symptom cards and "+ Add symptom". */
const band = (phase: 'Warning signs' | 'Aura' | 'Seizure' | 'Recovery') =>
  screen.getByRole('listitem', { name: phase });
/** Adds a symptom card to a phase: "+ Add symptom", search, pick. The body map, when it opens, is closed unless kept. */
const addSymptom = async (
  user: ReturnType<typeof userEvent.setup>,
  phase: 'Warning signs' | 'Aura' | 'Seizure' | 'Recovery',
  search: string,
  pick: RegExp,
  keepBodyMap = false,
) => {
  await user.click(within(band(phase)).getByRole('button', { name: '+ Add symptom' }));
  const sheet = await screen.findByRole('dialog', { name: /^Add a symptom/ });
  await user.type(within(sheet).getByLabelText('Search'), search);
  await user.click(await within(sheet).findByRole('button', { name: pick }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /^Add a symptom/ })).toBeNull());
  const where = screen.queryByRole('dialog', { name: /^Where:/ });
  if (where && !keepBodyMap) await user.click(within(where).getByRole('button', { name: 'Done' }));
};

afterEach(cleanup);

describe('the editor, tab by tab', () => {
  it('asks the ILAE 2025 questions that apply, names the type as they are answered, and saves only what applies', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    expect(screen.getByText(/No seizure profiles yet/)).toBeTruthy();
    expect(screen.queryByRole('group', { name: RECALL })).toBeNull();
    await answer(user, START, 'Focal');
    await answer(user, RECALL, 'Yes');
    await answer(user, RESPOND, 'No');
    expect(screen.getByText('ILAE 2025: Focal impaired consciousness seizure')).toBeTruthy();
    // Impaired consciousness: others could see signs by definition, so that is not asked
    expect(screen.queryByRole('group', { name: SIGNS })).toBeNull();
    expect(screen.getByText(/this follows from the answers above/)).toBeTruthy();
    await answer(user, START, 'Generalized');
    expect(screen.queryByRole('group', { name: RECALL })).toBeNull();
    await answer(user, 'Other', 'Atonic (drop)');
    expect(screen.getByText('ILAE 2025: Generalized atonic seizure')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.profile ?? null).toBeNull();
    expect(saved).toMatchObject({
      status: 'complete',
      ilae2025: {
        class: 'generalized',
        recall: null,
        responsive: null,
        bilateralTonicClonic: null,
        observable: null,
        generalized: 'atonic',
      },
    });
  });

  it('fills in a profile’s answers and usual signs, and a second profile takes back what the first filled in', async () => {
    const ctx = setup();
    const { id, patientId } = await seed(ctx);
    await profile(ctx, patientId, 'Aura feeling', 0, {
      ilae: { ...NO_ANSWERS, class: 'focal', recall: 'yes', responsive: 'yes', observable: 'no' },
      signs: [{ code: DEJA_VU, phase: 'aura' }],
    });
    const night = await profile(ctx, patientId, 'Night seizure', 1, {
      ilae: { ...NO_ANSWERS, class: 'generalized', generalized: 'tonic_clonic' },
      signs: [{ code: SHAKING, phase: 'seizure' }],
    });
    const user = await openEditor(ctx);
    await user.click(screen.getByRole('button', { name: 'Aura feeling' }));
    expect(screen.getByText('ILAE 2025: Focal preserved consciousness seizure')).toBeTruthy();
    expect(screen.getByText(/Filled in from "Aura feeling"/)).toBeTruthy();
    // Like an aura: nothing others could see, so the timeline has no Seizure section
    await user.click(tab('Timeline'));
    expect(screen.queryByRole('listitem', { name: 'Seizure' })).toBeNull();
    expect(within(band('Aura')).getAllByText(/Deja Vu/i).length).toBeGreaterThan(0);
    await user.click(tab('Classification'));
    await answer(user, BTC, 'No');
    await user.click(screen.getByRole('button', { name: 'Night seizure' }));
    expect(screen.getByText('ILAE 2025: Generalized tonic-clonic seizure')).toBeTruthy();
    await user.click(tab('Timeline'));
    expect(within(band('Seizure')).getAllByText(/Rhythmic Shaking/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Deja Vu/i)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.profile).toEqual({ id: night.id, name: 'Night seizure' });
    expect(saved.ilae2025).toEqual({ ...NO_ANSWERS, class: 'generalized', generalized: 'tonic_clonic' });
    expect(saved.symptoms.map((x) => [x.code, x.phase])).toEqual([[SHAKING, 'seizure']]);
  });

  it('shows the first three profiles and the others under More', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    for (const [i, name] of ['One', 'Two', 'Three', 'Four'].entries())
      await profile(ctx, patientId, name, i, { ilae: { ...NO_ANSWERS, class: 'focal' } });
    const user = await openEditor(ctx);
    expect(screen.getByRole('button', { name: 'Three' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Four' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More profiles (1)' }));
    await user.click(screen.getByRole('button', { name: 'Four' }));
    await user.click(screen.getByRole('button', { name: 'Fewer profiles' }));
    // The chosen one stays in view
    expect(pressedButton('Four')).toBe('true');
  });

  it('keeps the answers as a new profile, and the seizure is saved with it', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await answer(user, START, 'Not known');
    await answer(user, BTC, 'Yes');
    await user.click(screen.getByRole('button', { name: 'Keep these answers as a profile' }));
    await user.type(screen.getByLabelText('Name'), 'Big seizure');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await screen.findByText('Profile kept');
    expect(pressedButton('Big seizure')).toBe('true');
    const kept = (await ctx.client.list({ type: 'seizureProfile' })) as unknown as SeizureProfile[];
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ name: 'Big seizure', ilae: { class: 'unknown', bilateralTonicClonic: 'yes' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    expect((await get(ctx, id!)).profile).toEqual({ id: kept[0]!.id, name: 'Big seizure' });
  });

  it('a seizure that is aura-like by its ILAE 2025 answers has no Seizure section on its timeline', async () => {
    const ctx = setup();
    await seed(ctx, {
      ilae2025: { ...NO_ANSWERS, class: 'focal', recall: 'yes', responsive: 'yes', observable: 'no' },
    });
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    expect(screen.queryByRole('listitem', { name: 'Seizure' })).toBeNull();
    expect(band('Aura')).toBeTruthy();
    expect(band('Warning signs')).toBeTruthy();
    expect(band('Recovery')).toBeTruthy();
  });

  it('adds symptom cards to their phases; the first sign of the seizure is starred, never a warning sign', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    await addSymptom(user, 'Seizure', 'rhythmic', /Rhythmic Shaking/i);
    expect(within(band('Seizure')).getByText(/★/)).toBeTruthy();
    await addSymptom(user, 'Aura', 'deja', /Deja Vu/i);
    await addSymptom(user, 'Warning signs', 'smell', /Strange Smell/i);
    // The star moves to the aura's symptom; the warning sign is before the seizure and never the first sign
    expect(within(band('Aura')).getByText(/★/)).toBeTruthy();
    expect(within(band('Warning signs')).queryByText(/★/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.symptoms.map((s) => [s.phase, s.order, s.isFirst])).toEqual([
      ['prodrome', 0, false],
      ['aura', 1, true],
      ['seizure', 2, false],
    ]);
    // Warning signs are not timed from the seizure; a new card's time since the one before is not known
    expect(saved.symptoms[0]?.sincePrevious).toEqual({ kind: 'unknown', ms: null });
    expect(saved.symptoms[2]?.sincePrevious).toEqual({ kind: 'unknown', ms: null });
  });

  it('a delay card between two symptoms takes a preset or a time of its own, saved as an estimate', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    await addSymptom(user, 'Seizure', 'rhythmic', /Rhythmic Shaking/i);
    await addSymptom(user, 'Seizure', 'blank', /Staring/i);
    const delay = within(band('Seizure')).getByRole('combobox', { name: 'Time since the symptom before' });
    expect((delay as HTMLSelectElement).value).toBe('unknown');
    await user.selectOptions(delay, 'custom');
    await user.type(within(band('Seizure')).getAllByPlaceholderText('00:00:00').at(-1)!, '125');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.symptoms[1]?.sincePrevious).toEqual({ kind: 'approximate', ms: 85_000 });
  });

  it('asks for a body area only where the symptom has a place, and saves the area', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    await addSymptom(user, 'Aura', 'deja', /Deja Vu/i);
    // A feeling has no place on the body: the body map does not open
    expect(screen.queryByRole('dialog', { name: /^Where:/ })).toBeNull();
    await addSymptom(user, 'Seizure', 'rhythmic', /Rhythmic Shaking/i, true);
    const where = await screen.findByRole('dialog', { name: /^Where:/ });
    await user.click(within(where).getByRole('button', { name: /^Arms$/ }));
    await user.click(within(where).getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.symptoms.find((s) => s.phase === 'seizure')?.area?.region).toBe('body.arms');
    expect(saved.symptoms.find((s) => s.phase === 'aura')?.area).toBeNull();
  });

  it('saves how long before the warning signs came, typed as HH:MM:SS', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    await user.type(within(band('Warning signs')).getByLabelText('Warning signs beforehand'), '20000');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    expect((await get(ctx, id!)).prodromeSecondsBefore).toBe(7200);
  });

  it("saves triggers, findings afterwards (also in the person's own words), and the recovery", async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    await user.click(within(band('Warning signs')).getByRole('button', { name: /Possible triggers/ }));
    await user.click(within(band('Warning signs')).getByRole('button', { name: /Stress/i }));
    await user.click(within(band('Recovery')).getByRole('button', { name: /How the person was afterwards/ }));
    await user.type(within(band('Recovery')).getByLabelText('Something else (in your own words)'), 'Wanted to sleep');
    await user.click(within(band('Recovery')).getByRole('button', { name: 'Add' }));
    const recovery = within(band('Recovery')).getByLabelText('Recovery, until back to usual self');
    await user.clear(recovery);
    await user.type(recovery, '2000');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.triggerCodes).toHaveLength(1);
    expect(saved.afterFindings).toEqual([{ code: 'after.custom', customLabel: 'Wanted to sleep', areas: [] }]);
    expect(saved.phases.recoveryEnd!.at - saved.phases.seizureEnd!.at).toBe(20 * 60_000);
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
        phase: 'seizure',
      },
      {
        id: newId(),
        code: 'symptom.eyes.staring_blankly',
        area: null,
        moment: 1,
        order: 1,
        sincePrevious: { kind: 'exact', ms: 12_345 },
        isFirst: false,
        phase: 'seizure',
      },
    ];
    const { id } = await seed(ctx, { symptoms });
    const user = await openEditor(ctx);
    await user.click(tab('Notes'));
    await user.type(screen.getByLabelText('Notes for the neurologist'), 'Slept after');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.symptoms).toEqual(symptoms); // not one value changed
    expect(saved.notes).toBe('Slept after');
  });

  it('marks an edited time as edited, and leaves the others as they were timed', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    const seizure = within(band('Seizure')).getByLabelText('How long');
    await user.clear(seizure);
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
    await user.click(tab('Timeline'));
    expect(within(band('Seizure')).getByText(/stopped itself at 12 minutes/)).toBeTruthy();
    const when = within(band('Seizure')).getByLabelText('When did the seizure end?') as HTMLInputElement;
    fireEvent.change(when, { target: { value: '2025-10-09T12:20:15' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const phases = (await get(ctx, id!)).phases;
    expect(phases.seizureEnd?.source).toBe('entered-later');
    expect(new Date(phases.seizureEnd!.at).getSeconds()).toBe(15);
  });

  it('lists what changed and when in the edit history', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await answer(user, START, 'Focal');
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
    expect(list.textContent).toMatch(/ILAE 2025 classification/);
    expect(list.textContent).toMatch(/notes/);
  });
});

describe('the start time', () => {
  it('moves every time with it, to the second, and marks them as edited', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const before = (await get(ctx, id!)).phases;
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    const when = screen.getByLabelText('When did it start?') as HTMLInputElement;
    fireEvent.change(when, { target: { value: '2025-10-01T08:30:20' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const after = (await get(ctx, id!)).phases;
    expect(after.start.at).toBe(new Date('2025-10-01T08:30:20').getTime());
    expect(after.start.source).toBe('edited');
    expect(after.seizureEnd!.at - after.start.at).toBe(before.seizureEnd!.at - before.start.at); // the length is kept
  });
});

describe('leaving, discarding and reviewing', () => {
  it('asks before leaving with unsaved changes, and leaves nothing changed when you leave', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await answer(user, START, 'Focal');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Leave' }));
    await screen.findByRole('button', { name: 'Start timer' });
    expect((await get(ctx, id!)).ilae2025 ?? null).toBeNull();
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
    await user.click(tab('Timeline'));
    await addSymptom(user, 'Seizure', 'rhythmic', /Rhythmic Shaking/i);
    await user.click(screen.getByRole('button', { name: 'Review' }));
    const timeline = await screen.findByRole('list', { name: 'Seizure timeline' });
    expect(within(timeline).getByText(/Rhythmic Shaking/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    expect((await get(ctx, id!)).status).toBe('complete');
  });

  it('moves a symptom down, moves one to another phase, and removes one, from its card', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    await addSymptom(user, 'Seizure', 'rhythmic', /Rhythmic Shaking/i);
    await addSymptom(user, 'Seizure', 'blank', /Staring/i);
    await addSymptom(user, 'Seizure', 'deja', /Deja Vu/i);
    await user.click(within(band('Seizure')).getAllByRole('button', { name: 'Move down' })[0]!);
    // ⋯ on the Deja Vu card: move it to the aura
    await user.click(within(band('Seizure')).getByRole('button', { name: /More for Deja Vu/i }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Aura' }));
    // ⋯ on the last card in the seizure: remove it
    await user.click(within(band('Seizure')).getByRole('button', { name: /More for Rhythmic Shaking/i }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove from the timeline' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('button', { name: 'Start timer' });
    const saved = await get(ctx, id!);
    expect(saved.symptoms.map((x) => [x.phase, x.code])).toEqual([
      ['aura', DEJA_VU],
      ['seizure', 'symptom.eyes.staring_blankly'],
    ]);
  });
});

describe('your own symptoms and saved sets', () => {
  it('adds your own symptom, shows it in your words, and keeps it for next time', async () => {
    const ctx = setup();
    const { id } = await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    await user.click(within(band('Seizure')).getByRole('button', { name: '+ Add symptom' }));
    const sheet = await screen.findByRole('dialog', { name: /^Add a symptom/ });
    await user.type(within(sheet).getByLabelText('Your own symptom'), 'Hums a tune');
    await user.click(within(sheet).getByRole('button', { name: 'Add' }));
    const where = await screen.findByRole('dialog', { name: /^Where:/ });
    await user.click(within(where).getByRole('button', { name: 'Done' }));
    expect((await within(band('Seizure')).findAllByText(/Hums a tune/)).length).toBeGreaterThan(0);
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

  it('saves the timeline as a set, fills a timeline from it, and manages it from More', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = await openEditor(ctx);
    await user.click(tab('Timeline'));
    await addSymptom(user, 'Seizure', 'rhythmic', /Rhythmic Shaking/i);
    await user.click(screen.getByRole('button', { name: 'Save these symptoms as a set' }));
    const sheet = await screen.findByRole('dialog', { name: 'Save these symptoms as a set' });
    const name = within(sheet).getByLabelText('Name of the set');
    await user.clear(name);
    await user.type(name, 'Usual start');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Save these symptoms as a set' })).toBeNull());
    const sets = (await ctx.client.list({ type: 'symptomSet' })) as unknown as { name: string; items: unknown[] }[];
    expect(sets).toMatchObject([
      { name: 'Usual start', items: [{ code: 'symptom.big_shaking_jerking.rhythmic_shaking', phase: 'seizure' }] },
    ]);
    // The set is offered above the timeline
    const fill = screen.getByLabelText('Fill the timeline from a saved set') as HTMLSelectElement;
    expect([...fill.options].map((o) => o.text)).toContain('Usual start');

    // More → the sets screen
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
