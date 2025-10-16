import { NextResponse } from "next/server";
import { detectEventKind, normalizeAbandonedCart, normalizeApprovedSale } from "@/lib/kiwify";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEnv } from "@/lib/env";

export async function POST(request: Request) {
  let env;
  try {
    env = getEnv();
  } catch (error) {
    console.error("Variáveis de ambiente ausentes", error);
    return NextResponse.json({ error: "Configuração do servidor ausente" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${env.KIWIFY_WEBHOOK_TOKEN}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Falha ao interpretar payload", error);
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const recordPayload = payload as Record<string, unknown>;

  const kind = detectEventKind(recordPayload);

  if (!kind) {
    return NextResponse.json({ error: "Evento desconhecido" }, { status: 422 });
  }

  const supabase = getSupabaseAdmin();

  try {
    if (kind === "approved_sale") {
      const sale = normalizeApprovedSale(recordPayload);
      const { error } = await supabase
        .from("approved_sales")
        .upsert(
          {
            event_reference: sale.eventReference,
            sale_id: sale.saleId,
            customer_name: sale.customerName,
            customer_email: sale.customerEmail,
            product_name: sale.productName,
            amount: sale.amount,
            currency: sale.currency,
            payment_method: sale.paymentMethod,
            occurred_at: sale.occurredAt,
            payload: sale.payload,
          },
          { onConflict: "event_reference" },
        );

      if (error) {
        console.error("Erro ao gravar venda", error);
        throw error;
      }

      return NextResponse.json({ ok: true, type: kind });
    }

    const cart = normalizeAbandonedCart(recordPayload);
    const { error } = await supabase
      .from("abandoned_carts")
      .upsert(
        {
          event_reference: cart.eventReference,
          cart_id: cart.cartId,
          customer_name: cart.customerName,
          customer_email: cart.customerEmail,
          product_name: cart.productName,
          amount: cart.amount,
          currency: cart.currency,
          checkout_url: cart.checkoutUrl,
          status: cart.status,
          occurred_at: cart.occurredAt,
          payload: cart.payload,
        },
        { onConflict: "event_reference" },
      );

    if (error) {
      console.error("Erro ao gravar carrinho", error);
      throw error;
    }

    return NextResponse.json({ ok: true, type: kind });
  } catch (error) {
    console.error("Erro ao processar webhook", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
