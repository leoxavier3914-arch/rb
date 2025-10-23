"use client";

import { useFormState } from "react-dom";

import { JsonPreview } from "@/components/json-preview";

import {
  createProductAction,
  productActionInitialState,
  updateProductAction,
  type ProductActionState,
} from "./actions";

const examplePayload = JSON.stringify(
  {
    name: "Nome do produto",
    price: 0,
    status: "draft",
  },
  null,
  2,
);

function ActionFeedback({ state }: { state: ProductActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        state.ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-red-500/40 bg-red-500/10 text-red-300"
      }`}
    >
      {state.message}
    </div>
  );
}

export function CreateProductForm() {
  const [state, formAction] = useFormState(createProductAction, productActionInitialState);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
      <div>
        <h3 className="text-lg font-semibold text-white">Cadastrar novo produto</h3>
        <p className="text-sm text-muted-foreground">
          Envia um POST para o endpoint de produtos da API da Kiwify. Ajuste o JSON de acordo com o
          contrato oficial.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Payload (JSON)
          <textarea
            name="payload"
            defaultValue={examplePayload}
            className="min-h-[180px] w-full rounded-xl border border-surface-accent/40 bg-surface px-4 py-3 text-sm text-muted-foreground shadow-inner focus:border-primary focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Endpoint (opcional)
          <input
            name="resourcePath"
            type="text"
            placeholder="/v1/products"
            className="w-full rounded-xl border border-surface-accent/40 bg-surface px-4 py-2 text-sm text-muted-foreground shadow-inner focus:border-primary focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="inline-flex w-fit items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Criar produto
        </button>
      </form>
      <ActionFeedback state={state} />
      {state.payload ? <JsonPreview data={state.payload} title="Resposta da API" /> : null}
    </div>
  );
}

export function UpdateProductForm() {
  const [state, formAction] = useFormState(updateProductAction, productActionInitialState);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
      <div>
        <h3 className="text-lg font-semibold text-white">Atualizar produto</h3>
        <p className="text-sm text-muted-foreground">
          Envia um PATCH para o endpoint de produtos. Informe o ID e apenas os campos que deseja atualizar.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          ID do produto
          <input
            name="productId"
            type="text"
            placeholder="prod_xxxxx"
            className="w-full rounded-xl border border-surface-accent/40 bg-surface px-4 py-2 text-sm text-muted-foreground shadow-inner focus:border-primary focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Payload (JSON)
          <textarea
            name="payload"
            defaultValue={examplePayload}
            className="min-h-[180px] w-full rounded-xl border border-surface-accent/40 bg-surface px-4 py-3 text-sm text-muted-foreground shadow-inner focus:border-primary focus:outline-none"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Endpoint (opcional)
          <input
            name="resourcePath"
            type="text"
            placeholder="/v1/products"
            className="w-full rounded-xl border border-surface-accent/40 bg-surface px-4 py-2 text-sm text-muted-foreground shadow-inner focus:border-primary focus:outline-none"
          />
        </label>
        <button
          type="submit"
          className="inline-flex w-fit items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          Atualizar produto
        </button>
      </form>
      <ActionFeedback state={state} />
      {state.payload ? <JsonPreview data={state.payload} title="Resposta da API" /> : null}
    </div>
  );
}
