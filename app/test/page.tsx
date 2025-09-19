import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TestForm from "../../components/TestForm";

export const dynamic = "force-dynamic";

export default function TestPage() {
  const adm = cookies().get("adm")?.value;
  if (!adm || adm !== process.env.ADMIN_TOKEN) redirect("/login");

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-2xl font-bold">Teste de Envio (Abandono)</h1>
      <p className="mb-4 text-sm text-neutral-600">
        Preencha seu e-mail e clique em <b>Enviar teste</b>. Isso simula um carrinho abandonado e envia 1 e-mail.
      </p>
      <TestForm />
    </main>
  );
}
