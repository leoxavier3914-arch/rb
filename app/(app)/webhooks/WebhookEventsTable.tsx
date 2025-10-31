import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/ui/format';
import { type JsonValue, type WebhookEventRow, type WebhookEventsPage } from '@/lib/webhooks/events';

interface WebhookEventsTableProps {
  readonly events: WebhookEventsPage;
  readonly basePath?: string;
}

export function WebhookEventsTable({ events, basePath = '/webhooks' }: WebhookEventsTableProps) {
  const { items, total, page, pageSize } = events;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < pageCount ? page + 1 : null;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">Evento</TableHead>
              <TableHead className="min-w-[200px]">Identificador</TableHead>
              <TableHead className="min-w-[220px]">Produto</TableHead>
              <TableHead className="min-w-[140px]">Status</TableHead>
              <TableHead className="min-w-[200px]">Recebido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-slate-500">
                  Nenhum evento registrado até o momento.
                </TableCell>
              </TableRow>
            ) : (
              items.map(event => {
                const eventLabel = formatEventType(event);
                const eventDetails = summarizeEvent(event);
                const customerName = formatCustomerName(event);
                const customerContact = formatCustomerContact(event);
                const productName = formatProductName(event);
                const productDetails = formatProductDetails(event);
                const orderStatus = formatOrderStatus(event);

                return (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-900">{eventLabel}</span>
                        {eventDetails ? <span className="text-xs text-slate-400">{eventDetails}</span> : null}
                        {event.source ? (
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">
                            Origem {event.source}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-slate-900">{customerName ?? '—'}</span>
                        {customerContact ? <span className="text-xs text-slate-500">{customerContact}</span> : null}
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">
                          Registro {shortenId(event.id)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm text-slate-900">{productName ?? '—'}</span>
                        {productDetails ? <span className="text-xs text-slate-500">{productDetails}</span> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {orderStatus ? (
                        <span className="inline-flex min-w-[88px] justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {orderStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-slate-500">
                        <span>Recebido: {formatDateTime(event.receivedAt)}</span>
                        {event.occurredAt ? <span>Evento: {formatDateTime(event.occurredAt)}</span> : null}
                        {event.eventId ? <span>ID: {event.eventId}</span> : null}
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
                <Link href={buildPageHref({ basePath, page: prevPage })} prefetch={false}>
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
                <Link href={buildPageHref({ basePath, page: nextPage })} prefetch={false}>
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

function buildPageHref({
  basePath,
  page
}: {
  basePath: string;
  page: number;
}): { pathname: string; query?: Record<string, string> } {
  const query: Record<string, string> = {};
  if (page > 1) {
    query.page = String(page);
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
    ['payload', 'product_title'],
    ['Product', 'product_name'],
    ['product', 'name']
  ]);

  if (productTitle) {
    parts.push(productTitle);
  }

  const customerName = findFirstString(payload, [
    ['order', 'customer_name'],
    ['order', 'customer', 'name'],
    ['data', 'customer_name'],
    ['payload', 'customer_name'],
    ['payload', 'customer', 'name'],
    ['Customer', 'full_name'],
    ['customer', 'full_name']
  ]);

  const customerEmail = findFirstString(payload, [
    ['order', 'customer_email'],
    ['order', 'customer', 'email'],
    ['data', 'customer_email'],
    ['payload', 'customer_email'],
    ['payload', 'customer', 'email'],
    ['Customer', 'email'],
    ['customer', 'email']
  ]);

  if (customerName || customerEmail) {
    const label = customerName ?? customerEmail;
    parts.push(`Cliente ${label}`);
  }

  return parts.length > 0 ? parts.join(' • ') : '';
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  order_approved: 'Aprovado',
  order_pending: 'Pendente',
  order_abandoned: 'Abandonado',
  order_refunded: 'Reembolsado',
  order_chargeback: 'Chargeback',
  order_cancelled: 'Cancelado',
  order_completed: 'Concluído',
  order_expired: 'Expirado',
  order_processing: 'Processando',
  order_created: 'Criado',
  order_paid: 'Pago',
  order_pix_pending: 'Pix pendente',
  order_pix_paid: 'Pix pago',
  order_waiting_payment: 'Aguardando pagamento',
  subscription_created: 'Assinatura criada',
  subscription_canceled: 'Assinatura cancelada',
  subscription_cancelled: 'Assinatura cancelada',
  subscription_expired: 'Assinatura expirada',
  subscription_payment_pending: 'Pagamento pendente',
  subscription_payment_failed: 'Pagamento falhou'
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  waiting_payment: 'Aguardando pagamento',
  refunded: 'Reembolsado',
  chargeback: 'Chargeback',
  abandoned: 'Abandonado',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  completed: 'Concluído',
  approved: 'Aprovado',
  processing: 'Processando',
  failed: 'Falhou'
};

function formatEventType(event: WebhookEventRow): string {
  const payload = event.payload;
  const rawType =
    findFirstString(payload, [
      ['webhook_event_type'],
      ['event_type'],
      ['event'],
      ['type'],
      ['data', 'webhook_event_type'],
      ['data', 'event_type'],
      ['data', 'event'],
      ['payload', 'webhook_event_type'],
      ['payload', 'event_type'],
      ['payload', 'event'],
      ['webhook', 'event']
    ]) ?? event.trigger;

  if (!rawType) {
    return 'Evento registrado';
  }

  const normalized = rawType.trim().toLowerCase();

  if (EVENT_TYPE_LABELS[normalized]) {
    return EVENT_TYPE_LABELS[normalized]!;
  }

  if (normalized.startsWith('order_')) {
    return humanize(normalized.replace(/^order_/, ''));
  }

  if (normalized.startsWith('subscription_')) {
    return `Assinatura ${humanize(normalized.replace(/^subscription_/, ''))}`;
  }

  return humanize(rawType);
}

function formatCustomerName(event: WebhookEventRow): string | null {
  const payload = event.payload;
  return (
    findFirstString(payload, [
      ['Customer', 'full_name'],
      ['Customer', 'name'],
      ['customer', 'full_name'],
      ['customer', 'name'],
      ['order', 'customer_name'],
      ['order', 'customer', 'name'],
      ['data', 'customer_name'],
      ['payload', 'customer_name'],
      ['payload', 'customer', 'name']
    ]) ?? null
  );
}

function formatCustomerContact(event: WebhookEventRow): string | null {
  const payload = event.payload;
  const email =
    findFirstString(payload, [
      ['Customer', 'email'],
      ['customer', 'email'],
      ['order', 'customer_email'],
      ['order', 'customer', 'email'],
      ['data', 'customer_email'],
      ['payload', 'customer_email'],
      ['payload', 'customer', 'email']
    ]) ?? null;

  const phone =
    findFirstString(payload, [
      ['Customer', 'mobile'],
      ['customer', 'mobile'],
      ['customer', 'phone'],
      ['payload', 'customer', 'mobile'],
      ['payload', 'customer', 'phone']
    ]) ?? null;

  if (email && phone) {
    return `${email} • ${phone}`;
  }

  return email ?? phone;
}

function formatProductName(event: WebhookEventRow): string | null {
  const payload = event.payload;
  return (
    findFirstString(payload, [
      ['Product', 'product_name'],
      ['Product', 'name'],
      ['product', 'product_name'],
      ['product', 'name'],
      ['order', 'product_title'],
      ['order', 'product', 'title'],
      ['data', 'product_title'],
      ['payload', 'product_title'],
      ['payload', 'product', 'title']
    ]) ?? null
  );
}

function formatProductDetails(event: WebhookEventRow): string | null {
  const payload = event.payload;
  const offer =
    findFirstString(payload, [
      ['Product', 'product_offer_name'],
      ['product', 'offer_name'],
      ['product', 'product_offer_name'],
      ['payload', 'product_offer_name'],
      ['payload', 'product', 'offer_name']
    ]) ?? null;

  const offerId =
    findFirstString(payload, [
      ['Product', 'product_offer_id'],
      ['product', 'offer_id'],
      ['payload', 'product_offer_id']
    ]) ?? null;

  if (offer && offerId) {
    return `${offer} • ${offerId}`;
  }

  return offer ?? offerId;
}

function formatOrderStatus(event: WebhookEventRow): string | null {
  const payload = event.payload;
  const rawStatus =
    findFirstString(payload, [
      ['order_status'],
      ['order', 'status'],
      ['Order', 'status'],
      ['data', 'order_status'],
      ['payload', 'order_status'],
      ['payload', 'order', 'status'],
      ['status']
    ]) ?? event.status;

  if (!rawStatus) {
    return null;
  }

  const normalized = rawStatus.trim().toLowerCase().replace(/\s+/g, '_');

  if (ORDER_STATUS_LABELS[normalized]) {
    return ORDER_STATUS_LABELS[normalized]!;
  }

  return humanize(rawStatus);
}

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(capitalize)
    .join(' ');
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
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
