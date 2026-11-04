// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);
import { NavBar } from './NavBar';

const items = [
  { id: 'home', label: 'Home' },
  { id: 'history', label: 'History' },
];

describe('NavBar', () => {
  it('marks the current place and tells a screen reader which it is', () => {
    render(<NavBar items={items} current="history" onSelect={() => undefined} label="Main menu" />);
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'History' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Home' }).getAttribute('aria-current')).toBeNull();
  });

  it('opens another place, and does nothing when the current one is tapped', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<NavBar items={items} current="home" onSelect={onSelect} label="Main menu" />);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onSelect).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(onSelect).toHaveBeenCalledWith('history');
  });
});
