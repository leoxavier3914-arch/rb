import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';

const MOCK_STATUS = {
  lastSyncAt: null as string | null,
  cursorState: 'Nenhuma sincronização registrada',
  failedEvents: 0,
  jobsPending: 0
};

export default function StatusPage() {
  return (
    <main className="flex flex-1 flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-slate-900">Status do sistema</h1>
        <p className="text-sm text-slate-600">
          Acompanhe a saúde das integrações com a Kiwify, verifique eventos com falha e execute retentativas de forma
          manual.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Última sincronização" value={MOCK_STATUS.lastSyncAt ?? 'Nunca'} />
        <StatCard label="Cursor atual" value={MOCK_STATUS.cursorState} />
        <StatCard label="Eventos com falha" value={MOCK_STATUS.failedEvents.toString()} />
        <StatCard label="Jobs pendentes" value={MOCK_STATUS.jobsPending.toString()} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks com falha</CardTitle>
          <CardDescription>Reprocesse eventos da Kiwify que não foram aplicados com sucesso.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            Assim que houver eventos pendentes, eles aparecerão aqui para que você possa reprocessá-los em pequenos
            lotes.
          </p>
          <Button className="w-fit" type="button" disabled>
            Reprocessar falhas
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
