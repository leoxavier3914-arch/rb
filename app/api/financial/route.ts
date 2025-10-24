import { NextResponse } from "next/server";

import { getFinancialSummary } from "@/lib/kiwify/financial";

export const runtime = "nodejs";

export async function GET() {
  try {
    const summary = await getFinancialSummary();
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
