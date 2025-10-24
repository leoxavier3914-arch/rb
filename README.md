# Kiwify Dashboard

Painel completo construído com Next.js 15 (App Router) e Tiposcript para acompanhar produtos, vendas, clientes e matrículas da Kiwify. O backend local sincroniza os dados para uma instância Supabase, expõe rotas internas tipadas e oferece uma UX pronta para operação diária.

## Requisitos

- Node.js 18+
- Instância Supabase com Postgres 15
- Credenciais da API oficial da Kiwify com fluxo `client_credentials`

## Variáveis de ambiente

Crie um arquivo `.env.local` (ou configure diretamente no ambiente) com os valores abaixo. Todos são validados em runtime com Zod:

```bash
SUPABASE_URL="https://<sua-instancia>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role>"
KIWIFY_CLIENT_ID="<client-id>"
KIWIFY_CLIENT_SECRET="<client-secret>"
KIWIFY_ACCOUNT_ID="<account-id>"
KIWIFY_WEBHOOK_SECRET="<secret-usado-no-webhook>"
NEXT_PUBLIC_APP_TIMEZONE="America/Sao_Paulo"
# Opcional para mutações de produtos diretamente pela API
NEXT_PUBLIC_KIWIFY_ALLOW_PRODUCT_MUTATIONS="false"
```

Defina também `NEXT_PUBLIC_APP_URL` quando publicar para que os fetches server-side usem domínio absoluto.

## Estrutura

```
app/
  (dashboard)/              # Shell da aplicação e páginas principais
  api/kfy/                  # Rotas internas tipadas (auth, sync, vendas, etc.)
  api/webhooks/kiwify/      # Reexporta o webhook original (inalterado)
components/                 # UI compartilhada (tabelas, filtros, charts)
lib/                        # Cliente Kiwify, Supabase, formatações, auth helpers
schema/                     # Migrações SQL (tabelas, views, políticas)
types/                      # Schemas Zod e typescript das entidades
scripts/                    # utilitários (seed, migrate, sync)
tests/                      # Vitest + Playwright
```

## Migrações

Execute todas as migrações em `schema/` na ordem numérica:

```bash
npm run db:migrate
```

O script percorre os arquivos SQL sequencialmente utilizando o client service-role (é necessário habilitar a função `pg_execute_sql` na instância Supabase). As tabelas criadas contemplam produtos, clientes, pedidos, reembolsos, matrículas, cupons e eventos crus da Kiwify, além das views `kfy_kpi_overview` e `kfy_status_counts`.

## Sincronização com a Kiwify

- `npm run sync:full` realiza uma sincronização completa (ordens, produtos, clientes, reembolsos, matrículas, cupons).
- `npm run sync:range -- --from=2024-01-01 --to=2024-01-31` executa uma janela incremental.
- Dentro do painel `/config` há botões para executar ambos os fluxos on-demand.

A rota `/api/kfy/sync` aplica upserts idempotentes, persiste o payload bruto em `kfy_events` e respeita backoff exponencial em respostas `429/5xx` da API oficial.
O script CLI usa `SYNC_BASE_URL` (padrão `http://localhost:3000`) para enviar o POST para o servidor em execução.

## Desenvolvimento

```bash
npm install
npm run dev
```

### Scripts úteis

- `npm run test` – Vitest (unitários e integração)
- `npm run test:e2e` – Playwright (smoke, exige servidor em execução)
- `npm run seed` – Cadastra dados de demonstração no Supabase

## Páginas principais

- **/dashboard** – Filtros persistentes (localStorage + search params), cards de KPI (bruto, líquido, comissão), contadores de status e gráficos (linha, barras, pizza).
- **/vendas** – Tabela com TanStack Table + scroll infinito, CSV respeitando filtros, busca por cliente/pedido, filtros de status/método/produto.
- **/reembolsos** – Lista paginada com motivo, status e dados relacionados ao pedido.
- **/produtos** – Cards com foto, preço, status, volume de vendas; botões de CRUD desabilitados por padrão (a API ainda não expõe mutação pública).
- **/clientes** – Tabela com pedidos, total gasto, última compra e filtro “Clientes ativos”.
- **/alunas** – Matriculas por curso com detalhe `/alunas/[id]` exibindo histórico de compras/matrículas.
- **/relatorios** – Builder combinando dimensões e métricas com exportação CSV.
- **/config** – Validação de envs, acionamento manual de sync e log dos últimos eventos sincronizados.

## Testes

- Unitários cobrem o client Kiwify (`lib/kfyClient.ts`) e o fluxo de sincronização.
- Playwright possui smoke suite (dashboard) e especificação de Vendas (marcada como `skip` aguardando ambiente com dados reais).

Execute tudo com:

```bash
npm test
npm run test:e2e
```

## Webhook

O arquivo `app/api/kiwify/webhook/route.ts` permanece intacto. A nova rota `/api/webhooks/kiwify/route.ts` apenas reexporta o manipulador existente para compatibilidade com o novo layout de rotas.

## Notas

- Todas as rotas internas exigem header `x-admin-role: true` e validam origem opcional (`ALLOWED_ORIGINS`).
- O cliente Kiwify (`lib/kfyClient.ts`) implementa cache in-memory do token, backoff exponencial, paginação por cursor e normalização de status/método.
- Os filtros usam timezone `America/Sao_Paulo` para converter datas (inclusão automática de 23:59:59 no limite superior).
- Para habilitar mutações de produto diretamente via API oficial, defina `NEXT_PUBLIC_KIWIFY_ALLOW_PRODUCT_MUTATIONS=true` e revise a documentação da Kiwify antes de liberar em produção.
