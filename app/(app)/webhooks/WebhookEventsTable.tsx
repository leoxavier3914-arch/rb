import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/ui/format';
import {
  type JsonValue,
  type WebhookEventRow,
  type WebhookEventsPage
} from '@/lib/webhooks/events';
import { WEBHOOK_TRIGGER_OPTIONS, type WebhookTrigger } from '@/lib/webhooks/triggers';

interface FilterOption {
  readonly value: 'all' | WebhookTrigger;
  readonly label: string;
}

interface TokenFilterOption {
  readonly value: 'all' | 'none' | string;
  readonly label: string;
  readonly title?: string;
}

interface WebhookEventsTableProps {
  readonly events: WebhookEventsPage;
  readonly activeTrigger: 'all' | WebhookTrigger;
  readonly activeToken: 'all' | 'none' | string;
  readonly tokenOptions: readonly TokenFilterOption[];
  readonly basePath?: string;
}

const FILTER_OPTIONS: readonly FilterOption[] = [{ value: 'all', label: 'Todos' }, ...WEBHOOK_TRIGGER_OPTIONS];

const TRIGGER_LABELS = new Map(WEBHOOK_TRIGGER_OPTIONS.map(option => [option.value, option.label] as const));

export function WebhookEventsTable({ events, activeTrigger, activeToken, tokenOptions, basePath = '/webhooks' }: WebhookEventsTableProps) {
  const { items, total, page, pageSize } = events;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < pageCount ? page + 1 : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gatilhos</span>
        {FILTER_OPTIONS.map(option => {
          const isActive = option.value === activeTrigger;
          const href = buildFilterHref({ basePath, trigger: option.value, activeToken });

          return (
            <Button
              key={option.value}
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              aria-pressed={isActive}
              className="gap-2"
              asChild
            >
              <Link href={href} prefetch={false}>
                {option.label}
                {option.value !== 'all' ? (
                  <span className="text-xs font-normal text-slate-400">{option.value}</span>
                ) : null}
              </Link>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tokens</span>
        {tokenOptions.map(option => {
          const isActive = option.value === activeToken;
          const href = buildTokenHref({ basePath, token: option.value, activeTrigger });

          return (
            <Button
              key={option.value}
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              aria-pressed={isActive}
              className="gap-2"
              asChild
            >
              <Link href={href} prefetch={false} title={option.title ?? option.label}>
                {option.label}
              </Link>
            </Button>
          );
        })}
      </div>

      <div className="rounded-md border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">Evento</TableHead>
              <TableHead className="min-w-[200px]">Identificador</TableHead>
              <TableHead className="min-w-[220px]">Origem</TableHead>
              <TableHead className="min-w-[140px]">Status</TableHead>
              <TableHead className="min-w-[200px]">Recebido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-slate-500">
                  {activeTrigger === 'all'
                    ? 'Nenhum evento registrado até o momento.'
                    : 'Nenhum evento encontrado para o filtro selecionado.'}
                </TableCell>
              </TableRow>
            ) : (
              items.map(event => {
                const extraSource = formatExtraSource(event);
                return (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-900">{getTriggerLabel(event)}</span>
                        <span className="text-xs text-slate-500">{event.trigger ?? '—'}</span>
                        <span className="text-xs text-slate-400">{summarizeEvent(event)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-slate-700">
                          {event.eventId ?? '—'}
                        </span>
                        <span className="text-xs text-slate-400">Registro interno {shortenId(event.id)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-slate-600">{formatSource(event)}</span>
                        {extraSource ? (
                          <span className="text-xs text-slate-500">{extraSource}</span>
                        ) : null}
                        {event.webhookToken ? (
                          <span className="text-xs text-slate-500" title={event.webhookToken}>
                            Token: {summarizeTokenValue(event.webhookToken)}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {event.status ? (
                        <span className="inline-flex min-w-[88px] justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {event.status}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-slate-500">
                        <span>Recebido: {formatDateTime(event.receivedAt)}</span>
                        {event.occurredAt ? (
                          <span>Evento: {formatDateTime(event.occurredAt)}</span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
          <span>
            Mostrando {formatRangeStart(events)} - {formatRangeEnd(events)} de {total.toLocaleString('pt-BR')} eventos
          </span>
          <div className="flex items-center gap-2">
            {prevPage ? (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={buildPageHref({ basePath, page: prevPage, activeTrigger, activeToken })}
                  prefetch={false}
                >
                  Página anterior
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Página anterior
              </Button>
            )}
            {nextPage ? (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={buildPageHref({ basePath, page: nextPage, activeTrigger, activeToken })}
                  prefetch={false}
                >
                  Próxima página
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Próxima página
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildFilterHref({
  basePath,
  trigger,
  activeToken
}: {
  basePath: string;
  trigger: 'all' | WebhookTrigger;
  activeToken: 'all' | 'none' | string;
}): { pathname: string; query?: Record<string, string> } {
  const query: Record<string, string> = {};
  if (trigger !== 'all') {
    query.trigger = trigger;
  }
  if (activeToken !== 'all') {
    query.token = activeToken;
  }
  return Object.keys(query).length > 0 ? { pathname: basePath, query } : { pathname: basePath };
}

function buildTokenHref({
  basePath,
  token,
  activeTrigger
}: {
  basePath: string;
  token: 'all' | 'none' | string;
  activeTrigger: 'all' | WebhookTrigger;
}): { pathname: string; query?: Record<string, string> } {
  const query: Record<string, string> = {};
  if (token !== 'all') {
    query.token = token;
  }
  if (activeTrigger !== 'all') {
    query.trigger = activeTrigger;
  }
  return Object.keys(query).length > 0 ? { pathname: basePath, query } : { pathname: basePath };
}

function buildPageHref({
  basePath,
  page,
  activeTrigger,
  activeToken
}: {
  basePath: string;
  page: number;
  activeTrigger: 'all' | WebhookTrigger;
  activeToken: 'all' | 'none' | string;
}): { pathname: string; query?: Record<string, string> } {
  const query: Record<string, string> = {};
  if (page > 1) {
    query.page = String(page);
  }
  if (activeTrigger !== 'all') {
    query.trigger = activeTrigger;
  }
  if (activeToken !== 'all') {
    query.token = activeToken;
  }
  return Object.keys(query).length > 0 ? { pathname: basePath, query } : { pathname: basePath };
}

function formatRangeStart(page: WebhookEventsPage): string {
  if (page.total === 0) {
    return '0';
  }
  const start = (page.page - 1) * page.pageSize + 1;
  return start.toLocaleString('pt-BR');
}

function formatRangeEnd(page: WebhookEventsPage): string {
  if (page.total === 0) {
    return '0';
  }
  const end = Math.min(page.page * page.pageSize, page.total);
  return end.toLocaleString('pt-BR');
}

function getTriggerLabel(event: WebhookEventRow): string {
  if (event.trigger && TRIGGER_LABELS.has(event.trigger as WebhookTrigger)) {
    return TRIGGER_LABELS.get(event.trigger as WebhookTrigger)!;
  }
  return event.trigger ?? 'Evento registrado';
}

function shortenId(id: string): string {
  if (id.length <= 12) {
    return id;
  }
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function summarizeEvent(event: WebhookEventRow): string {
  const payload = event.payload;
  const parts: string[] = [];

  const orderId = findFirstString(payload, [
    ['order', 'id'],
    ['data', 'order_id'],
    ['data', 'id'],
    ['payload', 'order_id'],
    ['payload', 'id']
  ]);

  if (orderId) {
    parts.push(`Pedido ${orderId}`);
  }

  const productTitle = findFirstString(payload, [
    ['order', 'product_title'],
    ['order', 'product', 'title'],
    ['data', 'product_title'],
    ['payload', 'product_title']
  ]);

  if (productTitle) {
    parts.push(productTitle);
  }

  const customerName = findFirstString(payload, [
    ['order', 'customer_name'],
    ['order', 'customer', 'name'],
    ['data', 'customer_name'],
    ['payload', 'customer_name'],
    ['payload', 'customer', 'name']
  ]);

  const customerEmail = findFirstString(payload, [
    ['order', 'customer_email'],
    ['order', 'customer', 'email'],
    ['data', 'customer_email'],
    ['payload', 'customer_email'],
    ['payload', 'customer', 'email']
  ]);

  if (customerName || customerEmail) {
    const label = customerName ?? customerEmail;
    parts.push(`Cliente ${label}`);
  }

  return parts.length > 0 ? parts.join(' • ') : '—';
}

function formatSource(event: WebhookEventRow): string {
  if (event.source) {
    return event.source;
  }
  const deliveryId = event.headers['x-kiwify-delivery-id'];
  if (deliveryId) {
    return `Entrega ${deliveryId}`;
  }
  const requestId = event.headers['x-request-id'];
  if (requestId) {
    return `Request ${shortenId(requestId)}`;
  }
  return '—';
}

function formatExtraSource(event: WebhookEventRow): string {
  const accountId = event.headers['x-kiwify-account-id'];
  if (accountId) {
    return `Conta ${accountId}`;
  }
  const ip = event.headers['x-forwarded-for'] ?? event.headers['x-real-ip'] ?? event.headers['x-vercel-ip'];
  if (ip) {
    return `IP ${ip}`;
  }
  return '';
}

function summarizeTokenValue(token: string): string {
  if (token.length <= 12) {
    return token;
  }
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

function findFirstString(payload: JsonValue, paths: readonly (readonly string[])[]): string | null {
  for (const path of paths) {
    const value = getNestedValue(payload, path);
    const asString = coerceToString(value);
    if (asString) {
      return asString;
    }
  }
  return null;
}

function getNestedValue(payload: JsonValue, path: readonly string[]): JsonValue | null {
  let current: JsonValue | null = payload;
  for (const key of path) {
    if (!current || typeof current !== 'object') {
      return null;
    }
    if (Array.isArray(current)) {
      const index = Number.parseInt(key, 10);
      if (!Number.isFinite(index) || index < 0 || index >= current.length) {
        return null;
      }
      current = current[index] ?? null;
      continue;
    }
    const record = current as Record<string, JsonValue>;
    current = record[key] ?? null;
  }
  return current;
}

function coerceToString(value: JsonValue | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : null;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (Array.isArray(value)) {
    const mapped = value.map(item => coerceToString(item)).filter(Boolean) as string[];
    return mapped.length > 0 ? mapped.join(', ') : null;
  }
  if (typeof value === 'object') {
    const name = coerceToString((value as Record<string, JsonValue>).name ?? null);
    if (name) {
      return name;
    }
    const title = coerceToString((value as Record<string, JsonValue>).title ?? null);
    if (title) {
      return title;
    }
    const id = coerceToString((value as Record<string, JsonValue>).id ?? null);
    if (id) {
      return id;
    }
    return null;
  }
  return null;
}
