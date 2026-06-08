import { expect, test } from '@playwright/test';
import { seedAuraTrackState } from './support/auraTrackDb';
import { createRichCaretakerScenario } from './support/scenarios';

test.describe('AuraTrack mobile layout', () => {
  test('keeps export date selectors on their own line on mobile webkit', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only coverage for stacked date selectors.');

    await seedAuraTrackState(page, createRichCaretakerScenario());
    await page.goto('/');
    await page.getByRole('button', { name: 'HISTORY' }).click();
    await page.getByRole('button', { name: 'Export' }).click();

    const layout = await page.evaluate(() => {
      const stacks = Array.from(document.querySelectorAll('.date-selector-stack')).map((stack) => {
        const children = Array.from(stack.children).map((child) => {
          const rect = child.getBoundingClientRect();
          return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            bottom: rect.bottom,
          };
        });
        return children;
      });

      const actionGroup = document.querySelector('.date-selector-actions');
      const monthInput = document.querySelector('input[type="month"]');
      const actionRect = actionGroup?.getBoundingClientRect();
      const monthRect = monthInput?.getBoundingClientRect();

      return {
        stacks,
        monthRect: monthRect
          ? { top: monthRect.top, bottom: monthRect.bottom, width: monthRect.width }
          : null,
        actionRect: actionRect
          ? { top: actionRect.top, bottom: actionRect.bottom, width: actionRect.width }
          : null,
      };
    });

    expect(layout.stacks.length).toBeGreaterThanOrEqual(2);

    layout.stacks.forEach((children) => {
      for (let index = 1; index < children.length; index += 1) {
        expect(children[index].top).toBeGreaterThanOrEqual(children[index - 1].bottom);
        expect(Math.abs(children[index].left - children[index - 1].left)).toBeLessThan(2);
      }
    });

    expect(layout.monthRect).not.toBeNull();
    expect(layout.actionRect).not.toBeNull();
    expect(layout.actionRect.top).toBeGreaterThanOrEqual(layout.monthRect.bottom);
  });

  test('keeps the stop button reachable on small mobile recording screens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile-only coverage for recording layout.');

    await page.goto('/');
    await page.getByRole('button', { name: 'START' }).click();

    const layout = await page.evaluate(() => {
      const stopButton = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === 'STOP');
      const rect = stopButton?.getBoundingClientRect();

      return rect
        ? {
            top: rect.top,
            bottom: rect.bottom,
            viewportHeight: window.innerHeight,
            scrollHeight: document.documentElement.scrollHeight,
          }
        : null;
    });

    expect(layout).not.toBeNull();
    expect(layout.bottom).toBeLessThanOrEqual(layout.viewportHeight);
  });
});
