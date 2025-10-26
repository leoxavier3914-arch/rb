# RB Sigma Hub

RB Sigma Hub é um painel construído com Next.js para acompanhar métricas e administrar a sincronização dos dados da Kiwify utilizando Supabase como cache local.

## Stack

- Next.js 15 (App Router)
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Supabase

## Como rodar o projeto

```bash
pnpm install
pnpm dev
```

Para gerar a build de produção:

```bash
pnpm build
```

## Fluxo de sincronização

1. A base local do Supabase recebe os dados vindos da Kiwify.
2. A sincronização pode ser disparada manualmente via `/api/kfy/sync` ou pelos botões na interface administrativa.
3. Webhooks da Kiwify são consumidos e processados, garantindo que eventos recentes atualizem o cache.
4. Os dados ficam disponíveis para consulta nas páginas do hub e nos endpoints internos.

## Páginas principais

- `/dashboard` — visão geral de métricas e produtos em destaque.
- `/sales` — listagem de vendas com detalhes, notas e eventos.
- `/products` — placeholder para catálogo de produtos sincronizados.
- `/customers` — visão agregada (em breve) sobre clientes.
- `/export-import` — orquestração de jobs de exportação.
- `/config-sync` — ações administrativas de sincronização.
- `/status` — saúde da integração e reprocessamento de webhooks.

## Endpoints internos

- `/api/hub/*` — métricas, listagens e estatísticas do hub.
- `/api/jobs/*` — criação, execução e acompanhamento de jobs de exportação.
- `/api/kfy/sync` — sincronização incremental ou completa dos recursos.
- `/api/kfy/reconcile` — reconciliação dos últimos 30 dias.
- `/api/kfy/token` — renovação do token de acesso da Kiwify.
- `/api/kfy/webhook/retry` — retentativa de webhooks com falha.

## Troubleshooting

- **403 BAD_ORIGIN** — confira a variável `ALLOWED_ORIGINS`; inclua o domínio atual (ou wildcard) para liberar o acesso.
- **401 NO_ADMIN** — as requisições internas precisam do header `x-admin-role: true` (e, quando configurado, da chave interna).
- **Timeout na sincronização** — aumente o orçamento configurando `SYNC_BUDGET_MS` para um valor maior.
- **Sincronização lenta** — ajuste `KFY_PAGE_SIZE`, `DB_UPSERT_BATCH` e `MAX_WRITE_MS` conforme necessário.

## Deploy em produção

1. Faça o deploy do frontend na Vercel.
2. Configure um projeto no Supabase e aplique as migrações SQL disponíveis em `supabase/migrations`.
3. Preencha as variáveis de ambiente na Vercel e no Supabase (quando necessário) com os valores corretos, incluindo `ALLOWED_ORIGINS` para liberar o domínio final.
4. Garanta que o Supabase possua o bucket de storage `exports` para armazenar arquivos de exportação.

## Variáveis de ambiente

Copie o arquivo `.env.example` para `.env.local` e preencha os valores conforme o ambiente:

```bash
cp .env.example .env.local
```

Consulte o arquivo para ver todas as chaves necessárias.
