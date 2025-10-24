export default function SalesLoading() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="h-4 w-40 animate-pulse rounded-full bg-surface-accent/40" />
        <div className="h-10 w-64 animate-pulse rounded-full bg-surface-accent/40" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-surface-accent/30" />
      </div>
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-3xl bg-surface-accent/30" />
        <div className="h-96 animate-pulse rounded-3xl bg-surface-accent/30" />
      </div>
    </div>
  );
}
