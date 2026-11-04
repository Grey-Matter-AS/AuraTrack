import type { CSSProperties, ReactNode } from 'react';

/** One screen: fills the height, keeps clear of notches and home bars, and holds its content to a readable width. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="ui-screen">
      <div className="ui-screen__content">{children}</div>
    </div>
  );
}

/** A scrolling column whose children never shrink. */
export function ScrollArea({ children, maxHeight }: { children: ReactNode; maxHeight?: string }) {
  return (
    <div className="ui-scroll" style={maxHeight ? { maxHeight } : undefined}>
      {children}
    </div>
  );
}

const gap = (value: string | undefined): CSSProperties | undefined =>
  value ? ({ '--ui-gap': value } as CSSProperties) : undefined;

export function Stack({ children, gap: g }: { children: ReactNode; gap?: string }) {
  return (
    <div className="ui-stack" style={gap(g)}>
      {children}
    </div>
  );
}

/** Items side by side that wrap onto the next line when they do not fit. */
export function Cluster({ children, gap: g }: { children: ReactNode; gap?: string }) {
  return (
    <div className="ui-cluster" style={gap(g)}>
      {children}
    </div>
  );
}
