import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key);
}

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

export async function POST(req: NextRequest) {
  const adminTokenCookie = cookies().get("admin_token")?.value;
  if (!adminTokenCookie || adminTokenCookie !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const checkout_id = String(body?.checkout_id || "");
  const email = String(body?.email || "");
  const name = String(body?.name || "");
  const product_name = String(body?.product_name || "Seu produto");
  const checkout_url = String(body?.checkout_url || "");

  if (!checkout_id || !email || !checkout_url) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }

  // idempotência manual: se já houver, não envia de novo
  const { data: exists } = await supabase
    .from("abandoned_emails")
    .select("id")
    .eq("checkout_id", checkout_id)
    .maybeSingle();
  if (exists) {
    return NextResponse.json({ ok: true, alreadySent: true });
  }

  const discount_code = process.env.DEFAULT_DISCOUNT_CODE || "";
  const expire_hours = process.env.DEFAULT_EXPIRE_HOURS || "24";
  const unsubscribe_url = "https://romeikebeauty.example/unsubscribe";

  const template_params = {
    name,
    product_name,
    checkout_url,
    discount_code,
    expire_hours,
    unsubscribe_url,
  };

  // Enviar via EmailJS
  const res = await fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: process.env.EMAILJS_TEMPLATE_ID,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      template_params,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: "EmailJS fail", details: err }, { status: 500 });
  }

  // Gravar no Supabase
  await supabase.from("abandoned_emails").insert({
    checkout_id,
    email,
    product_name,
    checkout_url,
    payload: {
      lead: { email, name },
      product: { name: product_name },
      from: "admin-test"
    }
  });

  return NextResponse.json({ ok: true, sent: true });
}
