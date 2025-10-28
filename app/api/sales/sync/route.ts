import { NextResponse } from 'next/server';
import { syncSalesFromKiwify } from '@/lib/kiwify/salesSync';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await syncSalesFromKiwify();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('sync_sales_failed', error);
    const message = error instanceof Error ? error.message : 'Falha desconhecida ao sincronizar vendas.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
