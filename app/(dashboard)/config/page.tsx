import { SyncPanel } from "@/components/config/SyncPanel";
import { supabaseAdmin } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";

async function getRecentEvents() {
  const { data, error } = await supabaseAdmin
    .from("kfy_events")
    .select("type, external_id, occurred_at, received_at")
    .order("received_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

const requiredEnv = [
  "KIWIFY_CLIENT_ID",
  "KIWIFY_CLIENT_SECRET",
  "KIWIFY_ACCOUNT_ID",
  "KIWIFY_WEBHOOK_SECRET",
  "NEXT_PUBLIC_APP_TIMEZONE",
];

function envStatus(name: string) {
  const value = process.env[name];
  if (!value) return "ausente";
  if (name.includes("SECRET")) return "definido";
  return value;
}

export default async function ConfigPage() {
  const events = await getRecentEvents();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-white">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gere sincronizações manualmente e valide o estado das integrações com a Kiwify.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white">Variáveis de ambiente</h2>
        <ul className="grid gap-2 rounded-2xl border border-surface-accent/40 bg-surface/80 p-4 text-sm text-muted-foreground md:grid-cols-2">
          {requiredEnv.map((env) => (
            <li key={env} className="flex items-center justify-between gap-4">
              <span>{env}</span>
              <span className="text-white">{envStatus(env)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white">Sincronização</h2>
        <SyncPanel />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white">Últimos eventos</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-accent/40 text-sm">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Tipo</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Referência</th>
                <th className="px-4 py-2 text-left text-xs uppercase tracking-wide text-muted-foreground">Recebido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-accent/20">
              {events.map((event) => (
                <tr key={`${event.type}-${event.external_id}`} className="hover:bg-surface-accent/40">
                  <td className="px-4 py-2 capitalize">{event.type}</td>
                  <td className="px-4 py-2">{event.external_id}</td>
                  <td className="px-4 py-2">{formatDateTime(event.received_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
