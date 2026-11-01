// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScreenStack } from './Navigator';

function Home() {
  const nav = useNav();
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>home {count}</p>
      <button onClick={() => setCount(count + 1)}>count</button>
      <button onClick={() => nav.push('detail', { id: 'a1' })}>open</button>
      <button onClick={() => nav.replace('detail', { id: 'r1' })}>replace</button>
      <span data-testid="depth">{nav.depth}</span>
    </div>
  );
}
function Detail({ id }: { id: string }) {
  const nav = useNav();
  return (
    <div>
      <p>detail {id}</p>
      <button onClick={() => nav.pop()}>back</button>
      <button onClick={() => nav.push('detail', { id: `${id}+` })}>deeper</button>
    </div>
  );
}

const { ScreenStack, useNavigator } = createScreenStack({ home: Home, detail: Detail });
const useNav = useNavigator;

beforeEach(() => {
  window.history.replaceState(null, '');
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(cleanup);

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

describe('screen stack', () => {
  it('starts on the first screen, with depth 1', () => {
    render(<ScreenStack initial="home" />);
    expect(screen.getByText('home 0')).toBeTruthy();
    expect(screen.getByTestId('depth').textContent).toBe('1');
    expect(window.history.state).toEqual({ auratrackDepth: 0 });
  });

  it('opens a screen with its props on top, and the one below stays mounted but hidden and inert', async () => {
    const { container } = render(<ScreenStack initial="home" />);
    await userEvent.click(screen.getByText('count'));
    await userEvent.click(screen.getByText('open'));
    expect(screen.getByText('detail a1')).toBeTruthy();
    const screens = [...container.querySelectorAll<HTMLElement>('.ui-stack-screen')];
    expect(screens.map((s) => [s.dataset.screen, s.hasAttribute('inert'), s.getAttribute('aria-hidden')])).toEqual([
      ['home', true, 'true'],
      ['detail', false, 'false'],
    ]);
    expect(screen.queryByRole('button', { name: 'count' })).toBeNull(); // hidden from the accessibility tree
    expect(window.history.state).toEqual({ auratrackDepth: 1 });
  });

  it('going back returns to the screen below with its state, and moves focus onto it', async () => {
    const { container } = render(<ScreenStack initial="home" />);
    await userEvent.click(screen.getByText('count'));
    await userEvent.click(screen.getByText('open'));
    expect(document.activeElement).toBe(container.querySelector('[data-screen="detail"]'));
    await userEvent.click(screen.getByText('back'));
    await settle();
    expect(screen.getByText('home 1')).toBeTruthy();
    expect(container.querySelectorAll('.ui-stack-screen')).toHaveLength(1);
    expect(document.activeElement).toBe(container.querySelector('[data-screen="home"]'));
  });

  it('back on the first screen does nothing', async () => {
    const back = vi.spyOn(window.history, 'back');
    const only = createScreenStack({ only: Only });
    function Only() {
      const nav = only.useNavigator();
      return <button onClick={() => nav.pop()}>pop</button>;
    }
    const OnlyStack = only.ScreenStack;
    const { container } = render(<OnlyStack initial="only" />);
    await userEvent.click(screen.getByText('pop'));
    expect(back).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.ui-stack-screen')).toHaveLength(1);
    back.mockRestore();
  });

  it('the phone back gesture (the browser history) goes back several screens at once when it jumps', async () => {
    const { container } = render(<ScreenStack initial="home" />);
    await userEvent.click(screen.getByText('open'));
    await userEvent.click(screen.getByText('deeper'));
    expect(container.querySelectorAll('.ui-stack-screen')).toHaveLength(3);
    act(() => {
      window.history.replaceState({ auratrackDepth: 0 }, '');
      window.dispatchEvent(new PopStateEvent('popstate', { state: { auratrackDepth: 0 } }));
    });
    expect(container.querySelectorAll('.ui-stack-screen')).toHaveLength(1);
    expect(screen.getByText('home 0')).toBeTruthy();
  });

  it('a history entry from before a reload (no depth) leaves the first screen; a forward step changes nothing', async () => {
    const { container } = render(<ScreenStack initial="home" />);
    await userEvent.click(screen.getByText('open'));
    act(() => void window.dispatchEvent(new PopStateEvent('popstate', { state: { auratrackDepth: 5 } })));
    expect(container.querySelectorAll('.ui-stack-screen')).toHaveLength(2);
    act(() => void window.dispatchEvent(new PopStateEvent('popstate', { state: null })));
    expect(container.querySelectorAll('.ui-stack-screen')).toHaveLength(1);
  });

  it('replace swaps the top screen without adding one', async () => {
    const { container } = render(<ScreenStack initial="home" />);
    await userEvent.click(screen.getByText('replace'));
    expect(screen.getByText('detail r1')).toBeTruthy();
    expect(container.querySelectorAll('.ui-stack-screen')).toHaveLength(1);
  });

  it('starts on any screen, with its props', () => {
    render(<ScreenStack initial="detail" initialProps={{ id: 'first' }} />);
    expect(screen.getByText('detail first')).toBeTruthy();
  });

  it('remembers how far the screen below was scrolled, and returns there', async () => {
    Object.defineProperty(window, 'scrollY', { value: 240, configurable: true });
    render(<ScreenStack initial="home" />);
    await userEvent.click(screen.getByText('open'));
    await userEvent.click(screen.getByText('back'));
    await settle();
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 240);
  });

  it('useNavigator outside a stack says so', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Home />)).toThrow('useNavigator must be used inside the ScreenStack');
    spy.mockRestore();
  });
});
