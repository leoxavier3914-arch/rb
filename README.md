# rb-kiwify-hub

Hub interno para monitorar carrinhos abandonados da Kiwify e reenviar lembretes com desconto usando Supabase + EmailJS.

## Variáveis de ambiente
Configure as seguintes chaves antes de rodar o projeto:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAILJS_SERVICE_ID` (ou `NEXT_PUBLIC_EMAILJS_SERVICE_ID`)
- `EMAILJS_TEMPLATE_ID` (ou `NEXT_PUBLIC_EMAILJS_TEMPLATE_ID`)
- `EMAILJS_PUBLIC_KEY` (ou `NEXT_PUBLIC_EMAILJS_PUBLIC_KEY`)
- `KIWIFY_WEBHOOK_TOKEN`
- `ADMIN_TOKEN`
- `DEFAULT_DISCOUNT_CODE`
- `DEFAULT_EXPIRE_HOURS`

Use um arquivo `.env.local` para valores de desenvolvimento.

## Rotas principais
- `POST /api/kiwify/webhook`: recebe eventos da Kiwify e registra o carrinho no Supabase.
- `POST /api/admin/resend`: reenviar o e-mail manualmente (necessita cookie `admin_token` válido ou header `Authorization: Bearer ADMIN_TOKEN`).

## Login administrativo
Acesse `/login` e informe o valor configurado em `ADMIN_TOKEN` para destravar o painel protegido por cookie.

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
