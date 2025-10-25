"use client";

interface TableStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function TableState({ title, description, actionLabel = "Tentar novamente", onAction }: TableStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
      <div className="max-w-xs space-y-2">
        <p className="text-base font-medium text-white">{title}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full border border-primary/60 px-4 py-2 text-xs font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
