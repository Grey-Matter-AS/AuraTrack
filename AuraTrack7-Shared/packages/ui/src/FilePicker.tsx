import { useRef } from 'react';
import { Button, type ButtonProps } from './Buttons';

export interface FilePickerProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /** The words on the button, such as "Choose a file". */
  label: string;
  /** What the phone offers to pick, such as ".atbak,.json". */
  accept?: string;
  onPick: (file: File) => void;
}

/** A button that opens the phone's file chooser. The chosen file goes to `onPick`; the same file can be chosen again. */
export function FilePicker({ label, accept, onPick, ...rest }: FilePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button {...rest} onClick={() => input.current?.click()}>
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        {...(accept ? { accept } : {})}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ''; // so choosing the same file again still counts
          if (file) onPick(file);
        }}
      />
    </>
  );
}
