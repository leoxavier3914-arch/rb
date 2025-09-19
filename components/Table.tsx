import clsx from 'clsx';
import type { Key, ReactNode } from 'react';

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
};

export default function Table<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = 'Nenhum registro encontrado.',
  getRowKey,
  className,
}: TableProps<T>) {
  return (
    <div className={clsx('overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg', className)}>
      <table className="min-w-full divide-y divide-slate-800">
        <thead className="bg-slate-900/80">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className={clsx('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400', column.className)}
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
            data.map((item, index) => (
              <tr key={getRowKey ? getRowKey(item, index) : index} className="hover:bg-slate-800/30">
                {columns.map((column) => (
                  <td key={String(column.key)} className={clsx('px-4 py-3 text-sm text-slate-200', column.className)}>
                    {column.render ? column.render(item) : String(item[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
