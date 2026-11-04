import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChoiceList } from './Choices';
import { ChevronDownIcon } from './icons';
import { BottomSheet } from './Overlays';
import { useUiStrings } from './strings';

export interface TabItem {
  id: string;
  label: string;
  /** What is in the tab ("3 added", "not filled in yet"): shown in the list of tabs. */
  state?: string;
}

export interface TabsProps {
  tabs: readonly TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Names the set of tabs for a screen reader. */
  label: string;
  /** The content of the active tab. */
  children: ReactNode;
}

/**
 * Tabs that read as tabs. Wide: a row of tabs joined to the panel under it, the chosen one filled with an accent bar.
 * Narrow: one control that is the top edge of the panel, showing the tab's name, "2 of 4" and a dot per tab; tapping
 * it lists all tabs. Wide or narrow is chosen by the width of the space the tabs are in, so it also works in a dialog.
 */
export function Tabs({ tabs, activeTab, onTabChange, label, children }: TabsProps) {
  const strings = useUiStrings();
  const base = useId();
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab),
  );
  const active = tabs[index];
  const tabId = (id: string) => `${base}-tab-${id}`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : move !== undefined
            ? (index + move + tabs.length) % tabs.length
            : null;
    if (target === null) return;
    event.preventDefault();
    const next = tabs[target];
    if (!next) return;
    onTabChange(next.id);
    rowRef.current?.querySelector<HTMLElement>(`[id="${tabId(next.id)}"]`)?.focus();
  };

  if (!active) return null;
  return (
    <div className="ui-tabs">
      <div ref={rowRef} role="tablist" aria-label={label} className="ui-tabs__row" onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={tabId(tab.id)}
            type="button"
            role="tab"
            aria-selected={tab.id === active.id}
            aria-controls={`${base}-panel`}
            tabIndex={tab.id === active.id ? 0 : -1}
            className="ui-tab"
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${strings.chooseTab}: ${active.label}, ${strings.position(index + 1, tabs.length)}`}
        className="ui-tabs__picker"
        onClick={() => setOpen(true)}
      >
        <span className="ui-tabs__picker-line">
          <span className="ui-tabs__picker-name">{active.label}</span>
          <span className="ui-tabs__picker-position">{strings.position(index + 1, tabs.length)}</span>
          <ChevronDownIcon className="ui-tabs__picker-chevron" />
        </span>
        <span className="ui-tabs__dots" aria-hidden="true">
          {tabs.map((tab) => (
            <span key={tab.id} className="ui-tabs__dot" data-active={tab.id === active.id} />
          ))}
        </span>
      </button>
      <div
        key={active.id}
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={tabId(active.id)}
        className="ui-tabs__panel"
      >
        {children}
      </div>
      {open ? (
        <BottomSheet title={label} onClose={() => setOpen(false)}>
          <ChoiceList
            label={label}
            value={active.id}
            options={tabs.map((tab) => ({
              value: tab.id,
              label: tab.label,
              ...(tab.state ? { detail: tab.state } : {}),
            }))}
            onChange={(id) => {
              setOpen(false);
              onTabChange(id);
            }}
          />
        </BottomSheet>
      ) : null}
    </div>
  );
}
