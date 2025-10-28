# RB Hub

Aplicação Next.js minimalista para sincronizar vendas da Kiwify em uma instância do Supabase e apresentá-las em um hub com três páginas principais:

- **Dashboard**: visão geral com indicadores e últimas vendas.
- **Vendas**: tabela paginada (10 por página) com todos os registros da tabela `sales` do Supabase.
- **Configs**: botão para disparar a sincronização manual via API oficial da Kiwify.

## Requisitos

- Node.js 18+
- PNPM 9+
- Conta Supabase com tabela `sales` (criada pelas migrações deste repositório)
- Credenciais OAuth da API oficial da Kiwify

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com as credenciais corretas.

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

O comando `pnpm lint` executa `next lint` e garante que o projeto siga as convenções de código.

## Sincronização de vendas

O endpoint `POST /api/sales/sync` usa as rotas documentadas em [Auth / OAuth](https://docs.kiwify.com.br/api-reference/auth/oauth) e [Sales / List](https://docs.kiwify.com.br/api-reference/sales/list) para buscar as vendas (intervalo máximo de 90 dias por requisição) e salvá-las na tabela `sales` do Supabase.
