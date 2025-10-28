import { SyncButton } from './SyncButton';
import { getSalesSummary } from '@/lib/sales';
import { formatDateTime } from '@/lib/ui/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function ConfigsPage() {
  const summary = await getSalesSummary();

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

          <SyncButton className="pt-2" />
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
    </div>
  );
}
