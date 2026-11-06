import { useId, useState, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';
import { useUiStrings } from './strings';

export function Section({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="ui-section">
      {title ? (
        <div className="ui-section__header">
          <h2 className="ui-section__title">{title}</h2>
        </div>
      ) : null}
      <div className="ui-section__body">{children}</div>
    </section>
  );
}

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'className' | 'style'> {
  tone?: 'danger' | 'accent';
  /** Tighter padding for row-style cards. */
  compact?: boolean;
  as?: ElementType;
}

export function Card({ tone, compact = false, as: Tag = 'div', children, ...rest }: CardProps) {
  return (
    <Tag className={cx('ui-card', compact && 'ui-card--compact', tone && `ui-card--${tone}`)} {...rest}>
      {children}
    </Tag>
  );
}

export function Inset({ children, ...rest }: Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style'>) {
  return (
    <div className="ui-inset" {...rest}>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="ui-empty">{children}</div>;
}

/**
 * A row that opens to show more: the title and a short summary ("2 chosen") on the left, "Show" or "Hide" with a chevron on
 * the right, a solid border. It reads as something to tap, never as plain text, and says whether it is open.
 */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string | undefined;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const strings = useUiStrings();
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <div className={cx('ui-disclosure', open && 'ui-disclosure--open')}>
      <button
        type="button"
        className="ui-disclosure__head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ui-disclosure__text">
          <span className="ui-disclosure__title">{title}</span>
          {summary ? <span className="ui-disclosure__summary">{summary}</span> : null}
        </span>
        <span className="ui-disclosure__action">
          {open ? strings.hide : strings.show}
          <span className="ui-disclosure__chevron" aria-hidden="true" />
        </span>
      </button>
      {open ? (
        <div id={bodyId} className="ui-disclosure__body">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface NavListItem {
  id: string;
  label: string;
  /** One line under the name: what is behind it. */
  description?: string;
  onClick: () => void;
}

/**
 * A grouped list of places to go, as on the settings screens of iPhone and Android: a small heading, then rows with a
 * name, an optional line of description, and a chevron. Each row is one button.
 */
export function NavList({ title, items }: { title?: string; items: readonly NavListItem[] }) {
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <section className="ui-navlist" aria-labelledby={title ? headingId : undefined}>
      {title ? (
        <h2 id={headingId} className="ui-navlist__title">
          {title}
        </h2>
      ) : null}
      <ul className="ui-navlist__rows">
        {items.map((item) => (
          <li key={item.id}>
            {/* The row is named by its label; the line under it is its description */}
            <button
              type="button"
              className="ui-navlist__row"
              onClick={item.onClick}
              aria-labelledby={`${headingId}-${item.id}-l`}
              aria-describedby={item.description ? `${headingId}-${item.id}-d` : undefined}
            >
              <span className="ui-navlist__text">
                <span className="ui-navlist__label" id={`${headingId}-${item.id}-l`}>
                  {item.label}
                </span>
                {item.description ? (
                  <span className="ui-navlist__description" id={`${headingId}-${item.id}-d`}>
                    {item.description}
                  </span>
                ) : null}
              </span>
              <span className="ui-navlist__chevron" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
