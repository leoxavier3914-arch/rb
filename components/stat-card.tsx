interface StatCardProps {
  label: string;
  value: string;
  helper?: string;
}

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-5 shadow-soft">
      <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold text-primary-foreground">{value}</span>
      {helper ? <span className="text-xs text-muted-foreground">{helper}</span> : null}
    </div>
  );
}
