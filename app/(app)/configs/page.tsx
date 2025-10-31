import { SyncButton } from './SyncButton';
import { getSalesSummary } from '@/lib/sales';
import { runHealthCheck } from '@/lib/health';
import { formatDateTime } from '@/lib/ui/format';
import { cn } from '@/lib/ui/classnames';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function ConfigsPage() {
  const [summary, health] = await Promise.all([getSalesSummary(), runHealthCheck()]);

  const statusStyles = {
    healthy: {
      indicator: 'bg-emerald-500',
      container: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      message: 'Todos os sistemas estão operacionais.'
    },
    attention: {
      indicator: 'bg-amber-500',
      container: 'border-amber-200 bg-amber-50 text-amber-700',
      message: 'Algumas verificações requerem atenção.'
    },
    unhealthy: {
      indicator: 'bg-rose-500',
      container: 'border-rose-200 bg-rose-50 text-rose-700',
      message: 'Falha crítica detectada. Ajustes necessários.'
    }
  } as const;

  const currentStatus = statusStyles[health.status];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Configs</h1>
        <p className="text-sm text-slate-500">
          Área operacional para iniciar a sincronização manual das vendas da Kiwify com o Supabase.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sincronizar vendas</CardTitle>
          <CardDescription>
            Clique em &quot;Sincronizar&quot; para buscar vendas diretamente da API oficial da Kiwify e salvar na tabela
            <code className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-600">sales</code> do Supabase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total de vendas</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {summary.totalSales.toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última sincronização</p>
              <p className="mt-1 text-lg text-slate-900">
                {summary.lastSyncedAt ? formatDateTime(summary.lastSyncedAt) : 'Nunca sincronizado'}
              </p>
            </div>
          </div>

          <SyncButton className="pt-2" disabled={health.hasCriticalFailure} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Como funciona</CardTitle>
          <CardDescription>
            Integração simples e direta seguindo a documentação oficial da API da Kiwify (OAuth + endpoint de vendas).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            1. Solicitamos um token OAuth de acordo com
            <a
              className="ml-1 text-slate-900 underline decoration-slate-300 decoration-dashed underline-offset-4"
              href="https://docs.kiwify.com.br/api-reference/auth/oauth"
              target="_blank"
              rel="noreferrer"
            >
              Auth / OAuth
            </a>
            .
          </p>
          <p>
            2. Chamamos o endpoint
            <a
              className="ml-1 text-slate-900 underline decoration-slate-300 decoration-dashed underline-offset-4"
              href="https://docs.kiwify.com.br/api-reference/sales/list"
              target="_blank"
              rel="noreferrer"
            >
              Sales / List
            </a>
            , respeitando o limite de 90 dias por solicitação.
          </p>
          <p>
            3. Gravamos ou atualizamos cada venda na tabela <code className="bg-slate-100 px-1 py-0.5">sales</code> do Supabase,
            preservando o JSON original em <code className="bg-slate-100 px-1 py-0.5">raw</code> para auditoria.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Health check</CardTitle>
          <CardDescription>
            Validação automática das configurações críticas e acesso ao banco de dados antes da sincronização manual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn('flex items-center gap-3 rounded-md border p-3 text-sm font-medium', currentStatus.container)}>
            <span className={cn('h-2.5 w-2.5 rounded-full', currentStatus.indicator)} aria-hidden />
            <span>{currentStatus.message}</span>
          </div>

          <div className="space-y-3">
            {health.checks.map(check => {
              const isOk = check.status === 'ok';
              return (
                <div
                  key={check.name}
                  className={cn(
                    'rounded-md border p-3',
                    isOk ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/70'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn('h-2.5 w-2.5 rounded-full', isOk ? 'bg-emerald-500' : 'bg-rose-500')}
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-slate-800">{check.name}</p>
                    {check.critical ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Crítico
                      </span>
                    ) : null}
                  </div>
                  <p className={cn('mt-2 text-sm', isOk ? 'text-slate-600' : 'text-rose-600')}>{check.message}</p>
                  {check.details ? <p className="mt-1 text-xs text-rose-500">{check.details}</p> : null}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-400">Última verificação: {formatDateTime(health.timestamp)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
