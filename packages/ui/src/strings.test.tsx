// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CalendarIcon, ClockIcon, BackIcon, CloseIcon } from './icons';
import { ENGLISH, UiStringsProvider, useUiStrings } from './strings';

afterEach(cleanup);

function Show() {
  const s = useUiStrings();
  return <p>{`${s.close}|${s.choose}|${s.position(2, 4)}`}</p>;
}

describe('UiStrings', () => {
  it('is English without a provider, and a provider replaces only what it gives', () => {
    const { unmount } = render(<Show />);
    expect(screen.getByText('Close|Choose…|2 of 4')).toBeTruthy();
    unmount();
    render(
      <UiStringsProvider strings={{ close: 'Lukk' }}>
        <Show />
      </UiStringsProvider>,
    );
    expect(screen.getByText('Lukk|Choose…|2 of 4')).toBeTruthy();
    expect(ENGLISH.close).toBe('Close');
  });
});

describe('icons', () => {
  it('are decorative, unfocusable, and sized by the text', () => {
    const { container } = render(
      <>
        <CloseIcon />
        <BackIcon />
        <CalendarIcon />
        <ClockIcon />
      </>,
    );
    const svgs = [...container.querySelectorAll('svg')];
    expect(svgs).toHaveLength(4);
    for (const svg of svgs) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      expect(svg.getAttribute('focusable')).toBe('false');
      expect(svg.getAttribute('width')).toBe('1em');
    }
  });
});
