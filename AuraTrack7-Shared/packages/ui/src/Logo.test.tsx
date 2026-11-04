// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Logo } from './Logo';

afterEach(cleanup);

describe('Logo', () => {
  it('shows the image at the given size and stays silent for screen readers', () => {
    const { container } = render(<Logo src="/icons/icon-192.png" size={72} />);
    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toBe('/icons/icon-192.png');
    expect(image?.getAttribute('width')).toBe('72');
    expect(image?.getAttribute('height')).toBe('72');
    expect(image?.getAttribute('alt')).toBe('');
  });
});
