import { NextResponse } from "next/server";

import { getFinancialSummary } from "@/lib/kiwify/financial";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const start_date = url.searchParams.get("start_date") || undefined;
    const end_date = url.searchParams.get("end_date") || undefined;

    const summary = await getFinancialSummary({ start_date, end_date });
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error("[Kiwify][Financial] error:", err?.message || err);
    return NextResponse.json(
      {
        error: "Falha ao consultar dados financeiros na Kiwify",
        details: String(err?.message || err),
      },
      { status: 500 },
    );
  }
}
