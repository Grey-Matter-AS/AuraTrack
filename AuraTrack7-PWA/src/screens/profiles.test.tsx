// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import type { Seizure, SeizureProfile } from '@auratrack/model';
import { cleanup, configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { makeSeizure, openPlace, seed, setup, type Ctx } from './testSupport';

// The seizure profiles screen (D-17): add, edit, reorder and remove, and a removed or changed profile never changes a
// seizure saved with it.

configure({ asyncUtilTimeout: 5000 });
afterEach(cleanup);

const NO_ANSWERS = {
  class: null,
  recall: null,
  responsive: null,
  bilateralTonicClonic: null,
  observable: null,
  generalized: null,
};
const SHAKING = 'symptom.big_shaking_jerking.rhythmic_shaking';

async function openProfiles(ctx: Ctx) {
  const user = userEvent.setup();
  ctx.mount();
  await screen.findByRole('button', { name: 'Start timer' });
  await openPlace(user, 'More');
  await user.click(await screen.findByRole('button', { name: 'Seizure profiles' }));
  await screen.findByText(/The kinds of seizure Alex usually has/);
  return user;
}

const profile = async (ctx: Ctx, patientId: string, name: string, position: number, over: object = {}) =>
  (await ctx.api.createRecord({
    type: 'seizureProfile',
    values: { patientId, name, position, ilae: NO_ANSWERS, signs: [], ...over },
  })) as unknown as SeizureProfile;
const profiles = async (ctx: Ctx) =>
  ((await ctx.client.list({ type: 'seizureProfile' })) as unknown as SeizureProfile[]).sort(
    (a, b) => a.position - b.position,
  );
const answer = (user: ReturnType<typeof userEvent.setup>, question: string, option: string) =>
  user.click(within(screen.getByRole('group', { name: question })).getByRole('button', { name: option }));

describe('seizure profiles', () => {
  it('adds a profile with its ILAE 2025 answers and the signs of a seizure', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    const symptom = {
      id: crypto.randomUUID(),
      code: SHAKING,
      area: null,
      moment: 0,
      order: 0,
      sincePrevious: { kind: 'unknown', ms: null },
      isFirst: true,
      phase: 'seizure',
    };
    await ctx.api.createRecord({ type: 'seizure', values: makeSeizure(patientId, 60, 90, { symptoms: [symptom] }) });
    const user = await openProfiles(ctx);
    expect(screen.getByText('No profiles yet.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add a profile' }));
    const sheet = screen.getByRole('dialog');
    await user.type(within(sheet).getByLabelText('Name'), 'Usual seizure');
    await answer(user, 'Where did it start?', 'Focal');
    await answer(user, 'Could the person remember it afterwards?', 'No');
    const copy = within(sheet).getByLabelText('Copy the signs of a seizure') as HTMLSelectElement;
    await user.selectOptions(copy, copy.options[1]!.value);
    expect(within(sheet).getByText(/Rhythmic Shaking/i)).toBeTruthy();
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await screen.findByText('Profile saved');
    expect(await screen.findByText('Focal impaired consciousness seizure')).toBeTruthy();
    expect(await profiles(ctx)).toMatchObject([
      {
        name: 'Usual seizure',
        position: 0,
        ilae: { ...NO_ANSWERS, class: 'focal', recall: 'no' },
        signs: [{ code: SHAKING, phase: 'seizure' }],
      },
    ]);
  });

  it('changes the order, and editing a profile never changes a seizure saved with it', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    const first = await profile(ctx, patientId, 'Usual seizure', 0, { ilae: { ...NO_ANSWERS, class: 'focal' } });
    await profile(ctx, patientId, 'Night seizure', 1);
    const seizure = (await ctx.api.createRecord({
      type: 'seizure',
      values: makeSeizure(patientId, 60, 90, {
        typeCode: null,
        profile: { id: first.id, name: 'Usual seizure' },
        ilae2025: first.ilae,
      }),
    })) as unknown as Seizure;
    const user = await openProfiles(ctx);
    const cards = () => screen.getAllByText(/^(Usual seizure|Night seizure)$/).map((x) => x.textContent);
    expect(cards()).toEqual(['Usual seizure', 'Night seizure']);
    await user.click(screen.getAllByRole('button', { name: 'Move down' })[0]!);
    await waitFor(() => expect(cards()).toEqual(['Night seizure', 'Usual seizure']));
    expect((await profiles(ctx)).map((p) => [p.name, p.position])).toEqual([
      ['Night seizure', 0],
      ['Usual seizure', 1],
    ]);
    await user.click(screen.getAllByRole('button', { name: 'Edit profile' })[1]!);
    const sheet = screen.getByRole('dialog');
    const name = within(sheet).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Day seizure');
    await answer(user, 'Where did it start?', 'Generalized');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await screen.findByText('Day seizure');
    expect((await profiles(ctx))[1]).toMatchObject({ name: 'Day seizure', ilae: { class: 'generalized' } });
    const kept = (await ctx.client.get({ type: 'seizure', id: seizure.id })) as unknown as Seizure;
    expect(kept.profile).toEqual({ id: first.id, name: 'Usual seizure' });
    expect(kept.ilae2025).toEqual({ ...NO_ANSWERS, class: 'focal' });
  });

  it('asks before removing, and a seizure saved with the profile keeps its classification', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    const p = await profile(ctx, patientId, 'Usual seizure', 0, { ilae: { ...NO_ANSWERS, class: 'unknown' } });
    const seizure = (await ctx.api.createRecord({
      type: 'seizure',
      values: makeSeizure(patientId, 60, 90, { typeCode: null, profile: { id: p.id, name: p.name }, ilae2025: p.ilae }),
    })) as unknown as Seizure;
    const user = await openProfiles(ctx);
    await user.click(screen.getByRole('button', { name: 'Remove profile' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toMatch(/Seizures saved with it keep their classification/);
    await user.click(within(dialog).getByRole('button', { name: 'Remove profile' }));
    await screen.findByText('Profile removed');
    expect(await profiles(ctx)).toEqual([]);
    const kept = (await ctx.client.get({ type: 'seizure', id: seizure.id })) as unknown as Seizure;
    expect(kept).toMatchObject({ profile: { id: p.id, name: 'Usual seizure' }, ilae2025: { class: 'unknown' } });
  });

  it('allows up to twelve profiles', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    for (let i = 0; i < 12; i++) await profile(ctx, patientId, `Kind ${i + 1}`, i);
    await openProfiles(ctx);
    expect(screen.queryByRole('button', { name: 'Add a profile' })).toBeNull();
    expect(screen.getByText('There are already 12 profiles, the most there can be.')).toBeTruthy();
  });
});
