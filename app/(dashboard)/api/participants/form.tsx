"use client";

export const dynamic = "force-dynamic";

import { useFormState } from "react-dom";

import { JsonPreview } from "@/components/json-preview";

import {
  loadParticipantsAction,
  participantsActionInitialState,
  type ParticipantsActionState,
} from "./actions";

function ParticipantsFeedback({ state }: { state: ParticipantsActionState }) {
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

export function ParticipantsForm() {
  const [state, formAction] = useFormState(loadParticipantsAction, participantsActionInitialState);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-surface-accent/40 bg-surface-accent/60 p-6 shadow-soft">
      <div>
        <h3 className="text-lg font-semibold text-white">Listagem por produto</h3>
        <p className="text-sm text-muted-foreground">
          Informe o ID do produto ou oferta para consultar os participantes cadastrados na Kiwify. Você pode filtrar por
          status e ajustar o número de registros retornados por página.
        </p>
      </div>
      <form action={formAction} className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-muted-foreground md:col-span-2">
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
          Status (opcional)
          <input
            name="status"
            type="text"
            placeholder="active | canceled"
            className="w-full rounded-xl border border-surface-accent/40 bg-surface px-4 py-2 text-sm text-muted-foreground shadow-inner focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Registros por página
          <input
            name="perPage"
            type="number"
            min={1}
            max={100}
            defaultValue={50}
            className="w-full rounded-xl border border-surface-accent/40 bg-surface px-4 py-2 text-sm text-muted-foreground shadow-inner focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-muted-foreground md:col-span-2">
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
          Buscar participantes
        </button>
      </form>
      <ParticipantsFeedback state={state} />
      {state.payload ? <JsonPreview data={state.payload} title="Participantes" /> : null}
    </div>
  );
}
