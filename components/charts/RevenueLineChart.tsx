"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrency } from "@/lib/format";

type RevenuePoint = {
  date: string;
  grossCents: number;
  netCents: number;
};

export function RevenueLineChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div className="h-72 w-full rounded-2xl border border-surface-accent/40 bg-surface/80 p-6">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0 }}>
          <defs>
            <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22C55E" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={(value) => formatCurrency(Number(value), "BRL")}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#0f172a", borderRadius: "1rem", border: "1px solid #1f2937" }}
            formatter={(value: number) => formatCurrency(value, "BRL")}
          />
          <Area type="monotone" dataKey="grossCents" stroke="#0EA5E9" fill="url(#grossGradient)" strokeWidth={2} />
          <Area type="monotone" dataKey="netCents" stroke="#22C55E" fill="url(#netGradient)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
