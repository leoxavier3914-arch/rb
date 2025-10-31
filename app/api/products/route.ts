import { NextResponse } from 'next/server';
import { listProducts } from '@/lib/kiwify/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await listProducts();
    return NextResponse.json({ ok: true, products });
  } catch (error) {
    console.error('list_products_failed', error);
    const message = error instanceof Error ? error.message : 'Não foi possível carregar os produtos agora.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
