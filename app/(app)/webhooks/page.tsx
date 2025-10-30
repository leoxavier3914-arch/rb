import { createKiwifyClient } from '@/lib/kiwify/client';
import { listWebhooks } from '@/lib/webhooks';
import { formatDateTime } from '@/lib/ui/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateWebhookForm } from './CreateWebhookForm';
import { WebhookRowActions } from './WebhookRowActions';

export const dynamic = 'force-dynamic';

function formatEvents(events: readonly string[]): string {
  if (!events || events.length === 0) {
    return '—';
  }
  return events.join(', ');
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

export default async function WebhooksPage() {
  const client = await createKiwifyClient();
  const webhooks = await listWebhooks(client);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Webhooks</h1>
        <p className="text-sm text-slate-500">
          Gerencie os webhooks cadastrados na API oficial da Kiwify para receber atualizações de eventos em tempo real.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="order-2 lg:order-1">
          <CardHeader>
            <CardTitle className="text-xl">Webhooks configurados</CardTitle>
            <CardDescription>Consulta em tempo real diretamente da Kiwify.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-slate-500">
                      Nenhum webhook cadastrado até o momento.
                    </TableCell>
                  </TableRow>
                ) : (
                  webhooks.map(webhook => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-mono text-xs text-slate-500">{webhook.id}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-slate-900" title={webhook.url}>
                        {webhook.url}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600" title={formatEvents(webhook.events)}>
                        {formatEvents(webhook.events)}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium uppercase text-slate-600">
                          {formatStatus(webhook.status)}
                        </span>
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

        <Card className="order-1 lg:order-2">
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
    </div>
  );
}
