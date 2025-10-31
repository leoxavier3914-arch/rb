'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMoneyFromCents } from '@/lib/ui/format';
import { cn } from '@/lib/ui/classnames';

interface CreatePayoutFormProps {
  readonly availableCents: number;
  readonly variant?: 'default' | 'dashboard';
}

type FormState = 'idle' | 'loading' | 'success' | 'error';

export function CreatePayoutForm({ availableCents, variant = 'default' }: CreatePayoutFormProps) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

  const formattedAvailable = formatMoneyFromCents(availableCents);
  const isDashboardVariant = variant === 'dashboard';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'loading') {
      return;
    }

    const normalized = value.replace(/\./g, '').replace(',', '.');
    const amountNumber = Number.parseFloat(normalized);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setState('error');
      setMessage('Informe um valor válido em reais.');
      return;
    }

    const amountCents = Math.round(amountNumber * 100);
    if (availableCents > 0 && amountCents > availableCents) {
      setState('error');
      setMessage('O valor solicitado excede o saldo disponível.');
      return;
    }

    try {
      setState('loading');
      setMessage('Enviando solicitação de saque para a Kiwify...');
      const response = await fetch('/api/finance/payouts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ amount: amountCents })
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; error?: string; payout?: { id: string } }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        const errorMessage = payload?.error ?? 'Não foi possível solicitar o saque.';
        setState('error');
        setMessage(errorMessage);
        return;
      }

      setValue('');
      setState('success');
      const id = payload.payout?.id ?? '';
      setMessage(id ? `Saque solicitado com sucesso. ID: ${id}` : 'Saque solicitado com sucesso.');
      router.refresh();
    } catch (error) {
      console.error('create_payout_ui_error', error);
      setState('error');
      setMessage('Falha inesperada ao falar com a API. Tente novamente.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', isDashboardVariant && 'space-y-5')}>
      <div className="space-y-1">
        <label
          htmlFor="amount"
          className={cn('text-sm font-medium text-slate-700', isDashboardVariant && 'sr-only')}
        >
          Valor do saque (em R$)
        </label>
        <input
          id="amount"
          name="amount"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={event => setValue(event.target.value)}
          placeholder="Ex: 150,00"
          className={cn(
            'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200',
            isDashboardVariant &&
              'border-white/30 bg-white/10 text-white placeholder:text-white/60 focus:border-white/50 focus:ring-2 focus:ring-white/40 focus:ring-offset-0'
          )}
        />
        <p
          className={cn(
            'text-xs text-slate-500',
            isDashboardVariant && 'sr-only'
          )}
        >
          Saldo disponível: {formattedAvailable}
        </p>
      </div>

      <Button
        type="submit"
        className={cn(
          'gap-2',
          isDashboardVariant &&
            'w-full rounded-lg bg-white text-[#0231b1] hover:bg-white/90 focus-visible:ring-white/50 focus-visible:ring-offset-0'
        )}
        size={isDashboardVariant ? 'lg' : 'default'}
        variant={isDashboardVariant ? 'secondary' : 'default'}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Solicitar saque
      </Button>

      {state !== 'idle' ? (
        <p
          className={cn(
            'flex items-center gap-2 text-sm',
            state === 'error'
              ? isDashboardVariant
                ? 'text-rose-100'
                : 'text-rose-600'
              : state === 'success'
              ? isDashboardVariant
                ? 'text-emerald-100'
                : 'text-emerald-600'
              : isDashboardVariant
              ? 'text-white/80'
              : 'text-slate-600'
          )}
        >
          {state === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : state === 'success' ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          ) : state === 'error' ? (
            <AlertCircle className="h-4 w-4" aria-hidden />
          ) : null}
          <span>{message}</span>
        </p>
      ) : null}
    </form>
  );
}
