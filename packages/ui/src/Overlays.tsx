import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CloseButton } from './Buttons';
import { useOverlayBehaviour } from './overlay';

interface OverlayProps {
  title?: string;
  onClose?: () => void;
  /** False: only the buttons inside close it (for example a seizure alert). */
  dismissible?: boolean;
  children?: ReactNode;
}

/** Anything with input. Slides up on phones; floats centred on landscape phones, tablets and computers. The body scrolls; the footer stays visible. */
export function BottomSheet({
  title,
  onClose,
  dismissible = true,
  footer,
  children,
}: OverlayProps & { footer?: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayBehaviour(onClose, dismissible, panelRef);
  return (
    <div
      className="ui-overlay"
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className="ui-sheet" role="dialog" aria-modal="true" aria-label={title}>
        {title || (dismissible && onClose) ? (
          <div className="ui-sheet__header">
            <h2 className="ui-sheet__title">{title}</h2>
            {dismissible && onClose ? <CloseButton onClick={onClose} /> : null}
          </div>
        ) : null}
        <div className="ui-sheet__body">{children}</div>
        {footer ? <div className="ui-sheet__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

/** A short question or confirmation. */
export function Dialog({
  title,
  message,
  onClose,
  dismissible = true,
  actions,
  tone,
  children,
}: OverlayProps & { message?: string; actions?: ReactNode; tone?: 'danger' | undefined }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlayBehaviour(onClose, dismissible, panelRef);
  return (
    <div
      className="ui-overlay ui-overlay--dialog"
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className="ui-dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        {title ? (
          <h2 className={tone === 'danger' ? 'ui-dialog__title ui-dialog__title--danger' : 'ui-dialog__title'}>
            {title}
          </h2>
        ) : null}
        {message ? <p className="ui-dialog__message">{message}</p> : null}
        {children}
        {actions ? <div className="ui-dialog__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export type ToastTone = 'info' | 'success' | 'error';
type Show = (message: string, tone?: ToastTone, ms?: number) => void;

const ToastContext = createContext<Show>(() => {});

/** `const toast = useToast(); toast('Saved', 'success')` */
export const useToast = (): Show => useContext(ToastContext);

interface Item {
  id: number;
  message: string;
  tone: ToastTone;
}

const MAX_TOASTS = 3;

/** Shows messages for a few seconds, newest last. They never take taps. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const show = useCallback<Show>((message, tone = 'info', ms = 4000) => {
    if (!message) return;
    const id = next.current++;
    setItems((list) => [...list.slice(-(MAX_TOASTS - 1)), { id, message, tone }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((list) => list.filter((item) => item.id !== id));
    }, ms);
    timers.current.add(timer);
  }, []);
  useEffect(() => {
    const live = timers.current;
    return () => live.forEach(clearTimeout);
  }, []);
  // While a message shows, overlays start below it (see --toast-space in ui.css), so a message never covers a control
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    const root = document.documentElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const height = host.getBoundingClientRect().height;
      root.style.setProperty('--toast-space', height > 0 ? `${Math.ceil(height) + 20}px` : '0px');
    };
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    measure();
    return () => {
      observer.disconnect();
      root.style.removeProperty('--toast-space');
    };
  }, []);
  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div ref={hostRef} className="ui-toast-host" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`ui-toast ui-toast--${item.tone}`} role="status">
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
