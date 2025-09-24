# rb-kiwify-hub

Hub interno para monitorar carrinhos abandonados da Kiwify e reenviar lembretes com desconto usando Supabase + EmailJS.

## Variáveis de ambiente
Configure as seguintes chaves antes de rodar o projeto:

### Supabase
- `SUPABASE_SERVICE_ROLE_KEY` (privada)
- `SUPABASE_URL` (privada — opcional; caso não defina, as rotas server usam o fallback `NEXT_PUBLIC_SUPABASE_URL`)
- `NEXT_PUBLIC_SUPABASE_URL` (pública — obrigatória para o client e agora fallback do server)

### EmailJS
- `EMAILJS_SERVICE_ID` (ou `NEXT_PUBLIC_EMAILJS_SERVICE_ID`)
- `EMAILJS_TEMPLATE_ID` (ou `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`)
- `EMAILJS_PUBLIC_KEY` (ou `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`)
- `EMAILJS_PRIVATE_KEY` (mantida apenas no server)

### Outras variáveis
- `KIWIFY_WEBHOOK_TOKEN`
- `ADMIN_TOKEN`
- `DEFAULT_DISCOUNT_CODE`
- `DEFAULT_DELAY_HOURS` (em horas, usado para agendar o envio automático via cron; padrão 24h)
- `DEFAULT_EXPIRE_HOURS` (em horas, usado para calcular `expires_at` e preencher o texto "24h" do template)

Use um arquivo `.env.local` para valores de desenvolvimento.

## Rotas principais
- `POST /api/kiwify/webhook`: recebe eventos da Kiwify e registra o carrinho no Supabase.
- `POST /api/admin/resend`: reenviar o e-mail manualmente (necessita cookie `admin_token` válido ou header `Authorization: Bearer ADMIN_TOKEN`).

## Login administrativo
Acesse `/login` e informe o valor configurado em `ADMIN_TOKEN` para destravar o painel protegido por cookie.

## Testes manuais
1. Ajuste `DEFAULT_DELAY_HOURS` no `.env` (ex.: `DEFAULT_DELAY_HOURS=2`) e mantenha `DEFAULT_EXPIRE_HOURS=24` para o texto do template.
2. Execute `POST /api/admin/test` informando um e-mail de teste e confirme no Supabase que o registro foi criado com `schedule_at ≈ agora + DEFAULT_DELAY_HOURS`.
3. Aguarde o tempo configurado (ou ajuste manualmente o `schedule_at` para o passado) e chame `POST /api/admin/cron/dispatch`; o registro deve ser enviado apenas após o novo atraso.
4. Valide no log/preview do EmailJS que o template continua exibindo "24 h" graças a `DEFAULT_EXPIRE_HOURS` enquanto o cron respeita o atraso configurado.
5. Verifique na interface que registros com `source = 'kiwify.webhook_purchase'` (compras que já nasceram pagas) ficam ocultos, enquanto os carrinhos abandonados via webhook — inclusive com `source = 'kiwify.webhook'` — permanecem listados no Hub.

## Backfill de registros antigos
Para sincronizar compras aprovadas antigas (anteriores ao patch do webhook), execute o script de backfill apontando para o mesmo projeto Supabase usado em produção:

```bash
SUPABASE_URL="https://<sua-instancia>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<chave-service-role>" \
node scripts/backfill_converted_status.mjs
```

O script percorre todos os registros marcados como pagos/convertidos e replica o status para duplicidades do mesmo e-mail + produto, garantindo consistência nas tabelas existentes.

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `node scripts/backfill_checkout_ids.mjs` — reprocessa registros antigos aplicando o mesmo algoritmo de `checkout_id` determinístico (e-mail + código de checkout/produto) usado pelo webhook na tabela `abandoned_emails`

### Backfill dos `checkout_id`

O script `scripts/backfill_checkout_ids.mjs` ajuda a atualizar registros existentes para usar o mesmo algoritmo de `checkout_id` determinístico aplicado pelo webhook:

1. Exporte as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (ou equivalentes) para que o script consiga autenticar com a role de serviço.
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

