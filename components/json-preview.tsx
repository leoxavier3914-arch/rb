'use client';

interface JsonPreviewProps {
  data: unknown;
  title?: string;
  className?: string;
  emptyState?: string;
}

function formatData(data: unknown) {
  if (data === null || data === undefined) {
    return "null";
  }

  if (typeof data === "string") {
    return data;
  }

  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.warn("Erro ao formatar dados para visualização", error);
    return String(data);
  }
}

export function JsonPreview({ data, title, className, emptyState = "Nenhum dado disponível." }: JsonPreviewProps) {
  const containerClass = [
    "flex flex-col gap-3 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-5 shadow-soft",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = formatData(data);

  return (
    <div className={containerClass}>
      {title ? <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3> : null}
      {content ? (
        <pre className="max-h-[420px] overflow-auto rounded-xl bg-surface px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {content}
        </pre>
      ) : (
        <span className="text-sm text-muted-foreground">{emptyState}</span>
      )}
    </div>
  );
}
