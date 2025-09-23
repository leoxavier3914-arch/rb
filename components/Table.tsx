'use client';

import clsx from 'clsx';
import { Fragment, type Key, type ReactNode } from 'react';

type Column<T> = {
  key: keyof T;
  header: string;
  className?: string;
  render?: (item: T) => ReactNode;
};

type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  getRowKey?: (item: T, index: number) => Key;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
  expandedRowKey?: Key | null;
  renderExpandedRow?: (item: T) => ReactNode;
};

export default function Table<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = 'Nenhum registro encontrado.',
  getRowKey,
  className,
  onRowClick,
  expandedRowKey = null,
  renderExpandedRow,
}: TableProps<T>) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg sm:overflow-hidden',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="min-w-[720px] divide-y divide-slate-800 sm:min-w-full">
          <thead className="bg-slate-900/80">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope="col"
                  className={clsx(
                    'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400',
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const key = getRowKey ? getRowKey(item, index) : index;
                const stringKey = String(key);
                const isExpanded = expandedRowKey !== null && String(expandedRowKey) === stringKey;

                return (
                  <Fragment key={stringKey}>
                    <tr
                      className={clsx(
                        'hover:bg-slate-800/30',
                        onRowClick && 'cursor-pointer',
                        isExpanded && 'bg-slate-800/40',
                      )}
                      onClick={() => onRowClick?.(item, index)}
                    >
                      {columns.map((column) => (
                        <td key={String(column.key)} className={clsx('px-4 py-3 text-sm text-slate-200', column.className)}>
                          {column.render ? column.render(item) : String(item[column.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && renderExpandedRow ? (
                      <tr className="bg-slate-900/70">
                        <td colSpan={columns.length} className="px-4 py-4 text-sm text-slate-200">
                          {renderExpandedRow(item)}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
