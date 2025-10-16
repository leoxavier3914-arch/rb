# Kiwify Sales Hub

Novo painel minimalista para acompanhar em tempo real as operações da loja digital na Kiwify.

## Funcionalidades
- Painel dark mode com navegação entre **Vendas aprovadas** e **Carrinhos abandonados**.
- Coleta de webhooks da Kiwify com persistência completa do payload em Supabase.
- Deduplicação automática via `event_reference` para evitar registros duplicados.
- Estatísticas instantâneas de volume e valores recentes.

## Variáveis de ambiente
Reutilize as mesmas variáveis já configuradas no Vercel:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
KIWIFY_WEBHOOK_TOKEN=
```

`SUPABASE_URL` aceita fallback de `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` aceita fallback de `SUPABASE_SERVICE_ROLE`.

## Desenvolvimento

```bash
npm install
npm run dev
```

O painel principal está em `/approved-sales` e `/abandoned-carts`. A rota de webhook aceita `POST /api/kiwify/webhook` com um dos headers abaixo:

- `Authorization: Bearer ${KIWIFY_WEBHOOK_TOKEN}`
- `Authorization: Token token=${KIWIFY_WEBHOOK_TOKEN}` (ou variações de espaçamento/maiúsculas, com ou sem aspas)

## Migrações

- `20241001000000_reset_schema.sql`: remove todas as tabelas e sequências públicas para reiniciar o banco.
- `20241001010000_create_core_tables.sql`: cria as novas tabelas `approved_sales` e `abandoned_carts` com colunas prontas para receber os dados dos webhooks.

Execute as migrações com a CLI do Supabase ou com a pipeline já existente no projeto.
