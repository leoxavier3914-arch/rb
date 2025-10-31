import { createKiwifyClient } from '@/lib/kiwify/client';
import { listWebhooks } from '@/lib/webhooks';
import type { Webhook } from '@/lib/webhooks';
import { listWebhookEvents } from '@/lib/webhooks/events';
import { listWebhookSettings, mapWebhookSettingsById, type WebhookSetting } from '@/lib/webhooks/settings';
import { formatDateTime } from '@/lib/ui/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/ui/classnames';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateWebhookForm } from './CreateWebhookForm';
import { WebhookRowActions } from './WebhookRowActions';
import { WebhookEventsTable } from './WebhookEventsTable';

export const dynamic = 'force-dynamic';

interface WebhooksPageProps {
  readonly searchParams?: Record<string, string | string[] | undefined>;
}

const EVENTS_PAGE_SIZE = 10;

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

type TokenFilterOption = {
  readonly value: 'all' | 'none' | string;
  readonly label: string;
  readonly title?: string;
};

function parseToken(value: string | string[] | undefined): 'all' | 'none' | string {
  if (Array.isArray(value)) {
    value = value[0];
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return 'all';
    }
    if (normalized === 'all' || normalized === 'none') {
      return normalized;
    }
    return normalized;
  }
  return 'all';
}

function buildTokenOptions({
  webhooks,
  settings,
  events,
  activeToken
}: {
  readonly webhooks: readonly Webhook[];
  readonly settings: readonly WebhookSetting[];
  readonly events: { readonly items: readonly { readonly webhookToken: string | null }[] };
  readonly activeToken: 'all' | 'none' | string;
}): TokenFilterOption[] {
  const tokens = new Set<string>();

  for (const webhook of webhooks) {
    if (webhook.token) {
      tokens.add(webhook.token);
    }
  }

  for (const setting of settings) {
    if (setting.token) {
      tokens.add(setting.token);
    }
  }

  for (const event of events.items) {
    if (event.webhookToken) {
      tokens.add(event.webhookToken);
    }
  }

  const sortedTokens = Array.from(tokens).sort((a, b) => a.localeCompare(b));
  const hasNullSources =
    events.items.some(event => !event.webhookToken) ||
    settings.some(setting => !setting.token) ||
    webhooks.some(webhook => !webhook.token) ||
    activeToken === 'none';

  const options: TokenFilterOption[] = [
    { value: 'all', label: 'Todos', title: 'Todos os webhooks' }
  ];

  if (hasNullSources) {
    options.push({ value: 'none', label: 'Sem token', title: 'Eventos sem token registrado' });
  }

  for (const token of sortedTokens) {
    options.push({ value: token, label: summarizeToken(token), title: token });
  }

  return options;
}

function summarizeToken(token: string): string {
  if (token.length <= 12) {
    return token;
  }
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export default async function WebhooksPage({ searchParams }: WebhooksPageProps) {
  const eventsPageNumber = parseEventsPage(searchParams?.page);
  const activeToken = parseToken(searchParams?.token);

  const [eventsPage, webhooks, webhookSettings] = await Promise.all([
    listWebhookEvents({
      page: eventsPageNumber,
      pageSize: EVENTS_PAGE_SIZE,
      webhookToken: activeToken === 'all' ? undefined : activeToken === 'none' ? null : activeToken
    }),
    (async () => {
      const client = await createKiwifyClient();
      return listWebhooks(client);
    })(),
    listWebhookSettings().catch(error => {
      console.error('list_webhook_settings_failed', error);
      return [] as const;
    })
  ]);

  const settingsMap = mapWebhookSettingsById(webhookSettings);
  const tokenOptions = buildTokenOptions({
    webhooks,
    settings: webhookSettings,
    events: eventsPage,
    activeToken
  });

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
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6 text-center text-slate-500">
                      Nenhum webhook cadastrado até o momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  webhooks.map(webhook => {
                    const setting = settingsMap.get(webhook.id);
                    const isActive = setting?.isActive ?? false;

                    return (
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
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                              isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            {isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <WebhookRowActions webhook={webhook} isActive={isActive} />
                        </TableCell>
                      </TableRow>
                    );
                  })
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
              Acompanhe em tempo real os eventos enviados pela Kiwify com detalhes do cliente, produto e status do
              pedido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WebhookEventsTable
              events={eventsPage}
              activeToken={activeToken}
              tokenOptions={tokenOptions}
              basePath="/webhooks"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
