import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

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
