import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col gap-8">
      <section>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">RB Sigma Hub</h1>
        <p className="mt-2 max-w-2xl text-base text-slate-600">
          Painel unificado para sincronizar, acompanhar e analisar todos os dados da sua operação na
          Kiwify utilizando cache local e workflows cooperativos.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sincronizações on-demand</CardTitle>
            <CardDescription>Dispare backfills, reconciliações e retentativas diretamente da UI.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Os processos respeitam janelas curtas, permitem acompanhar o progresso e atualizam os caches de
              métricas automaticamente ao final de cada execução.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insights prontos para ação</CardTitle>
            <CardDescription>Métricas, ranking de produtos e mapas geográficos com cache inteligente.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Consulte rapidamente resultados dos últimos 7, 30 ou 90 dias, compare com períodos anteriores e
              identifique oportunidades sem sair do Hub.
            </p>
          </CardContent>
        </Card>
      </section>

      <div>
        <Button asChild>
          <Link href="/status" className="inline-flex items-center gap-2">
            Ver status do sistema
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </main>
  );
}
