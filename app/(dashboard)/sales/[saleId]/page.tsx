import { redirect } from "next/navigation";

interface LegacySaleDetailRedirectPageProps {
  params: { saleId?: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

const allowedParams = new Set(["entry", "status", "q", "start_date", "end_date", "page"]);

export default function LegacySaleDetailRedirectPage({
  params,
  searchParams,
}: LegacySaleDetailRedirectPageProps) {
  const saleId = params.saleId;

  if (!saleId) {
    redirect("/api/sales");
  }

  const query = new URLSearchParams();

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (!allowedParams.has(key)) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const entry of value) {
          if (entry != null) {
            query.append(key, entry);
          }
        }
      } else if (value != null) {
        query.set(key, value);
      }
    }
  }

  const qs = query.toString();
  const target = qs
    ? `/api/sales/${encodeURIComponent(saleId)}?${qs}`
    : `/api/sales/${encodeURIComponent(saleId)}`;

  redirect(target);
}
