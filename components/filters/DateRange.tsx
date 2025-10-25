"use client";

import { endOfMonth, endOfToday, formatISO, startOfMonth, startOfToday, subDays } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useQueryReplace } from "@/hooks/useQueryReplace";

const STORAGE_KEY = "kiwify-dashboard:date-range";

type PresetConfig = {
  label: string;
  value: "today" | "yesterday" | "last7" | "month" | "custom";
  resolve?: () => { from: Date; to: Date };
};

const presets: readonly PresetConfig[] = [
  {
    label: "Hoje",
    value: "today",
    resolve: () => ({
      from: startOfToday(),
      to: endOfToday(),
    }),
  },
  {
    label: "Ontem",
    value: "yesterday",
    resolve: () => {
      const from = subDays(startOfToday(), 1);
      return { from, to: endOfToday() };
    },
  },
  {
    label: "Últimos 7",
    value: "last7",
    resolve: () => ({
      from: subDays(startOfToday(), 6),
      to: endOfToday(),
    }),
  },
  {
    label: "Este mês",
    value: "month",
    resolve: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  { label: "Intervalo", value: "custom" },
];

type PresetValue = PresetConfig["value"];

type StoredRange = { preset: PresetValue; from: string; to: string };

function serializeRange(range: { from: Date; to: Date }) {
  return {
    from: formatISO(range.from, { representation: "date" }),
    to: formatISO(range.to, { representation: "date" }),
  };
}

function restoreRange(): StoredRange | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("Falha ao restaurar range", error);
    return null;
  }
}

export function DateRangeFilter() {
  const searchParams = useSearchParams();
  const replaceQuery = useQueryReplace();

  const defaultRange = useMemo(() => {
    const fallback = presets[0];
    const range = serializeRange(fallback.resolve?.() ?? { from: startOfToday(), to: endOfToday() });
    return { preset: fallback.value, ...range } satisfies StoredRange;
  }, []);

  const [persistedRange, setPersistedRange] = useState<StoredRange>(() => restoreRange() ?? defaultRange);

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const urlRange = useMemo(() => {
    if (fromParam && toParam) {
      return { from: fromParam, to: toParam };
    }
    return null;
  }, [fromParam, toParam]);

  const inferredPreset = useMemo(() => {
    if (urlRange) {
      const match = presets.find((preset) => {
        if (!preset.resolve) {
          return false;
        }
        const range = serializeRange(preset.resolve());
        return range.from === urlRange.from && range.to === urlRange.to;
      });
      return match?.value ?? "custom";
    }
    return persistedRange.preset;
  }, [persistedRange.preset, urlRange]);

  const activeRange: StoredRange = urlRange
    ? { preset: inferredPreset, ...urlRange }
    : persistedRange;

  const persistRange = (range: StoredRange) => {
    setPersistedRange(range);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(range));
    }
  };

  const applyRange = (range: StoredRange) => {
    persistRange(range);
    replaceQuery({ from: range.from, to: range.to });
  };

  const handlePresetChange = (value: PresetValue) => {
    if (value === "custom") {
      persistRange({ ...activeRange, preset: "custom" });
      return;
    }

    const presetConfig = presets.find((item) => item.value === value);
    if (!presetConfig?.resolve) {
      return;
    }
    const range = serializeRange(presetConfig.resolve());
    applyRange({ preset: value, ...range });
  };

  const handleCustomChange = (partial: Partial<Pick<StoredRange, "from" | "to">>) => {
    const next = {
      preset: "custom" as const,
      from: partial.from ?? activeRange.from,
      to: partial.to ?? activeRange.to,
    } satisfies StoredRange;
    applyRange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {presets.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => handlePresetChange(item.value)}
            className={`rounded-full px-4 py-2 text-sm transition ${inferredPreset === item.value ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {inferredPreset === "custom" ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            De
            <input
              type="date"
              value={activeRange.from}
              onChange={(event) => handleCustomChange({ from: event.target.value })}
              className="rounded-lg border border-surface-accent/50 bg-background px-3 py-2 text-white"
            />
          </label>
          <label className="flex items-center gap-2">
            Até
            <input
              type="date"
              value={activeRange.to}
              onChange={(event) => handleCustomChange({ to: event.target.value })}
              className="rounded-lg border border-surface-accent/50 bg-background px-3 py-2 text-white"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
