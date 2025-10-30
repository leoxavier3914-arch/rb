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

A página Financeiro consulta diretamente a API oficial da Kiwify em tempo real — não utiliza os registros armazenados no Supabase — para exibir o saldo disponível, as solicitações de saque existentes e os valores ainda pendentes de liberação. As informações espelham o que a Kiwify retorna na API e refletem imediatamente novas solicitações feitas pelo formulário.

### POST `/api/finance/payouts`

- **Autenticação**: usa as credenciais OAuth configuradas em `KIWIFY_CLIENT_ID`/`KIWIFY_CLIENT_SECRET`.
- **Entrada** (`application/json`): `{ "amount": <número_em_centavos> }`.
- **Resposta 200**: `{ "ok": true, "payout": { "id": "..." } }` quando o saque foi aceito pela Kiwify.
- **Erro 400**: retornado quando `amount` está ausente ou é inválido.
- **Erro 500**: retornado quando a Kiwify rejeita a solicitação ou ocorre falha de rede (campo `error` inclui a mensagem retornada).
- **Observações**: os valores submetidos passam por validação no formulário para não exceder o saldo disponível informado pela Kiwify.

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/leoxavier3914-arch/rb?utm_source=oss&utm_medium=github&utm_campaign=leoxavier3914-arch%2Frb&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
