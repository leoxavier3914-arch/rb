# Kiwify Sales Hub

Painel em Next.js para acompanhar em tempo real as operações de uma loja digital na Kiwify. O projeto foi pensado para rodar no Vercel, usando Supabase como camada de persistência e as novas rotas App Router para receber os webhooks da plataforma.

## Visão geral
- Interface dark mode com navegação entre **Vendas aprovadas**, **Pagamentos pendentes/recusados**, **Reembolsos** e **Carrinhos abandonados**.
- Ingestão de webhooks oficiais da Kiwify com deduplicação via `event_reference` e armazenamento do payload completo para auditoria.
- Estatísticas instantâneas (volume, valores, comissões) e filtros por período ou busca textual diretamente na dashboard.
- Normalização de datas e valores para fuso horário de São Paulo e padronização de payloads heterogêneos.
- Hub completo para consumir a API oficial da Kiwify diretamente no painel (produtos, vendas, financeiro, afiliados, participantes e webhooks), com formulários prontos para criação/edição de catálogo.

## Arquitetura do projeto
```
app/                    # Rotas públicas e privadas (App Router)
  api/kiwify/webhook    # Endpoint de ingestão de webhooks
components/             # Componentes compartilhados da UI
lib/                    # Utilitários (Supabase, normalização de eventos, helpers de formato)
supabase/migrations/    # Migrações SQL versionadas para o banco
```

O cliente Supabase é inicializado em `lib/supabase.ts` com `fetch` forçando `no-store` para evitar respostas em cache. Os normalizadores que convertem os webhooks crus para o formato interno ficam em `lib/kiwify.ts` e são compartilhados entre a API e os testes.

## Requisitos
- Node.js 18 ou 20
- npm 9+
- Instância Supabase configurada com as migrações do diretório `supabase/migrations`

## Configuração
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie suas credenciais para um arquivo `.env.local` (ou defina as variáveis no ambiente):
-  ```bash
  SUPABASE_URL="https://<sua-instancia>.supabase.co"
  SUPABASE_SERVICE_ROLE_KEY="<chave-service-role>"
  NEXT_PUBLIC_SUPABASE_URL="https://<sua-instancia>.supabase.co"
  KIWIFY_WEBHOOK_SECRET="<token exibido na Kiwify>"

  # Credenciais da API oficial
  KIWIFY_API_BASE_URL="https://api.kiwify.com.br"
  KIWIFY_API_CLIENT_ID="<client_id gerado no painel da Kiwify>"
  KIWIFY_API_CLIENT_SECRET="<client_secret gerado no painel da Kiwify>"
  KIWIFY_API_SCOPE="<escopo opcional fornecido pela Kiwify>"
  KIWIFY_API_AUDIENCE="<audience opcional, quando aplicável>"
  KIWIFY_API_PATH_PREFIX="/v1"
  KIWIFY_PARTNER_ID="<id do parceiro/afiliado opcional>"
  ```
  `SUPABASE_URL` aceita fallback de `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` aceita fallback de `SUPABASE_SERVICE_ROLE`, permitindo usar as mesmas variáveis do ambiente de produção.
3. Rode as migrações no Supabase (via CLI `supabase db push` ou pipeline CI/CD).

## Desenvolvimento
```bash
npm run dev
```
O painel principal concentra-se na rota `/webhooks`, que agrupa as subseções `/webhooks/approved-sales`, `/webhooks/pending-payments`, `/webhooks/rejected-payments`, `/webhooks/refunded-sales` e `/webhooks/abandoned-carts`.

## API oficial da Kiwify
- A navegação inclui uma nova seção **API** com subpáginas para Autenticação, Conta, Produtos, Vendas, Financeiro, Afiliados, Webhooks e Participantes.
- O fluxo de autenticação realiza o grant `client_credentials` usando `KIWIFY_API_CLIENT_ID` e `KIWIFY_API_CLIENT_SECRET`, exibindo validade e preview do token.
- O prefixo configurável (`KIWIFY_API_PATH_PREFIX`, padrão `/v1`) é aplicado automaticamente em todas as chamadas; informe `"/"` para desativá-lo e apontar para caminhos sem versão.
- Os formulários de Produtos permitem criar (`POST {prefix}/products`) e atualizar (`PATCH {prefix}/products/:id`) itens enviando o JSON esperado pela documentação, onde `{prefix}` corresponde ao valor efetivo de `KIWIFY_API_PATH_PREFIX`.
- Listagens de vendas, finanças, afiliados, webhooks e participantes usam a mesma estrutura de filtros (`page`, `per_page`, `status`, etc.) adotada pela API da Kiwify.
- Todos os painéis expõem o payload bruto via `JsonPreview`, facilitando auditoria e comparações com os dados persistidos via webhooks.

### Testes
```bash
npm test
```
Os testes cobrem normalização de payloads, leitura de variáveis de ambiente e o fluxo completo do webhook.

## Webhooks da Kiwify
- `HEAD /api/kiwify/webhook` responde `200` para o health-check usado pela Kiwify.
- `POST /api/kiwify/webhook` exige a query `signature` calculada com `HMAC-SHA1(JSON.stringify(body), KIWIFY_WEBHOOK_SECRET)`.
- A assinatura é validada com `timingSafeEqual`; qualquer divergência retorna `400`.
- Com a assinatura válida, o payload é normalizado e persistido na tabela correspondente (`approved_sales`, `pending_payments`, `rejected_payments`, `refunded_sales`, `abandoned_carts` ou `subscription_events`).

## Migrações principais
| Arquivo | Descrição |
| --- | --- |
| `20241001000000_reset_schema.sql` | Zera completamente o schema público para facilitar reimportações. |
| `20241001010000_create_core_tables.sql` | Cria `approved_sales` e `abandoned_carts` com os campos essenciais. |
| `20241001020000_create_additional_payment_tables.sql` | Adiciona `pending_payments`, `rejected_payments` e `refunded_sales`. |
| `20241001030000_create_subscription_events_table.sql` | Define a tabela de eventos de assinatura e índices auxiliares. |
| `20241001040000_add_amount_breakdown.sql` | Inclui colunas de valores brutos, líquidos e comissões em todas as tabelas. |
| `20241001050000_add_sale_customer_metadata.sql` | Adiciona metadados do cliente/UTM e backfill a partir dos payloads. |
| `20241001060000_backfill_sale_customer_metadata_extensions.sql` | Atualiza registros antigos com campos de metadados consolidados. |

Execute-as na ordem listada para obter o schema mais recente.

## Dicas de produção
- Configure um endpoint público no Vercel apenas para `/api/kiwify/webhook` e mantenha o restante da aplicação protegido por autenticação.
- Utilize logs do Supabase para monitorar deduplicação via `event_reference` e eventuais falhas de inserção.
- Considere criar políticas RLS (Row Level Security) específicas para consumo do painel caso seja exposto a terceiros.

