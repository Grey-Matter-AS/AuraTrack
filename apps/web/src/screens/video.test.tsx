// @vitest-environment jsdom
import { cleanup, configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSeizure, openPlace, seed, setup } from './testSupport';

// Video: the setting, a recording on a browser with no camera, and a seizure's video played, saved and deleted.
// (The real camera is checked in the browser tests, with a fake camera.)
configure({ asyncUtilTimeout: 8000 });
afterEach(cleanup);
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:test');
  URL.revokeObjectURL = vi.fn();
});

type Ctx = ReturnType<typeof setup>;

describe('recording with video switched on', () => {
  it('carries on without video, says why, and adds no button, on a browser with no camera', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await ctx.client.createRecord({
      type: 'setting',
      values: { patientId, scope: 'device', key: 'videoEnabled', value: true },
    });
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    await screen.findByRole('timer');
    expect(await screen.findByText('The camera is not available, so this recording has no video.')).toBeTruthy();
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['End aura', 'End seizure', 'FELL', 'BLUE', 'VOMITED', 'WET']);
    await user.click(screen.getByRole('button', { name: 'End seizure' }));
    await screen.findByRole('button', { name: 'Add details' });
    await ctx.f.advance(0, 1000);
    expect((await ctx.client.list({ type: 'seizure' }))[0]).toMatchObject({ video: null });
  });

  it('records with no video note when the setting is off', async () => {
    const ctx = setup();
    await seed(ctx);
    const user = userEvent.setup();
    ctx.mount();
    await user.click(await screen.findByRole('button', { name: 'Start timer' }));
    await screen.findByRole('timer');
    expect(screen.queryByText(/camera/)).toBeNull();
  });
});

async function withVideo(ctx: Ctx) {
  const { patientId } = await seed(ctx);
  const seizure = (await ctx.client.createRecord({
    type: 'seizure',
    values: makeSeizure(patientId, 60, 40),
  })) as unknown as { id: string };
  await ctx.client.videoPut({
    seizureId: seizure.id,
    mime: 'video/webm',
    bytes: new Uint8Array(2 * 1_048_576),
    fileName: 'AuraTrack-seizure-test.webm',
  });
  const user = userEvent.setup();
  ctx.mount();
  await screen.findByRole('button', { name: 'Start timer' });
  await openPlace(user, 'History');
  await user.click(await screen.findByRole('button', { name: 'Open' }));
  return { user, seizure };
}

describe('the video of a seizure', () => {
  it('plays from the sealed copy, shows its size, and says it stays on this phone', async () => {
    const ctx = setup();
    await withVideo(ctx);
    const section = (await screen.findByText('AuraTrack-seizure-test.webm')).closest('section, div') as HTMLElement;
    expect(section).toBeTruthy();
    await waitFor(() => expect(document.querySelector('video.app-video')).not.toBeNull());
    expect(await screen.findByText('2.0 MB')).toBeTruthy();
    expect(screen.getByText(/encrypted on this device only/)).toBeTruthy();
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('says where the video is when this phone does not have it (it was filmed on another)', async () => {
    const ctx = setup();
    const { patientId } = await seed(ctx);
    await ctx.client.createRecord({
      type: 'seizure',
      values: makeSeizure(patientId, 60, 40, { video: { fileName: 'from-the-other-phone.webm' } }),
    });
    const user = userEvent.setup();
    ctx.mount();
    await screen.findByRole('button', { name: 'Start timer' });
    await openPlace(user, 'History');
    await user.click(await screen.findByRole('button', { name: 'Open' }));
    expect(await screen.findByText('from-the-other-phone.webm')).toBeTruthy();
    expect(await screen.findByText(/stays on the device that filmed it/)).toBeTruthy();
    expect(document.querySelector('video')).toBeNull();
  });

  it('saves a copy as a file on request', async () => {
    const ctx = setup();
    const { user } = await withVideo(ctx);
    const clicked: string[] = [];
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    };
    await user.click(await screen.findByRole('button', { name: 'Save a copy' }));
    HTMLAnchorElement.prototype.click = original;
    expect(clicked).toEqual(['AuraTrack-seizure-test.webm']);
  });

  it('deletes only the video after asking, and the seizure stays', async () => {
    const ctx = setup();
    const { user, seizure } = await withVideo(ctx);
    await user.click(await screen.findByRole('button', { name: 'Delete the video' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await ctx.client.videoList()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Delete the video' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await ctx.client.videoList()).toHaveLength(0));
    await waitFor(async () =>
      expect((await ctx.client.list({ type: 'seizure' })).find((s) => s.id === seizure.id)).toMatchObject({
        video: null,
      }),
    );
    await waitFor(() => expect(screen.queryByText('AuraTrack-seizure-test.webm')).toBeNull());
  });

  it('deleting the seizure deletes its video', async () => {
    const ctx = setup();
    const { user } = await withVideo(ctx);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(async () => expect(await ctx.client.videoList()).toHaveLength(0));
  });
});
