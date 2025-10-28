import clsx from "clsx";

export function Card({
  children,
  className
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return <div className={clsx("rounded-2xl border border-slate-200 bg-white p-6 shadow-sm", className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardContent({ children, className }: { readonly children: React.ReactNode; readonly className?: string }) {
  return <div className={clsx("pt-4", className)}>{children}</div>;
}
