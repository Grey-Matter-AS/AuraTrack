import { expect, test } from './fixtures/twoAppContexts';
import { countStoreRows, seedAuraTrackState } from './support/auraTrackDb';

test.describe('AuraTrack dual-browser storage isolation', () => {
  test('keeps IndexedDB separate between two simulated installations', async ({ appPair }) => {
    const { pageA, pageB } = appPair;
    const seededEvent = {
      id: 1,
      uuid: 'test-event-browser-a',
      startTime: Date.UTC(2026, 0, 15, 9, 30, 0),
      date: '1/15/2026',
      time: '9:30:00 AM',
      duration: 90,
      laps: {},
      type: 'Uncategorized',
      isComplete: false,
      editLog: [],
      userModeAtTime: 'self',
      isManualEntry: true,
      videoAttached: false,
      eegSessionId: null,
    };

    await seedAuraTrackState(pageA, { events: [seededEvent] });
    await Promise.all([pageA.goto('/'), pageB.goto('/')]);

    await expect(pageA.getByRole('button', { name: 'START' })).toBeVisible();
    await expect(pageB.getByRole('button', { name: 'START' })).toBeVisible();

    await expect.poll(() => countStoreRows(pageA, 'events')).toBe(1);
    await expect.poll(() => countStoreRows(pageB, 'events')).toBe(0);

    await expect(pageA.getByText('LAST 5')).toBeVisible();
    await expect(pageB.getByText('No events recorded yet.')).toBeVisible();
  });
});
