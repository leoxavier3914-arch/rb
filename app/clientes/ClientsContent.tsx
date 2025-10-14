'use client';

import { useMemo, useState } from 'react';

export type ClientPurchase = {
  productName: string;
  paidAtLabel: string;
  paidAtTimestamp: number;
  conversionLabel: string;
  originLabel: string;
  groupLabel: string;
};

export type ClientSummary = {
  email: string;
  name: string | null;
  purchases: ClientPurchase[];
  lastPurchaseTimestamp: number;
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const matchesSearch = (client: ClientSummary, query: string) => {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeText(query);
  const name = client.name ? normalizeText(client.name) : '';
  const email = normalizeText(client.email);

  if (name.includes(normalizedQuery) || email.includes(normalizedQuery)) {
    return true;
  }

  return client.purchases.some((purchase) => normalizeText(purchase.productName).includes(normalizedQuery));
};

type ClientsContentProps = {
  clients: ClientSummary[];
};

export default function ClientsContent({ clients }: ClientsContentProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = useMemo(
    () => clients.filter((client) => matchesSearch(client, searchQuery)),
    [clients, searchQuery],
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Lista de clientes</h2>
          <p className="text-sm text-slate-400">Toque para expandir os detalhes de cada cliente.</p>
        </div>
        <label className="relative block text-sm">
          <span className="sr-only">Pesquisar cliente por nome ou produto</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Pesquisar por nome do cliente ou produto"
            className="w-72 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-brand"
          />
        </label>
      </div>

      {filteredClients.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
          Nenhum cliente encontrado com os critérios de busca informados.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredClients.map((client) => (
            <details
              key={client.email}
              className="group rounded-xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-slate-700"
            >
              <summary className="cursor-pointer list-none outline-none">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">{client.name ?? 'Cliente sem nome'}</p>
                    <p className="text-sm text-slate-400">{client.email}</p>
                  </div>
                  <span className="text-sm text-slate-400">
                    {client.purchases.length === 1 ? '1 compra registrada' : `${client.purchases.length} compras registradas`}
                  </span>
                </div>
              </summary>

              <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
                {client.purchases.map((purchase, index) => (
                  <article
                    key={`${client.email}-${purchase.paidAtTimestamp}-${index}`}
                    className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
                  >
                    <h3 className="text-base font-semibold text-white">{purchase.productName}</h3>
                    <dl className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                      <div>
                        <dt className="font-medium text-slate-400">Pagamento</dt>
                        <dd>{purchase.paidAtLabel}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-400">Tipo de conversão</dt>
                        <dd>{purchase.conversionLabel}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-400">Origem informada</dt>
                        <dd>{purchase.originLabel}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-400">Grupo de tráfego</dt>
                        <dd>{purchase.groupLabel}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
