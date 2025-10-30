import { NextResponse } from 'next/server';
import * as finance from '@/lib/finance';

export const dynamic = 'force-dynamic';

type CreatePayoutExecutor = (amount: number) => Promise<finance.CreatePayoutResult>;

export async function handleCreatePayoutRequest(
  request: Request,
  createPayoutImpl: CreatePayoutExecutor = finance.createPayout
) {
  try {
    const payload = (await request.json().catch(() => null)) as { amount?: unknown } | null;
    const amountRaw = payload?.amount;
    const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Informe um valor válido em centavos para solicitar o saque.' },
        { status: 400 }
      );
    }

    const result = await createPayoutImpl(Math.round(amount));
    return NextResponse.json({ ok: true, payout: result });
  } catch (error) {
    console.error('create_payout_failed', error);
    const message = error instanceof Error ? error.message : 'Não foi possível solicitar o saque agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleCreatePayoutRequest(request);
}
