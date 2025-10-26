'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, buildApiError } from '@/lib/ui/apiError';

const RESOURCES = ['sales', 'products', 'customers', 'subscriptions', 'enrollments', 'payouts', 'coupons', 'refunds'] as const;
const FORMATS = ['json', 'csv'] as const;

type Resource = (typeof RESOURCES)[number];
type Format = (typeof FORMATS)[number];

interface JobState {
  readonly id: string;
  readonly status: string;
  readonly resultUrl: string | null;
  readonly error?: string | null;
}

async function postJSON(path: string, body: unknown): Promise<any> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-role': 'true'
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || (payload as { ok?: boolean }).ok === false) {
    throw buildApiError(payload, 'Falha ao executar ação.');
  }
  return payload;
}

async function getJSON(path: string): Promise<any> {
  const response = await fetch(path, {
    headers: { 'x-admin-role': 'true' }
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || (payload as { ok?: boolean }).ok === false) {
    throw buildApiError(payload, 'Falha ao obter status.');
  }
  return payload;
}

export default function ExportImportPage() {
  const [resource, setResource] = useState<Resource>('sales');
  const [format, setFormat] = useState<Format>('json');
  const [job, setJob] = useState<JobState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const createJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setLoading(true);
    try {
      const payload = await postJSON('/api/jobs/export', { resource, format });
      setJob({ id: payload.jobId, status: 'queued', resultUrl: null });
      setStatusMessage('Job criado com sucesso. Utilize os botões abaixo para processar e acompanhar.');
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError
          ? `${error.message} (código: ${error.code})`
          : error instanceof Error
            ? error.message
            : 'Falha ao criar job.'
      );
    } finally {
      setLoading(false);
    }
  };

  const runJob = async () => {
    if (!job) {
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      const payload = await postJSON('/api/jobs/run', { jobId: job.id });
      setJob({
        id: job.id,
        status: payload.status,
        resultUrl: payload.result_url ?? null,
        error: payload.error ?? null
      });
      setStatusMessage('Execução concluída. Atualize o status ou baixe o arquivo se disponível.');
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError
          ? `${error.message} (código: ${error.code})`
          : error instanceof Error
            ? error.message
            : 'Falha ao executar job.'
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    if (!job) {
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      const payload = await getJSON(`/api/jobs/status?jobId=${job.id}`);
      setJob({
        id: job.id,
        status: payload.status,
        resultUrl: payload.result_url ?? null,
        error: payload.error ?? null
      });
      setStatusMessage('Status atualizado.');
    } catch (error) {
      setStatusMessage(
        error instanceof ApiError
          ? `${error.message} (código: ${error.code})`
          : error instanceof Error
            ? error.message
            : 'Falha ao consultar status.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Exportar &amp; Importar</h1>
        <p className="mt-2 text-sm text-slate-600">
          Inicie jobs de exportação cooperativos e acompanhe o progresso executando etapas conforme necessário.
        </p>
      </header>

      {statusMessage && (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">{statusMessage}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Criar job de exportação</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={createJob}>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              Recurso
              <select
                className="rounded-md border border-slate-300 p-2 text-slate-900"
                value={resource}
                onChange={event => setResource(event.target.value as Resource)}
              >
                {RESOURCES.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-600">
              Formato
              <select
                className="rounded-md border border-slate-300 p-2 text-slate-900"
                value={format}
                onChange={event => setFormat(event.target.value as Format)}
              >
                {FORMATS.map(option => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <Button type="submit" disabled={loading}>
              {loading ? 'Processando...' : 'Criar job'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {job && (
        <Card>
          <CardHeader>
            <CardTitle>Job atual</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600">
            <div>
              <span className="font-medium text-slate-900">ID:</span> {job.id}
            </div>
            <div>
              <span className="font-medium text-slate-900">Status:</span> {job.status}
            </div>
            {job.error && (
              <div className="text-rose-600">Último erro registrado: {job.error}</div>
            )}
            {job.resultUrl && (
              <a
                href={job.resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Baixar arquivo
              </a>
            )}
            <div className="flex gap-2">
              <Button onClick={runJob} disabled={loading}>
                {loading ? 'Executando...' : 'Executar etapa'}
              </Button>
              <Button variant="secondary" onClick={refreshStatus} disabled={loading}>
                Atualizar status
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
