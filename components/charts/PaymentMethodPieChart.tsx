"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatCurrency } from "@/lib/format";

const COLORS = ["#0EA5E9", "#F97316", "#22C55E", "#F59E0B", "#A855F7"];

type MethodPoint = {
  method: string;
  grossCents: number;
};

export function PaymentMethodPieChart({ data }: { data: MethodPoint[] }) {
  const total = data.reduce((accumulator, item) => accumulator + item.grossCents, 0);
  return (
    <div className="h-72 w-full rounded-2xl border border-surface-accent/40 bg-surface/80 p-6">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="grossCents" nameKey="method" innerRadius={60} outerRadius={100} paddingAngle={4}>
            {data.map((entry, index) => (
              <Cell key={entry.method} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "#0f172a", borderRadius: "1rem", border: "1px solid #1f2937" }}
            formatter={(value: number, _name: string, entry: any) => {
              const percentage = total === 0 ? 0 : (entry.value / total) * 100;
              return `${formatCurrency(value, "BRL")} (${percentage.toFixed(1)}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
