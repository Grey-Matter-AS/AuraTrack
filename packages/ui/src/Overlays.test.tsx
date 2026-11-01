// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from './Buttons';
import { BottomSheet, Dialog, ToastProvider, useToast } from './Overlays';
import { openOverlays } from './overlay';
import { UiStringsProvider } from './strings';

afterEach(cleanup);

describe('BottomSheet', () => {
  it('is a modal dialog with a title, a body and a footer', () => {
    render(
      <BottomSheet title="Add dose" onClose={() => {}} footer={<Button>Save</Button>}>
        <p>content</p>
      </BottomSheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add dose' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('content')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('moves focus into the sheet, locks the page behind it, and gives both back on close', () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    const { unmount } = render(
      <BottomSheet title="T" onClose={() => {}}>
        x
      </BottomSheet>,
    );
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.dataset.overlayOpen).toBe('true');
    expect(openOverlays()).toBe(1);
    unmount();
    expect(document.activeElement).toBe(outside);
    expect(document.body.style.overflow).toBe('');
    expect(document.body.dataset.overlayOpen).toBeUndefined();
    expect(openOverlays()).toBe(0);
    outside.remove();
  });

  it('leaves focus on a field that took it itself', () => {
    render(
      <BottomSheet title="T" onClose={() => {}}>
        <input aria-label="name" autoFocus />
      </BottomSheet>,
    );
    expect(document.activeElement).toBe(screen.getByLabelText('name'));
  });

  it('closes with Escape, the close button, or a tap outside, but not a tap inside', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet title="T" onClose={onClose}>
        <p>inside</p>
      </BottomSheet>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByText('inside'));
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('is not dismissed by Escape or a tap outside when not dismissible, and has no close button', async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet title="Alert" dismissible onClose={onClose}>
        x
      </BottomSheet>,
    );
    cleanup();
    render(
      <BottomSheet title="Alert" dismissible={false} onClose={onClose}>
        x
      </BottomSheet>,
    );
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('has no header at all without a title and a way to close', () => {
    const { container } = render(<BottomSheet dismissible={false}>x</BottomSheet>);
    expect(container.querySelector('.ui-sheet__header')).toBeNull();
    expect(container.querySelector('.ui-sheet__footer')).toBeNull();
  });

  it('uses the app language for the close button', () => {
    render(
      <UiStringsProvider strings={{ close: 'Lukk' }}>
        <BottomSheet title="T" onClose={() => {}}>
          x
        </BottomSheet>
      </UiStringsProvider>,
    );
    expect(screen.getByRole('button', { name: 'Lukk' })).toBeTruthy();
  });

  it('keeps Tab inside: from the last control to the first, and back with Shift+Tab', async () => {
    render(
      <>
        <button>outside</button>
        <BottomSheet title="T" onClose={() => {}}>
          <input aria-label="one" />
          <input aria-label="two" />
        </BottomSheet>
      </>,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    const two = screen.getByLabelText('two');
    two.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(close);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(two);
    screen.getByRole('dialog').focus();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(two);
  });

  it('with nothing to focus, Tab stays on the panel', async () => {
    render(
      <BottomSheet title="T" dismissible={false}>
        text only
      </BottomSheet>,
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });
});

describe('Dialog', () => {
  it('is an alert dialog with a title, a message and its actions', () => {
    render(<Dialog title="Delete?" message="This cannot be undone." actions={<Button>Delete</Button>} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete?' });
    expect(dialog.textContent).toContain('This cannot be undone.');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('can carry a danger tone, and extra content, and have no title or message', () => {
    const { container, rerender } = render(
      <Dialog title="Stop" tone="danger">
        <p>extra</p>
      </Dialog>,
    );
    expect(container.querySelector('.ui-dialog__title--danger')).toBeTruthy();
    expect(screen.getByText('extra')).toBeTruthy();
    rerender(<Dialog>bare</Dialog>);
    expect(container.querySelector('.ui-dialog__title')).toBeNull();
    expect(container.querySelector('.ui-dialog__message')).toBeNull();
    expect(container.querySelector('.ui-dialog__actions')).toBeNull();
  });

  it('title without danger has the plain style', () => {
    const { container } = render(<Dialog title="Plain" />);
    expect(container.querySelector('.ui-dialog__title')?.className).toBe('ui-dialog__title');
  });

  it('closes with Escape or a tap outside, unless it is not dismissible', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Dialog title="T" onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('alertdialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
    rerender(<Dialog title="T" onClose={onClose} dismissible={false} />);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('alertdialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('only the topmost overlay reacts', () => {
  function Stacked({ onBottom, onTop }: { onBottom: () => void; onTop: () => void }) {
    const [top, setTop] = useState(true);
    return (
      <>
        <BottomSheet title="Bottom" onClose={onBottom}>
          <button>x</button>
        </BottomSheet>
        {top ? (
          <Dialog
            title="Top"
            onClose={() => {
              onTop();
              setTop(false);
            }}
          />
        ) : null}
      </>
    );
  }

  it('Escape closes the top one first, then the one below', async () => {
    const onBottom = vi.fn();
    const onTop = vi.fn();
    render(<Stacked onBottom={onBottom} onTop={onTop} />);
    expect(openOverlays()).toBe(2);
    await userEvent.keyboard('{Escape}');
    expect(onTop).toHaveBeenCalledTimes(1);
    expect(onBottom).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onBottom).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe('hidden'); // the sheet below is still open
  });
});

describe('toasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function Trigger({ tone, ms }: { tone?: 'success' | 'error'; ms?: number }) {
    const toast = useToast();
    return <button onClick={() => toast('Saved', tone, ms)}>show</button>;
  }

  it('shows a message for four seconds by default, then removes it', () => {
    render(
      <ToastProvider>
        <Trigger tone="success" />
      </ToastProvider>,
    );
    act(() => screen.getByText('show').click());
    const toast = screen.getByRole('status');
    expect(toast.textContent).toBe('Saved');
    expect(toast.className).toBe('ui-toast ui-toast--success');
    act(() => void vi.advanceTimersByTime(3999));
    expect(screen.queryByRole('status')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('uses the given time, is "info" by default, ignores an empty message, and shows at most three', () => {
    function Many() {
      const toast = useToast();
      return (
        <button
          onClick={() => {
            toast('');
            ['one', 'two', 'three', 'four'].forEach((m) => toast(m));
          }}
        >
          many
        </button>
      );
    }
    render(
      <ToastProvider>
        <Trigger ms={1000} />
        <Many />
      </ToastProvider>,
    );
    act(() => screen.getByText('show').click());
    expect(screen.getByRole('status').className).toBe('ui-toast ui-toast--info');
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => screen.getByText('many').click());
    expect(screen.getAllByRole('status').map((t) => t.textContent)).toEqual(['two', 'three', 'four']);
  });

  it('without a provider, showing a message does nothing and does not fail', () => {
    render(<Trigger />);
    act(() => screen.getByText('show').click());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('stops its timers when it goes away', () => {
    const { unmount } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => screen.getByText('show').click());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('toast space', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tells the overlays how much room the messages take, and gives it back when they go', () => {
    let notify: () => void = () => {};
    let height = 0;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          notify = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    const { unmount } = render(<ToastProvider>x</ToastProvider>);
    const host = document.querySelector('.ui-toast-host') as HTMLElement;
    host.getBoundingClientRect = () => ({ height }) as DOMRect;
    expect(document.documentElement.style.getPropertyValue('--toast-space')).toBe('0px');
    height = 60.4;
    act(() => notify());
    expect(document.documentElement.style.getPropertyValue('--toast-space')).toBe('81px');
    height = 0;
    act(() => notify());
    expect(document.documentElement.style.getPropertyValue('--toast-space')).toBe('0px');
    unmount();
    expect(document.documentElement.style.getPropertyValue('--toast-space')).toBe('');
  });

  it('does nothing where the browser cannot observe sizes', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<ToastProvider>x</ToastProvider>);
    expect(document.documentElement.style.getPropertyValue('--toast-space')).toBe('');
  });
});
