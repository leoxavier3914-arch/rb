"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrency } from "@/lib/format";

type ProductPoint = {
  product: string;
  grossCents: number;
};

export function ProductBarChart({ data }: { data: ProductPoint[] }) {
  return (
    <div className="h-72 w-full rounded-2xl border border-surface-accent/40 bg-surface/80 p-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="product" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
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
          <Bar dataKey="grossCents" fill="#6366F1" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
