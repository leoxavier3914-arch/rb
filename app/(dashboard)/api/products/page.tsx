import { JsonPreview } from "@/components/json-preview";
import { hasKiwifyApiEnv } from "@/lib/env";
import { listProducts } from "@/lib/kiwify/resources";

import { CreateProductForm, UpdateProductForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  if (!hasKiwifyApiEnv()) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/40 bg-yellow-500/10 p-6 text-sm text-yellow-100">
        Configure as variáveis da API para listar e gerenciar produtos cadastrados na Kiwify.
      </div>
    );
  }

  let products: unknown = null;
  let error: string | null = null;

  try {
    products = await listProducts({ perPage: 25 });
  } catch (err) {
    console.error("Erro ao consultar produtos na Kiwify", err);
    error = "Não foi possível listar os produtos. Verifique o token e as permissões.";
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
        <h3 className="text-lg font-semibold text-white">Catálogo oficial</h3>
        <p className="text-sm text-muted-foreground">
          Consulte o catálogo completo, cadastre novos produtos e atualize os existentes com os mesmos parâmetros da
          documentação oficial (/v1/products). Utilize os formulários abaixo para enviar o payload que a Kiwify espera.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <CreateProductForm />
        <UpdateProductForm />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-100">{error}</div>
      ) : (
        <JsonPreview title="Lista de produtos (GET /v1/products)" data={products} />
      )}
    </div>
  );
}
