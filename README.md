# Kiwify Sales Hub

Novo painel minimalista para acompanhar em tempo real as operações da loja digital na Kiwify.

## Funcionalidades
- Painel dark mode com navegação entre **Vendas aprovadas**, **Carrinhos abandonados** e os novos módulos de insights.
- Coleta de webhooks da Kiwify com persistência completa do payload em Supabase.
- Deduplicação automática via `event_reference` para evitar registros duplicados.
- Estatísticas instantâneas de volume e valores recentes.
- **Estatísticas históricas oficiais** usando a API da Kiwify para liberar faturamento consolidado e linha do tempo completa.
- **Catálogo de produtos enriquecido** com status, tags e ticket médio direto da API.
- **Gestão de assinaturas e área do aluno** em uma única tela.
- **Dashboard de marketing e Pixel** cruzando UTMs dos webhooks com os eventos rastreados pela Kiwify.

## Variáveis de ambiente
Reutilize as mesmas variáveis já configuradas no Vercel:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
KIWIFY_WEBHOOK_SECRET=
KIWIFY_API_TOKEN=
KIWIFY_API_ACCOUNT_ID=
# opcional, default: https://public-api.kiwify.com/
KIWIFY_API_BASE_URL=
```

`SUPABASE_URL` aceita fallback de `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` aceita fallback de `SUPABASE_SERVICE_ROLE`.

`KIWIFY_WEBHOOK_SECRET` deve ser o mesmo token exibido no painel da Kiwify na criação do webhook e será utilizado para validar a assinatura `HMAC-SHA1` enviada em cada requisição.

## Desenvolvimento

```bash
npm install
npm run dev
```

O painel principal agora inclui `/analytics`, `/products`, `/subscriptions`, `/marketing`, além de `/approved-sales` e `/abandoned-carts`. A rota de webhook implementa exatamente o fluxo descrito na documentação oficial da Kiwify:

- `HEAD /api/kiwify/webhook` responde `200` para testes de conectividade do painel.
- `POST /api/kiwify/webhook` exige o parâmetro `signature` na query-string, calculado com `HMAC-SHA1(JSON.stringify(body), KIWIFY_WEBHOOK_SECRET)`.

Se a assinatura não estiver presente ou não corresponder ao corpo recebido, a rota retorna `400`. Com a assinatura válida, o payload é normalizado e armazenado nas tabelas específicas (`approved_sales`, `pending_payments`, `rejected_payments`, `refunded_sales`, `abandoned_carts` e `subscription_events`).

## Migrações

- `20241001000000_reset_schema.sql`: remove todas as tabelas e sequências públicas para reiniciar o banco.
- `20241001010000_create_core_tables.sql`: cria as novas tabelas `approved_sales` e `abandoned_carts` com colunas prontas para receber os dados dos webhooks.
- `20241001020000_create_additional_payment_tables.sql`: adiciona as tabelas `pending_payments`, `rejected_payments` e `refunded_sales`.
- `20241001030000_create_subscription_events_table.sql`: cria a tabela `subscription_events` para armazenar eventos de assinatura (`subscription_canceled`, `subscription_late`, `subscription_renewed`).

Execute as migrações com a CLI do Supabase ou com a pipeline já existente no projeto.
