'use client';

import Link from 'next/link';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiError, buildApiError } from '@/lib/ui/apiError';

interface DoctorCheck {
  readonly id: string;
  readonly label: string;
  readonly pass: boolean;
  readonly details?: string;
}

interface DoctorReport {
  readonly ok: boolean;
  readonly checks: readonly DoctorCheck[];
  readonly recommendations: readonly string[];
}

export default function BackfillDoctorPage(): JSX.Element {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/kfy/backfill-doctor', {
        headers: { 'x-admin-role': 'true' }
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<DoctorReport> & {
        ok?: boolean;
        code?: string;
        error?: string;
      };
      if (!response.ok || payload.ok === false || !payload.checks) {
        throw buildApiError(payload, 'Falha ao executar auditoria.');
      }
      setReport({
        ok: payload.ok ?? true,
        checks: payload.checks ?? [],
        recommendations: payload.recommendations ?? []
      });
    } catch (caught) {
      const failure = caught instanceof Error ? caught : new Error('Falha ao executar auditoria.');
      setError(failure);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadReport();
    } finally {
      setRefreshing(false);
    }
  }, [loadReport]);

  const statusColor = report?.ok ? 'text-emerald-600' : 'text-red-600';

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-slate-900">Backfill Doctor</h1>
          <p className="text-sm text-slate-600">
            Auditoria automática para garantir que o backfill da Kiwify esteja preparado para rodar com segurança.
          </p>
          <Link href="/status" className="text-xs text-slate-500 underline">
            ⟵ Voltar para Status do sistema
          </Link>
        </div>
        <Button type="button" onClick={() => void handleRefresh()} disabled={loading || refreshing}>
          {refreshing || loading ? 'Verificando...' : 'Probar agora'}
        </Button>
      </header>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className={`text-lg ${statusColor}`}>
              {loading ? 'Carregando auditoria...' : report?.ok ? 'Tudo certo com o backfill' : 'Atenção: ajustes necessários'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <p className="text-sm text-red-600">
                {error instanceof ApiError ? `${error.message} (código: ${error.code})` : error.message}
              </p>
            ) : null}
            {!loading && report && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Check</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.checks.map((check) => (
                    <TableRow key={check.id}>
                      <TableCell className="font-medium">{check.label}</TableCell>
                      <TableCell className={check.pass ? 'text-emerald-600' : 'text-red-600'}>
                        {check.pass ? '✅ OK' : '❌ Verificar'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{check.details ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {!loading && report && report.recommendations.length > 0 ? (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-700">Recomendações</h2>
                <ul className="list-inside list-disc text-sm text-slate-600">
                  {report.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
