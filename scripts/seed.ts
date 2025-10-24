import { supabaseAdmin } from "@/lib/supabase";

async function seed() {
  await supabaseAdmin.from("kfy_products").upsert(
    Array.from({ length: 3 }).map((_, index) => ({
      external_id: `demo-product-${index}`,
      title: `Produto Demo ${index + 1}`,
      price_cents: 1000 * (index + 1),
      currency: "BRL",
      status: "approved",
    })),
  );

  await supabaseAdmin.from("kfy_customers").upsert(
    Array.from({ length: 3 }).map((_, index) => ({
      external_id: `demo-customer-${index}`,
      name: `Cliente ${index + 1}`,
      email: `cliente${index + 1}@example.com`,
    })),
  );

  console.log("Seed concluído");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
