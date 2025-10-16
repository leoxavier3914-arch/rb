import { EventCard, type EventCardProps } from "@/components/event-card";
import { StatCard } from "@/components/stat-card";

interface SummaryStat {
  label: string;
  value: string;
  helper?: string;
}

interface EventsBoardProps {
  stats: SummaryStat[];
  heading: string;
  description: string;
  emptyState: string;
  events: (EventCardProps & { id: string })[];
}

export function EventsBoard({ stats, heading, description, emptyState, events }: EventsBoardProps) {
  return (
    <div className="space-y-10">
      {stats.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} />
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        <header className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-primary-foreground">{heading}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </header>

        <div className="grid gap-4" role="list">
          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-accent/50 bg-surface/60 p-10 text-center text-sm text-muted-foreground">
              {emptyState}
            </div>
          ) : (
            events.map(({ id, ...event }) => <EventCard key={id} {...event} />)
          )}
        </div>
      </div>
    </div>
  );
}
