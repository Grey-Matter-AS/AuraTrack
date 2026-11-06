import type { ReactNode } from 'react';
import { cx } from './cx';

export interface DataColumn {
  title: string;
  /** Numbers are set to the right, in figures of even width, so a column of them lines up. */
  numeric?: boolean;
}

/**
 * A plain table of values: a caption, column headings, rows, and an optional footer row (a total). It scrolls sideways
 * inside its own box on a narrow screen instead of pushing the page wider.
 */
export function DataTable({
  caption,
  columns,
  rows,
  footer,
}: {
  caption: string;
  columns: readonly DataColumn[];
  rows: readonly (readonly ReactNode[])[];
  footer?: readonly ReactNode[];
}) {
  const cell = (c: DataColumn | undefined) => cx(c?.numeric && 'ui-table__num');
  return (
    <div className="ui-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="ui-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.title} scope="col" className={cell(c)}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((value, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className={cell(columns[i])}>
                    {value}
                  </th>
                ) : (
                  <td key={i} className={cell(columns[i])}>
                    {value}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot>
            <tr>
              {footer.map((value, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className={cell(columns[i])}>
                    {value}
                  </th>
                ) : (
                  <td key={i} className={cell(columns[i])}>
                    {value}
                  </td>
                ),
              )}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}
