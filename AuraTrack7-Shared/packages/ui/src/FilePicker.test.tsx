// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilePicker } from './FilePicker';

afterEach(cleanup);

describe('FilePicker', () => {
  it('is a button that opens the file chooser, and hands over the file that was chosen', () => {
    const onPick = vi.fn();
    render(<FilePicker label="Choose a file" accept=".atbak" onPick={onPick} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('.atbak');
    const click = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByRole('button', { name: 'Choose a file' }));
    expect(click).toHaveBeenCalled();
    const file = new File(['x'], 'backup.atbak');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPick).toHaveBeenCalledWith(file);
  });

  it('does nothing when no file was chosen, and keeps its input out of the way of a screen reader', () => {
    const onPick = vi.fn();
    render(<FilePicker label="Choose" onPick={onPick} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(onPick).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-hidden')).toBe('true');
    expect(input.hidden).toBe(true);
  });

  it('can be disabled like any button', () => {
    render(<FilePicker label="Choose" disabled onPick={() => undefined} />);
    expect((screen.getByRole('button', { name: 'Choose' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
