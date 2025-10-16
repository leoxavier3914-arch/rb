import type {
  SortOrder,
  StatusFilterValue,
  StatusOption,
} from '../lib/checkoutHistory';

type HistoryFilterControlsProps = {
  statusFilter: StatusFilterValue;
  onStatusChange: (value: StatusFilterValue) => void;
  sortOrder: SortOrder;
  onSortChange: (value: SortOrder) => void;
  statusOptions: StatusOption[];
  className?: string;
};

export default function HistoryFilterControls({
  statusFilter,
  onStatusChange,
  sortOrder,
  onSortChange,
  statusOptions,
  className,
}: HistoryFilterControlsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 text-xs text-slate-300 ${className ?? ''}`}>
      <label className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Status
        </span>
        <select
          aria-label="Filtrar status"
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none"
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="all">Todos os status</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Ordenar
        </span>
        <select
          aria-label="Ordenar atualizações"
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none"
          value={sortOrder}
          onChange={(event) => onSortChange(event.target.value as SortOrder)}
        >
          <option value="desc">Mais recentes</option>
          <option value="asc">Mais antigas</option>
        </select>
      </label>
    </div>
  );
}
