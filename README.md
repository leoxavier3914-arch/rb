# rb-kiwify-hub

Hub interno para monitorar em tempo real os eventos de checkout da Kiwify — novos registros, pagamentos aprovados, abandonos e recusas — utilizando Supabase como camada de persistência.

## Variáveis de ambiente
Configure as seguintes chaves antes de rodar o projeto:

### Supabase
- `SUPABASE_SERVICE_ROLE_KEY` (privada; em ambientes como o Vercel pode aparecer como `SUPABASE_SERVICE_ROLE`)
- `SUPABASE_URL` (privada — opcional; caso não defina, as rotas server usam o fallback `NEXT_PUBLIC_SUPABASE_URL`)
- `NEXT_PUBLIC_SUPABASE_URL` (pública — obrigatória para o client e fallback do server)

### Outras variáveis
- `KIWIFY_WEBHOOK_TOKEN`
- `ADMIN_TOKEN`
- `DEFAULT_DELAY_HOURS` (em horas, usado para calcular o `schedule_at` dos eventos; padrão 24h)
- `DEFAULT_EXPIRE_HOURS` (em horas, usado para preencher o `expires_at` dos links de checkout)

Use um arquivo `.env.local` para valores de desenvolvimento.

## Rotas principais
- `POST /api/kiwify/webhook`: recebe eventos da Kiwify e registra/atualiza os dados de carrinhos e pagamentos no Supabase.

## Login administrativo
Acesse `/login` e informe o valor configurado em `ADMIN_TOKEN` para destravar o painel protegido por cookie.

## Testes manuais
1. Ajuste `DEFAULT_DELAY_HOURS` e `DEFAULT_EXPIRE_HOURS` no `.env` conforme a estratégia de expiração desejada.
2. Faça uma requisição `POST /api/kiwify/webhook` com um payload de checkout de teste (use o header `Authorization: Bearer <KIWIFY_WEBHOOK_TOKEN>`).
3. Verifique no Supabase que o registro foi criado com o `schedule_at` correspondente ao atraso configurado e status inicial `new` ou `pending`.
4. Atualize o payload simulando um pagamento aprovado (por exemplo, enviando `paid: true` ou `status: "approved"`) e confirme que o painel passa a exibir o evento como pagamento aprovado, mantendo o histórico do cliente/produto.

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `node scripts/backfill_checkout_ids.mjs` — reprocessa registros antigos aplicando o mesmo algoritmo determinístico de `checkout_id` usado pelo webhook na tabela `abandoned_emails`

### Backfill dos `checkout_id`

O script `scripts/backfill_checkout_ids.mjs` ajuda a atualizar registros existentes para usar o mesmo algoritmo de `checkout_id` determinístico aplicado pelo webhook:

1. Exporte as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (ou `SUPABASE_SERVICE_ROLE`) para que o script consiga autenticar com a role de serviço.
2. Execute primeiro em modo _dry-run_ para conferir o impacto:

   ```bash
   node scripts/backfill_checkout_ids.mjs
   ```

   Esse modo lista os registros que receberiam o novo `checkout_id`, os grupos duplicados detectados e os itens ignorados por falta de e-mail, produto ou referência de checkout.

3. Se estiver tudo certo, aplique as alterações:

   ```bash
   node scripts/backfill_checkout_ids.mjs --apply
   ```

   Adicione `--delete-duplicates` se quiser remover automaticamente as linhas antigas com o mesmo e-mail/produto (o script preserva a melhor linha de cada grupo antes de excluir as demais).

4. Caso algum registro apareça como “skipped”, complete manualmente o `customer_email`, o identificador/título do produto ou algum código/link de checkout antes de rodar novamente.
