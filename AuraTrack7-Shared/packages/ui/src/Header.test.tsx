// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeader, AppTopBar } from './Header';
import { UiStringsProvider } from './strings';

afterEach(cleanup);

describe('AppTopBar', () => {
  it('has the name, the person, and the buttons either side of the person, in that order', () => {
    render(<AppTopBar patient={{ name: 'Sam' }} before={<button>first</button>} after={<button>last</button>} />);
    expect(screen.getByLabelText('AuraTrack')).toBeTruthy();
    expect(screen.getByText('aTr')).toBeTruthy();
    const end = screen.getByText('Sam').closest('.ui-topbar__end');
    expect(end?.textContent).toBe('firstSSamlast');
  });
});

describe('AppHeader', () => {
  it('has the title as the page heading, and nothing else by default', () => {
    render(<AppHeader title="AuraTrack" />);
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'AuraTrack' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the person as a chip with their initial, and a button to switch when it can', async () => {
    const onPatientClick = vi.fn();
    render(<AppHeader title="T" patient={{ name: 'ola' }} onPatientClick={onPatientClick} />);
    const chip = screen.getByRole('button', { name: 'Switch person: ola' });
    expect(chip.querySelector('.ui-patient__dot')?.textContent).toBe('O');
    expect(chip.querySelector('.ui-patient__name')?.textContent).toBe('ola');
    await userEvent.click(chip);
    expect(onPatientClick).toHaveBeenCalledTimes(1);
  });

  it('without a way to switch, the chip is not a button but still named', () => {
    render(<AppHeader title="T" patient={{ name: 'Åse' }} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('img', { name: 'Åse' }).querySelector('.ui-patient__dot')?.textContent).toBe('Å');
  });

  it('an empty name shows "?", and a name starting with a pair of code units is not cut in half', () => {
    const { rerender } = render(<AppHeader title="T" patient={{ name: '  ' }} />);
    expect(document.querySelector('.ui-patient__dot')?.textContent).toBe('?');
    rerender(<AppHeader title="T" patient={{ name: '😀 Ola' }} />);
    expect(document.querySelector('.ui-patient__dot')?.textContent).toBe('😀');
  });

  it('has a back button, in the language of the app, and actions', async () => {
    const onBack = vi.fn();
    render(
      <UiStringsProvider strings={{ back: 'Tilbake' }}>
        <AppHeader title="T" onBack={onBack} actions={<button>Help</button>} />
      </UiStringsProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tilbake' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Help' }).parentElement?.className).toBe('ui-header__actions');
  });

  it('paints the dot in the patient colour when there is one', () => {
    render(<AppHeader title="T" patient={{ name: 'Ola', color: '#1d4ed8' }} />);
    const dot = document.querySelector<HTMLElement>('.ui-patient__dot');
    expect(dot?.style.background).toBe('rgb(29, 78, 216)');
  });
});
