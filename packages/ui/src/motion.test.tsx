// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, useReducedMotion } from './motion';

let reduce = false;
let listeners: (() => void)[] = [];

beforeEach(() => {
  reduce = false;
  listeners = [];
  window.matchMedia = vi.fn(
    () =>
      ({
        get matches() {
          return reduce;
        },
        addEventListener: (_: string, fn: () => void) => listeners.push(fn),
        removeEventListener: (_: string, fn: () => void) => (listeners = listeners.filter((l) => l !== fn)),
      }) as unknown as MediaQueryList,
  );
  delete document.documentElement.dataset.motion;
});
afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.motion;
});

describe('reduced motion', () => {
  it('follows the phone setting', () => {
    expect(prefersReducedMotion()).toBe(false);
    reduce = true;
    expect(prefersReducedMotion()).toBe(true);
  });

  it('the app setting wins over the phone, either way', () => {
    reduce = true;
    document.documentElement.dataset.motion = 'full';
    expect(prefersReducedMotion()).toBe(false);
    reduce = false;
    document.documentElement.dataset.motion = 'reduce';
    expect(prefersReducedMotion()).toBe(true);
  });

  it('the hook updates when the phone setting changes, and when the app setting changes, and stops listening on unmount', async () => {
    function Show() {
      return <p>{useReducedMotion() ? 'reduced' : 'full'}</p>;
    }
    const { unmount } = render(<Show />);
    expect(screen.getByText('full')).toBeTruthy();
    reduce = true;
    act(() => listeners.forEach((l) => l()));
    expect(screen.getByText('reduced')).toBeTruthy();
    reduce = false;
    act(() => listeners.forEach((l) => l()));
    expect(screen.getByText('full')).toBeTruthy();
    await act(async () => {
      document.documentElement.dataset.motion = 'reduce';
      await Promise.resolve();
    });
    expect(screen.getByText('reduced')).toBeTruthy();
    unmount();
    expect(listeners).toHaveLength(0);
  });
});
