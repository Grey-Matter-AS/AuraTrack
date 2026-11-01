import { useEffect, useRef, type RefObject } from 'react';

// Shared behaviour for every overlay (sheet, dialog): Escape closes it, the page behind cannot scroll, keyboard and
// screen-reader focus moves in, stays inside (Tab wraps) and returns to where it was on close. When several overlays
// are open, only the topmost reacts.
const stack: (HTMLElement | null)[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapTab(event: KeyboardEvent, panel: HTMLElement) {
  const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    panel.focus();
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/** How many overlays are open right now (used by tests and by the toast host). */
export const openOverlays = (): number => stack.length;

export function useOverlayBehaviour(
  onClose: (() => void) | undefined,
  dismissible: boolean,
  panelRef: RefObject<HTMLElement | null>,
) {
  const closeRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => {
    closeRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    const panel = panelRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    stack.push(panel);
    document.body.dataset.overlayOpen = 'true';
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Into the overlay, unless a field inside has already taken focus
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== panel) return;
      if (event.key === 'Escape' && dismissibleRef.current) closeRef.current?.();
      if (event.key === 'Tab' && panel) trapTab(event, panel);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(panel), 1);
      if (stack.length === 0) {
        delete document.body.dataset.overlayOpen;
        document.body.style.overflow = previousOverflow;
      }
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [panelRef]);
}
