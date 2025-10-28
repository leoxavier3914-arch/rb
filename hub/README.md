# Hub de Vendas Kiwify

Aplicação Next.js para visualizar estatísticas e vendas sincronizadas da Kiwify usando Supabase como fonte de dados.

## Requisitos

- Node.js 18 ou superior
- Conta Supabase com tabela `sales` provisionada pelos arquivos em `../supabase/migrations`
- Credenciais válidas da API oficial da Kiwify

## Configuração

1. Copie o arquivo `.env.example` para `.env.local` e preencha as variáveis:

   ```bash
   cp .env.example .env.local
   ```

   | Variável | Descrição |
   | --- | --- |
   | `SUPABASE_URL` | URL do projeto Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Chave service role para operações server-side |
   | `KIWIFY_CLIENT_ID` | Client ID de OAuth na Kiwify |
   | `KIWIFY_CLIENT_SECRET` | Client Secret de OAuth |
   | `KIWIFY_ACCOUNT_ID` | (Opcional) ID da conta caso utilize multi-contas |
   | `KIWIFY_API_BASE_URL` | Endpoint base da API pública da Kiwify |

2. Execute as migrações no Supabase para criar a tabela `sales` e a função `sales_stats`:

   ```bash
   supabase db push
   ```

## Desenvolvimento

Instale as dependências e inicie o servidor de desenvolvimento:

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000` para utilizar o hub.

## Fluxo de Sincronização

- A página **Configurações** possui o botão "Sincronizar vendas" que chama a API oficial da Kiwify e preenche a tabela `sales` no Supabase.
- A página **Vendas** lista os registros em uma tabela paginada de 10 itens.
- O **Dashboard** exibe cards de estatísticas calculadas pela função `sales_stats`.

Todas as páginas são atualizadas automaticamente após cada sincronização.
