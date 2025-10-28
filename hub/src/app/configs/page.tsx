import { AlertTriangle, PlugZap } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { SyncSalesButton } from "./SyncSalesButton";

export const dynamic = "force-dynamic";

export default function ConfigsPage() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader
          title="Sincronização com Kiwify"
          subtitle="Baixe as vendas oficiais para a tabela sales do Supabase"
          action={<PlugZap className="h-6 w-6 text-slate-400" />}
        />
        <CardContent className="space-y-6">
          <p className="text-sm text-slate-600">
            Sempre que desejar atualizar os dados, pressione o botão abaixo. A integração utiliza a API oficial da Kiwify,
            garantindo compatibilidade total com o Supabase.
          </p>
          <SyncSalesButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Boas práticas" subtitle="Recomendações para evitar erros" action={<AlertTriangle className="h-6 w-6 text-amber-500" />} />
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            • Certifique-se de que as credenciais <code>KIWIFY_CLIENT_ID</code> e <code>KIWIFY_CLIENT_SECRET</code> estejam configuradas nas variáveis de ambiente.
          </p>
          <p>
            • A sincronização utiliza apenas a tabela <code>sales</code> no Supabase. As páginas de Dashboard e Vendas são atualizadas automaticamente após cada sincronização.
          </p>
          <p>
            • Caso a API retorne muitas páginas, basta aguardar a conclusão do processo. O botão ficará disponível novamente quando terminar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
