"use client";

import { endOfMonth, endOfToday, formatISO, startOfMonth, startOfToday, subDays } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

function serializeRange(range: { from: Date; to: Date }) {
  return {
    from: formatISO(range.from, { representation: "date" }),
    to: formatISO(range.to, { representation: "date" }),
  };
}

function restoreRange(): { preset: PresetValue; from: string; to: string } | null {
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

  const initial = useMemo(() => {
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    if (fromParam && toParam) {
      return { preset: "custom" as PresetValue, from: fromParam, to: toParam };
    }
    const restored = restoreRange();
    if (restored) {
      return restored;
    }
    const fallback = presets[0];
    const range = serializeRange(fallback.resolve?.() ?? { from: startOfToday(), to: endOfToday() });
    return { preset: fallback.value, ...range };
  }, [searchParams]);

  const [preset, setPreset] = useState<PresetValue>(initial.preset);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, from, to }));

    const params = new URLSearchParams(window.location.search);
    const currentFrom = params.get("from");
    const currentTo = params.get("to");

    if (currentFrom === from && currentTo === to) {
      return;
    }

    replaceQuery({ from, to });
  }, [from, to, preset, replaceQuery]);

  function handlePresetChange(value: PresetValue) {
    setPreset(value);
    const presetConfig = presets.find((item) => item.value === value);
    if (presetConfig?.resolve) {
      const range = serializeRange(presetConfig.resolve());
      setFrom(range.from);
      setTo(range.to);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        {presets.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => handlePresetChange(item.value)}
            className={`rounded-full px-4 py-2 text-sm transition ${preset === item.value ? "bg-primary text-primary-foreground" : "bg-surface-accent/60 text-muted-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            De
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-lg border border-surface-accent/50 bg-background px-3 py-2 text-white"
            />
          </label>
          <label className="flex items-center gap-2">
            Até
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-lg border border-surface-accent/50 bg-background px-3 py-2 text-white"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
