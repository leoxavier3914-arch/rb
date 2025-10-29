# RB Hub

Aplicação Next.js minimalista para sincronizar vendas da Kiwify em uma instância do Supabase e apresentá-las em um hub com as seguintes páginas principais:

- **Dashboard** (`/dashboard`): visão geral com indicadores e últimas vendas.
- **Financeiro** (`/financeiro`): consolida saldo disponível, histórico de saques e próximas liberações.
- **Vendas** (`/vendas`): tabela paginada (10 por página) com todos os registros da tabela `sales` do Supabase.
- **Pendentes** (`/pendentes`): lista vendas ainda em período de liberação, destacando próximas etapas.
- **Recusados** (`/recusados`): exibe vendas recusadas ou estornadas com motivos e status recentes.
- **Configs** (`/configs`): botão para disparar a sincronização manual via API oficial da Kiwify.

## Requisitos

- Node.js 18+
- PNPM 9+
- Conta Supabase com tabela `sales` (criada pelas migrações deste repositório)
- Credenciais OAuth da API oficial da Kiwify

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com as credenciais corretas. Opcionalmente, ajuste `KFY_PAGE_SIZE` para definir o limite de registros por página nas requisições à API, seguindo o valor sugerido no arquivo de exemplo.

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

O comando `pnpm lint` executa `next lint` e garante que o projeto siga as convenções de código.

## Sincronização de vendas

O endpoint `POST /api/sales/sync` usa as rotas documentadas em [Auth / OAuth](https://docs.kiwify.com.br/api-reference/auth/oauth) e [Sales / List](https://docs.kiwify.com.br/api-reference/sales/list) para buscar as vendas (intervalo máximo de 90 dias por requisição) e salvá-las na tabela `sales` do Supabase.

### Fluxo de saques (`/financeiro`)

A página Financeiro consome os dados sincronizados para montar a linha do tempo de liberações: exibe o saldo disponível imediato, os saques já programados e os lotes aguardando liberação. As informações são agrupadas por status de saque, facilitando a identificação de valores que podem ser solicitados e daqueles em análise.
