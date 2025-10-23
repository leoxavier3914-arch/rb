import { hasKiwifyApiEnv } from "@/lib/env";

import { ParticipantsForm } from "./form";

export const dynamic = "force-dynamic";

export default function ParticipantsPage() {
  if (!hasKiwifyApiEnv()) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-100">
        Configure as credenciais da API para consultar a lista de participantes matriculados nos produtos da Kiwify.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Participantes e matrículas</h3>
        <p className="text-sm text-muted-foreground">
          A listagem de participantes permite cruzar dados de acesso com o Supabase, identificar alunos inadimplentes e
          realizar liberações manuais seguindo o contrato de /v1/products/:id/participants.
        </p>
      </section>

      <ParticipantsForm />
    </div>
  );
}
