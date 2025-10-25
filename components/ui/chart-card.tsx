'use client';

import * as React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const AreaChartCompat = AreaChart as unknown as React.ComponentType<any>;
const AreaCompat = Area as unknown as React.ComponentType<any>;
const ResponsiveContainerCompat = ResponsiveContainer as unknown as React.ComponentType<any>;
const TooltipCompat = Tooltip as unknown as React.ComponentType<any>;
const XAxisCompat = XAxis as unknown as React.ComponentType<any>;
const YAxisCompat = YAxis as unknown as React.ComponentType<any>;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

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
          <ResponsiveContainerCompat>
            <AreaChartCompat data={data as T[]}>
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="rgb(15 23 42)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="rgb(15 23 42)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxisCompat dataKey={dataKey as string} stroke="rgb(100 116 139)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxisCompat stroke="rgb(100 116 139)" fontSize={12} tickLine={false} axisLine={false} width={60} />
              <TooltipCompat contentStyle={{ borderRadius: 12, borderColor: 'rgb(226 232 240)' }} />
              <AreaCompat type="monotone" dataKey={valueKey as string} stroke="rgb(15 23 42)" fill="url(#chart-fill)" strokeWidth={2} />
            </AreaChartCompat>
          </ResponsiveContainerCompat>
        </div>
      </CardContent>
    </Card>
  );
}
