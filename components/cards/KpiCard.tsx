"use client";

import { ReactNode } from "react";

import { formatCurrency } from "@/lib/format";

interface KpiCardProps {
  title: string;
  value: number;
  currency?: string;
  helper?: ReactNode;
}

export function KpiCard({ title, value, currency = "BRL", helper }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-surface-accent/40 bg-surface px-6 py-5 shadow-soft">
      <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{title}</span>
      <strong className="text-3xl font-semibold text-white">{formatCurrency(value, currency)}</strong>
      {helper ? <div className="text-sm text-muted-foreground">{helper}</div> : null}
    </div>
  );
}
