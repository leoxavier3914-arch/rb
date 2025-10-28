'use client';

import { FormEvent, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationResult } from '@/components/ui/operation-result';
import { callKiwifyAdminApi } from '@/lib/ui/kiwifyAdminApi';
import { useOperation } from '@/lib/ui/useOperation';

export default function PayoutsPage() {
  const balancesOperation = useOperation<unknown>();
  const balanceOperation = useOperation<unknown>();
  const listOperation = useOperation<unknown>();
  const detailOperation = useOperation<unknown>();
  const createOperation = useOperation<unknown>();

  const [balanceLegalEntity, setBalanceLegalEntity] = useState('');
  const [listLegalEntity, setListLegalEntity] = useState('');
  const [listPageSize, setListPageSize] = useState('');
  const [listPage, setListPage] = useState('');

  const [withdrawalId, setWithdrawalId] = useState('');

  const [createAmount, setCreateAmount] = useState('');
  const [createLegalEntity, setCreateLegalEntity] = useState('');

  const handleBalances = useCallback(async () => {
    await balancesOperation.run(() =>
      callKiwifyAdminApi('/api/kfy/finance/balances', {}, 'Erro ao consultar saldos.')
    );
  }, [balancesOperation]);

  const handleBalanceByEntity = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (balanceLegalEntity.trim() === '') {
        balanceOperation.reset();
        return;
      }
      await balanceOperation.run(() =>
        callKiwifyAdminApi(
          `/api/kfy/finance/balances/${encodeURIComponent(balanceLegalEntity.trim())}`,
          {},
          'Erro ao consultar saldo específico.'
        )
      );
    },
    [balanceLegalEntity, balanceOperation]
  );

  const handleListWithdrawals = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const params = new URLSearchParams();
      if (listLegalEntity.trim() !== '') {
        params.set('legal_entity_id', listLegalEntity.trim());
      }
      if (listPageSize.trim() !== '') {
        params.set('page_size', listPageSize.trim());
      }
      if (listPage.trim() !== '') {
        params.set('page', listPage.trim());
      }

      await listOperation.run(() =>
        callKiwifyAdminApi(
          `/api/kfy/finance/withdrawals?${params.toString()}`,
          {},
          'Erro ao listar saques.'
        )
      );
    },
    [listLegalEntity, listOperation, listPage, listPageSize]
  );

  const handleWithdrawalDetail = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (withdrawalId.trim() === '') {
        detailOperation.reset();
        return;
      }
      await detailOperation.run(() =>
        callKiwifyAdminApi(
          `/api/kfy/finance/withdrawals/${encodeURIComponent(withdrawalId.trim())}`,
          {},
          'Erro ao consultar saque.'
        )
      );
    },
    [detailOperation, withdrawalId]
  );

  const handleCreateWithdrawal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      await createOperation.run(() => {
        if (createLegalEntity.trim() === '' || createAmount.trim() === '') {
          throw new Error('Preencha o valor e a Legal Entity ID para solicitar o saque.');
        }

        const amount = Number(createAmount.trim());
        if (Number.isNaN(amount) || amount <= 0) {
          throw new Error('Informe um valor válido em centavos para o saque.');
        }

        return callKiwifyAdminApi(
          '/api/kfy/finance/withdrawals',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ legal_entity_id: createLegalEntity.trim(), amount })
          },
          'Erro ao solicitar saque.'
        );
      });
    },
    [createAmount, createLegalEntity, createOperation]
  );

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Financeiro</h1>
        <p className="mt-2 text-sm text-slate-600">
          Acompanhe saldos disponíveis, consulte repasses e solicite novos saques diretamente pela API da Kiwify.
        </p>
      </header>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Consultar saldos</CardTitle>
            <CardDescription>Recupere todos os saldos disponíveis para as entidades legais vinculadas à conta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <Button onClick={handleBalances} disabled={balancesOperation.loading}>
            {balancesOperation.loading ? 'Consultando…' : 'Listar saldos'}
          </Button>
          <OperationResult
            loading={balancesOperation.loading}
            error={balancesOperation.error}
            data={balancesOperation.data}
          />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Consultar saldo específico</CardTitle>
            <CardDescription>Informe a entidade legal desejada para visualizar o saldo correspondente.</CardDescription>
          </CardHeader>
          <CardContent>
          <form className="space-y-4" onSubmit={handleBalanceByEntity}>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Legal Entity ID
              <input
                type="text"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                value={balanceLegalEntity}
                onChange={event => setBalanceLegalEntity(event.target.value)}
                placeholder="le_xxxxx"
              />
            </label>
            <Button type="submit" disabled={balanceOperation.loading}>
              {balanceOperation.loading ? 'Consultando…' : 'Consultar saldo'}
            </Button>
          </form>
          <OperationResult loading={balanceOperation.loading} error={balanceOperation.error} data={balanceOperation.data} />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Listar saques</CardTitle>
            <CardDescription>Filtre os saques por entidade legal e navegue pelos resultados paginados.</CardDescription>
          </CardHeader>
          <CardContent>
          <form className="space-y-4" onSubmit={handleListWithdrawals}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Legal Entity ID
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={listLegalEntity}
                  onChange={event => setListLegalEntity(event.target.value)}
                  placeholder="le_xxxxx"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Tamanho da página
                <input
                  type="number"
                  min={1}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={listPageSize}
                  onChange={event => setListPageSize(event.target.value)}
                  placeholder="10"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Número da página
                <input
                  type="number"
                  min={1}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={listPage}
                  onChange={event => setListPage(event.target.value)}
                  placeholder="1"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={listOperation.loading}>
                {listOperation.loading ? 'Consultando…' : 'Listar saques'}
              </Button>
              {!!listOperation.data && !listOperation.loading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setListLegalEntity('');
                    setListPageSize('');
                    setListPage('');
                    listOperation.reset();
                  }}
                >
                  Limpar resultado
                </Button>
              )}
            </div>
          </form>
          <OperationResult loading={listOperation.loading} error={listOperation.error} data={listOperation.data} />
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Consultar saque</CardTitle>
              <CardDescription>Recupere os detalhes de um saque específico informando o ID do processo.</CardDescription>
            </CardHeader>
            <CardContent>
            <form className="space-y-4" onSubmit={handleWithdrawalDetail}>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                ID do saque
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={withdrawalId}
                  onChange={event => setWithdrawalId(event.target.value)}
                  placeholder="wd_xxxxx"
                />
              </label>
              <Button type="submit" disabled={detailOperation.loading}>
                {detailOperation.loading ? 'Consultando…' : 'Consultar saque'}
              </Button>
            </form>
            <OperationResult
              loading={detailOperation.loading}
              error={detailOperation.error}
              data={detailOperation.data}
            />
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Realizar saque</CardTitle>
              <CardDescription>Solicite um novo saque informando o valor em centavos e a entidade legal responsável.</CardDescription>
            </CardHeader>
            <CardContent>
            <form className="space-y-4" onSubmit={handleCreateWithdrawal}>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Valor do saque (centavos)
                <input
                  type="number"
                  min={1}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={createAmount}
                  onChange={event => setCreateAmount(event.target.value)}
                  placeholder="10000"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Legal Entity ID
                <input
                  type="text"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  value={createLegalEntity}
                  onChange={event => setCreateLegalEntity(event.target.value)}
                  placeholder="le_xxxxx"
                />
              </label>
              <Button type="submit" disabled={createOperation.loading}>
                {createOperation.loading ? 'Solicitando…' : 'Solicitar saque'}
              </Button>
            </form>
            <OperationResult
              loading={createOperation.loading}
              error={createOperation.error}
              data={createOperation.data}
            />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
