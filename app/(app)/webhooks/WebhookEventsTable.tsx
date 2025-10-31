'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WEBHOOK_TRIGGER_OPTIONS, type WebhookTrigger } from '@/lib/webhooks/triggers';

type FilterOption = {
  readonly value: 'all' | WebhookTrigger;
  readonly label: string;
};

const FILTER_OPTIONS: readonly FilterOption[] = [{ value: 'all', label: 'Todos' }, ...WEBHOOK_TRIGGER_OPTIONS];

export function WebhookEventsTable() {
  const [activeFilter, setActiveFilter] = useState<'all' | WebhookTrigger>('all');

  const events = useMemo(() => {
    if (activeFilter === 'all') {
      return WEBHOOK_TRIGGER_OPTIONS;
    }
    return WEBHOOK_TRIGGER_OPTIONS.filter(option => option.value === activeFilter);
  }, [activeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map(option => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={option.value === activeFilter ? 'default' : 'outline'}
            onClick={() => setActiveFilter(option.value)}
            aria-pressed={option.value === activeFilter}
            className="gap-2"
          >
            {option.label}
            {option.value !== 'all' ? (
              <span className="text-xs font-normal text-slate-400">{option.value}</span>
            ) : null}
          </Button>
        ))}
      </div>

      <div className="rounded-md border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">Evento</TableHead>
              <TableHead className="w-40">Identificador</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map(event => (
              <TableRow key={event.value}>
                <TableCell className="font-medium text-slate-900">{event.label}</TableCell>
                <TableCell>
                  <code className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{event.value}</code>
                </TableCell>
                <TableCell className="text-sm text-slate-600">{event.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
