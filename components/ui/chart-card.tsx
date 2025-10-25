import * as React from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

const ResponsiveContainer = dynamic(async () => (await import('recharts')).ResponsiveContainer, { ssr: false });
const AreaChart = dynamic(async () => (await import('recharts')).AreaChart, { ssr: false });
const Area = dynamic(async () => (await import('recharts')).Area, { ssr: false });
const Tooltip = dynamic(async () => (await import('recharts')).Tooltip, { ssr: false });
const XAxis = dynamic(async () => (await import('recharts')).XAxis, { ssr: false });
const YAxis = dynamic(async () => (await import('recharts')).YAxis, { ssr: false });

export interface ChartCardProps<T> {
  readonly title: string;
  readonly description?: string;
  readonly data: readonly T[];
  readonly dataKey: keyof T;
  readonly valueKey: keyof T;
}

export function ChartCard<T extends Record<string, number | string>>({
  title,
  description,
  data,
  dataKey,
  valueKey
}: ChartCardProps<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <AreaChart data={data as T[]}>
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(15 23 42)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="rgb(15 23 42)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey={dataKey as string} stroke="rgb(100 116 139)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="rgb(100 116 139)" fontSize={12} tickLine={false} axisLine={false} width={60} />
              <Tooltip contentStyle={{ borderRadius: 12, borderColor: 'rgb(226 232 240)' }} />
              <Area type="monotone" dataKey={valueKey as string} stroke="rgb(15 23 42)" fill="url(#chart-fill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
