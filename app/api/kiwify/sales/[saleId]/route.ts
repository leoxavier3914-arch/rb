import { NextResponse } from "next/server";

import { hasKiwifyApiEnv } from "@/lib/env";
import { KiwifyApiError, kiwifyFetch } from "@/lib/kiwify/client";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { saleId: string } }) {
  if (!hasKiwifyApiEnv()) {
    return NextResponse.json(
      { error: "API da Kiwify não configurada." },
      { status: 503 },
    );
  }

  const saleId = decodeURIComponent(params.saleId ?? "");
  if (!saleId) {
    return NextResponse.json(
      { error: "ID da venda é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const sale = await kiwifyFetch<unknown>(`sales/${saleId}`, { cache: "no-store" });
    return NextResponse.json({ data: sale });
  } catch (error) {
    console.error("Erro ao consultar detalhes da venda", saleId, error);

    if (error instanceof KiwifyApiError) {
      if (error.status === 404) {
        return NextResponse.json(
          { error: "Venda não encontrada." },
          { status: 404 },
        );
      }

      return NextResponse.json(
        { error: error.message, details: error.details ?? null },
        { status: error.status },
      );
    }

    const message = error instanceof Error ? error.message : "Erro desconhecido ao carregar a venda.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
