import { redirect } from "next/navigation";

export default function LegacySalesRedirectPage() {
  redirect("/api/sales");
}
