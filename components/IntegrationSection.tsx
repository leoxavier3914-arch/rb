import type { ReactNode } from 'react';

export default function IntegrationSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-sm shadow-black/20">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? <p className="text-sm text-slate-400">{description}</p> : null}
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}
