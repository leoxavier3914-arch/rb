import { createKiwifyClient } from '@/lib/kiwify/client';
import { listWebhooks } from '@/lib/webhooks';
import { listWebhookEvents } from '@/lib/webhooks/events';
import { WEBHOOK_TRIGGER_OPTIONS, type WebhookTrigger } from '@/lib/webhooks/triggers';
import { formatDateTime } from '@/lib/ui/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateWebhookForm } from './CreateWebhookForm';
import { WebhookRowActions } from './WebhookRowActions';
import { WebhookEventsTable } from './WebhookEventsTable';

export const dynamic = 'force-dynamic';

interface WebhooksPageProps {
  readonly searchParams?: Record<string, string | string[] | undefined>;
}

const EVENTS_PAGE_SIZE = 10;

const TRIGGER_SET = new Set(WEBHOOK_TRIGGER_OPTIONS.map(option => option.value));

function formatTriggers(triggers: readonly string[]): string {
  if (!triggers || triggers.length === 0) {
    return '—';
  }
  return triggers.join(', ');
}

function formatProducts(products: string | null): string {
  if (!products || products.trim().length === 0) {
    return 'Todos';
  }
  return products === 'all' ? 'Todos' : products;
}

function parseEventsPage(value: string | string[] | undefined): number {
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 1;
}

function parseTrigger(value: string | string[] | undefined): 'all' | WebhookTrigger {
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (typeof value === 'string') {
    const normalized = value.trim() as WebhookTrigger;
    if (TRIGGER_SET.has(normalized)) {
      return normalized;
    }
  }
  return 'all';
}

export default async function WebhooksPage({ searchParams }: WebhooksPageProps) {
  const activeTrigger = parseTrigger(searchParams?.trigger);
  const eventsPageNumber = parseEventsPage(searchParams?.page);

  const [eventsPage, webhooks] = await Promise.all([
    listWebhookEvents({
      page: eventsPageNumber,
      pageSize: EVENTS_PAGE_SIZE,
      trigger: activeTrigger === 'all' ? null : activeTrigger
    }),
    (async () => {
      const client = await createKiwifyClient();
      return listWebhooks(client);
    })()
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Webhooks</h1>
        <p className="text-sm text-slate-500">
          Gerencie os webhooks cadastrados na API oficial da Kiwify para receber atualizações de eventos em tempo real.
        </p>
      </header>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="order-2 xl:order-1 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl">Webhooks configurados</CardTitle>
            <CardDescription>Consulta em tempo real diretamente da Kiwify.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Gatilhos</TableHead>
                  <TableHead className="hidden lg:table-cell">Produtos</TableHead>
                  <TableHead className="hidden xl:table-cell">Token</TableHead>
                  <TableHead>Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-slate-500">
                      Nenhum webhook cadastrado até o momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  webhooks.map(webhook => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-mono text-xs text-slate-500">{webhook.id}</TableCell>
                      <TableCell className="text-xs text-slate-700">{webhook.name ?? '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-slate-900" title={webhook.url}>
                        {webhook.url}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600" title={formatTriggers(webhook.triggers)}>
                        {formatTriggers(webhook.triggers)}
                      </TableCell>
                      <TableCell className="hidden text-xs text-slate-600 lg:table-cell">
                        {formatProducts(webhook.products)}
                      </TableCell>
                      <TableCell className="hidden text-xs text-slate-500 xl:table-cell">
                        {webhook.token ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {webhook.updatedAt ? formatDateTime(webhook.updatedAt) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <WebhookRowActions webhook={webhook} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="order-1 xl:order-2">
          <CardHeader>
            <CardTitle className="text-xl">Criar webhook</CardTitle>
            <CardDescription>
              Cadastre uma nova URL e selecione os eventos desejados para receber notificações imediatas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateWebhookForm />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Eventos recebidos</CardTitle>
            <CardDescription>
              Acompanhe em tempo real os eventos enviados pela Kiwify e filtre pelos gatilhos configurados nos seus
              webhooks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WebhookEventsTable events={eventsPage} activeTrigger={activeTrigger} basePath="/webhooks" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
