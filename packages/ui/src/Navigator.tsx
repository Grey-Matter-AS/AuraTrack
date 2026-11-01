import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from 'react';

// A stack of screens, like a phone's own: opening one puts it on top, back returns to the one below with its state and
// scroll position as they were. It follows the browser history, so the phone's back gesture and button work.
// The screens below stay mounted but hidden and inert, so a screen reader reads only the one on top.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- screens take any props; push() checks them per screen
export type ScreenMap = Record<string, ComponentType<any>>;

export interface Navigator<M extends ScreenMap> {
  push<K extends keyof M & string>(name: K, props?: ComponentProps<M[K]>): void;
  replace<K extends keyof M & string>(name: K, props?: ComponentProps<M[K]>): void;
  /** Goes back one screen (the same as the phone's back). Does nothing on the first screen. */
  pop(): void;
  /** How many screens are open; 1 on the first. */
  depth: number;
}

interface Entry {
  uid: number;
  name: string;
  props: object;
  scrollY: number;
}

const HISTORY_KEY = 'auratrackDepth';

export function createScreenStack<M extends ScreenMap>(screens: M) {
  const Context = createContext<Navigator<M> | null>(null);

  function ScreenStack({
    initial,
    initialProps,
  }: {
    initial: keyof M & string;
    initialProps?: ComponentProps<M[keyof M & string]>;
  }) {
    const uid = useRef(1);
    const [entries, setEntries] = useState<Entry[]>(() => [
      { uid: 0, name: initial, props: initialProps ?? {}, scrollY: 0 },
    ]);
    const topRef = useRef<HTMLDivElement>(null);
    const announce = useRef(false);

    // A reload keeps the browser's history entries but not our screens: start again from the first screen
    useEffect(() => {
      window.history.replaceState({ ...(window.history.state as object | null), [HISTORY_KEY]: 0 }, '');
    }, []);

    useEffect(() => {
      const onPop = (event: PopStateEvent) => {
        const depth = (event.state as Record<string, unknown> | null)?.[HISTORY_KEY];
        const keep = typeof depth === 'number' ? depth + 1 : 1;
        announce.current = true;
        setEntries((list) => (keep < list.length ? list.slice(0, Math.max(1, keep)) : list));
      };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }, []);

    // After a change, focus moves to the screen now on top, and the page returns to where that screen was scrolled
    const top = entries[entries.length - 1];
    useEffect(() => {
      if (!announce.current) return;
      announce.current = false;
      topRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, top?.scrollY ?? 0);
    }, [entries.length, top?.scrollY, top?.uid]);

    const push = useCallback((name: string, props?: object) => {
      announce.current = true;
      setEntries((list) => {
        window.history.pushState({ [HISTORY_KEY]: list.length }, '');
        const last = list[list.length - 1];
        const saved = list.map((entry) => (entry === last ? { ...entry, scrollY: window.scrollY } : entry));
        return [...saved, { uid: uid.current++, name, props: props ?? {}, scrollY: 0 }];
      });
    }, []);
    const replace = useCallback((name: string, props?: object) => {
      announce.current = true;
      setEntries((list) => [...list.slice(0, -1), { uid: uid.current++, name, props: props ?? {}, scrollY: 0 }]);
    }, []);
    const pop = useCallback(() => {
      if ((window.history.state as Record<string, unknown> | null)?.[HISTORY_KEY] === 0) return;
      window.history.back();
    }, []);

    const navigator = useMemo(
      () => ({ push, replace, pop, depth: entries.length }) as unknown as Navigator<M>,
      [push, replace, pop, entries.length],
    );

    return (
      <Context.Provider value={navigator}>
        {entries.map((entry, index) => {
          const Screen = screens[entry.name] as ComponentType<object>;
          const isTop = index === entries.length - 1;
          return (
            <div
              key={entry.uid}
              ref={isTop ? topRef : undefined}
              tabIndex={-1}
              className="ui-stack-screen"
              inert={!isTop}
              aria-hidden={!isTop}
              data-screen={entry.name}
            >
              <Screen {...entry.props} />
            </div>
          );
        })}
      </Context.Provider>
    );
  }

  function useNavigator(): Navigator<M> {
    const value = useContext(Context);
    if (!value) throw new Error('useNavigator must be used inside the ScreenStack');
    return value;
  }

  return { ScreenStack, useNavigator };
}

export type { ReactNode };
