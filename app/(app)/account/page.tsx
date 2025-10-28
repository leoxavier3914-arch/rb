'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OperationResult } from '@/components/ui/operation-result';
import { callKiwifyAdminApi } from '@/lib/ui/kiwifyAdminApi';
import { useOperation } from '@/lib/ui/useOperation';

export default function AccountPage() {
  const accountOperation = useOperation<unknown>();

  const handleFetchAccount = useCallback(async () => {
    await accountOperation.run(() =>
      callKiwifyAdminApi('/api/kfy/account', {}, 'Erro ao consultar detalhes da conta.')
    );
  }, [accountOperation]);

  return (
    <main className="flex flex-1 flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Conta</h1>
        <p className="mt-2 text-sm text-slate-600">
          Consulte rapidamente os dados da sua conta da Kiwify para validar o status da integração.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Obter detalhes da conta</CardTitle>
          <CardDescription>Recupere todas as informações da conta vinculada às credenciais atuais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleFetchAccount} disabled={accountOperation.loading}>
            {accountOperation.loading ? 'Consultando…' : 'Consultar conta'}
          </Button>
          <OperationResult
            loading={accountOperation.loading}
            error={accountOperation.error}
            data={accountOperation.data}
          />
        </CardContent>
      </Card>
    </main>
  );
}
