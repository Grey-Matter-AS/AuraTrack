// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, ButtonRow, CloseButton, IconButton, RoundButton } from './Buttons';
import { UiStringsProvider } from './strings';

afterEach(cleanup);

describe('Button', () => {
  it('is a button that never submits a form by itself, and has the variant and size classes', () => {
    render(
      <Button variant="primary" size="lg" fullWidth>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveProperty('type', 'button');
    expect(button.className).toBe('ui-btn ui-btn--primary ui-btn--lg ui-btn--full');
  });

  it('defaults to a secondary, medium button and shows an icon before the text', () => {
    render(<Button icon={<svg data-testid="icon" />}>Cancel</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toBe('ui-btn ui-btn--secondary ui-btn--md');
    expect(button.firstElementChild).toBe(screen.getByTestId('icon'));
  });

  it('calls onClick, and does not when disabled', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('IconButton', () => {
  it('can be round, and keeps its name without any text', () => {
    render(
      <IconButton label="Lock" tone="danger" round>
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Lock' });
    expect(button.className).toContain('ui-icon-btn--round');
    expect(button.textContent).toBe('');
  });

  it('takes its accessible name from the required label, and shows it as a tooltip', () => {
    render(
      <IconButton label="Delete" tone="danger">
        <svg />
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.getAttribute('title')).toBe('Delete');
    expect(button.className).toBe('ui-icon-btn ui-icon-btn--danger');
  });

  it('has no tone class when neutral', () => {
    render(<IconButton label="More">x</IconButton>);
    expect(screen.getByRole('button').className).toBe('ui-icon-btn');
  });
});

describe('CloseButton', () => {
  it('is named "Close" by default and uses the language of the app when given', () => {
    const { unmount } = render(<CloseButton />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    unmount();
    render(
      <UiStringsProvider strings={{ close: 'Lukk' }}>
        <CloseButton />
      </UiStringsProvider>,
    );
    expect(screen.getByRole('button', { name: 'Lukk' })).toBeTruthy();
  });
});

describe('ButtonRow', () => {
  it('wraps its buttons, or stacks them', () => {
    const { container, rerender } = render(
      <ButtonRow>
        <Button>A</Button>
      </ButtonRow>,
    );
    expect(container.firstElementChild?.className).toBe('ui-button-row');
    rerender(
      <ButtonRow stack>
        <Button>A</Button>
      </ButtonRow>,
    );
    expect(container.firstElementChild?.className).toBe('ui-button-row ui-button-row--stack');
  });
});

describe('RoundButton', () => {
  it('is a real button with its text inside, in the red or amber style, and calls onClick', async () => {
    const onClick = vi.fn();
    render(
      <>
        <RoundButton tone="danger" onClick={onClick}>
          Start timer
        </RoundButton>
        <RoundButton tone="warning" icon={<svg data-testid="icon" />}>
          Log past seizure
        </RoundButton>
      </>,
    );
    const start = screen.getByRole('button', { name: 'Start timer' });
    expect(start.getAttribute('type')).toBe('button');
    expect(start.className).toContain('ui-round--danger');
    await userEvent.click(start);
    expect(onClick).toHaveBeenCalledOnce();
    const past = screen.getByRole('button', { name: 'Log past seizure' });
    expect(past.className).toContain('ui-round--warning');
    expect(past.querySelector('[data-testid="icon"]')).toBeTruthy();
  });

  it('can be disabled', () => {
    render(
      <RoundButton tone="danger" disabled>
        Start
      </RoundButton>,
    );
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
