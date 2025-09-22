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

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
