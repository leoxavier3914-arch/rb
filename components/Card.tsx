import type { ReactNode } from 'react';
import clsx from 'clsx';

type CardProps = {
  title: string;
  value: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export default function Card({ title, value, description, icon, className }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40 backdrop-blur',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-400">{title}</p>
          <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
        </div>
        {icon ? <div className="text-brand">{icon}</div> : null}
      </div>
      {description ? <p className="mt-4 text-sm text-slate-400">{description}</p> : null}
    </div>
  );
}
