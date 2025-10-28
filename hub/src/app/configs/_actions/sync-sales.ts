"use server";

import { revalidatePath } from "next/cache";
import { syncSalesFromKiwify } from "@/lib/kiwify/api";

export async function syncSalesAction() {
  const result = await syncSalesFromKiwify();
  revalidatePath("/dashboard");
  revalidatePath("/sales");
  return result;
}
