import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase não configurado para operações de escrita da Kiwify");
}

const sb = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }) : null;

export const chunk = <T>(arr: T[], size: number) => {
  const out: T[][] = [];
  if (!Array.isArray(arr) || size <= 0) return out;
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

async function upsertBatch(table: string, rows: any[]) {
  if (!rows.length) return 0;
  if (!sb) {
    throw new Error("Supabase não configurado");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.MAX_WRITE_MS) || 25000);

  try {
    const { error, count } = await sb
      .from(table)
      .upsert(rows, { onConflict: "id", ignoreDuplicates: false, count: "exact" });

    if (error) {
      throw error;
    }
    return count ?? rows.length;
  } finally {
    clearTimeout(timeout);
  }
}

export const upsertProductsBatch = (rows: any[]) => upsertBatch("kfy_products", rows);
export const upsertSalesBatch = (rows: any[]) => upsertBatch("kfy_sales", rows);

