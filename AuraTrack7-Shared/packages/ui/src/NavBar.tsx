import type { CSSProperties } from 'react';

export interface NavBarItem {
  id: string;
  label: string;
}

export interface NavBarProps {
  items: readonly NavBarItem[];
  current: string;
  onSelect: (id: string) => void;
  /** Names the bar for a screen reader ("Main menu"). */
  label: string;
}

/**
 * The app's main places side by side, equal in width, in the page flow (not fixed to the screen edge, so it can never
 * cover content). The current one is marked for sight and for a screen reader.
 */
export function NavBar({ items, current, onSelect, label }: NavBarProps) {
  return (
    <nav className="ui-navbar" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="ui-navbar__item"
          aria-current={item.id === current ? 'page' : undefined}
          onClick={() => item.id !== current && onSelect(item.id)}
        >
          {/* The text is sized so its longest word fits the tab: words are never split or hyphenated */}
          <span
            className="ui-navbar__label"
            style={{ '--longest': Math.max(4, ...item.label.split(/\s+/).map((w) => w.length)) } as CSSProperties}
          >
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
