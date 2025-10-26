import { CardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/Skeletons';

export default function AppLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <ChartSkeleton />
      <TableSkeleton rows={6} />
    </div>
  );
}
