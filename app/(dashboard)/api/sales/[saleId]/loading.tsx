export default function SaleDetailsLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="h-4 w-48 animate-pulse rounded-full bg-surface-accent/40" />
        <div className="h-10 w-72 animate-pulse rounded-full bg-surface-accent/40" />
        <div className="h-4 w-32 animate-pulse rounded-full bg-surface-accent/30" />
      </div>
      <div className="h-64 animate-pulse rounded-3xl bg-surface-accent/30" />
      <div className="h-48 animate-pulse rounded-3xl bg-surface-accent/30" />
    </div>
  );
}
