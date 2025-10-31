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

### Eventos de webhook

- **Recepção**: a Kiwify deve enviar os webhooks para `POST /api/webhooks/events`.
- **Persistência**: cada evento válido é normalizado e salvo na tabela `webhook_events` do Supabase (deduplicação pelo `event_id`).
- **Visualização**: a página `/webhooks` lista os eventos recebidos em tempo real e permite filtrar pelos gatilhos suportados (`compra_aprovada`, `carrinho_abandonado`, etc.).
- **Identificação do webhook**: quando o evento não informa o `webhook_id`, o backend tenta descobrir o identificador a partir do token. Para isso, o cache combina os tokens cadastrados em `webhook_settings` com os webhooks retornados pela API da Kiwify. Se a sincronização remota falhar, o cache preserva os dados anteriores e incorpora novos tokens locais para não perder a associação entre token e ID.

Siga o guia oficial de webhooks da Kiwify para configurar os gatilhos, cabeçalhos e exemplos de payloads: [Webhooks Kiwify (pt-br)](https://kiwify.notion.site/Webhooks-pt-br-c77eb84be10c42e6bb97cd391bca9dce).

#### Cadastro de tokens locais

1. Crie ou atualize o webhook no painel da Kiwify e copie o token informado.
2. Registre a entrada correspondente na tabela `webhook_settings` (via tela de administração ou `PATCH /api/webhooks/[id]/state`) com o `webhook_id`, URL e token atual.
3. Sempre que o token for rotacionado na Kiwify, atualize o registro local para que a detecção de `webhook_id` continue funcionando e as assinaturas HMAC possam ser validadas.

#### Testes e depuração

- Habilite o modo verbose dos logs para verificar mensagens `load_remote_webhooks_failed` ou `load_known_webhook_tokens_failed` caso a sincronização de tokens não aconteça.
- Use o endpoint `POST /api/webhooks/events` com um payload de teste da Kiwify para confirmar que o `webhook_id` é preenchido após configurar o token corretamente.

## Migrações do Supabase

As tabelas `sales`, `webhook_events` e `webhook_settings` são criadas pelas migrações em `supabase/migrations`. Para aplicá-las em um projeto local:

```bash
supabase db reset --db-url "$SUPABASE_DB_URL"
```

Ou, para aplicar incrementalmente em um banco existente:

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

> Substitua `SUPABASE_DB_URL` pela string de conexão da instância. Consulte a [documentação do Supabase CLI](https://supabase.com/docs/guides/cli) para outras opções de execução.

### Fluxo de saques (`/financeiro`)

A página Financeiro consome os dados sincronizados para montar a linha do tempo de liberações: exibe o saldo disponível imediato, os saques já programados e os lotes aguardando liberação. As informações são agrupadas por status de saque, facilitando a identificação de valores que podem ser solicitados e daqueles em análise.

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/leoxavier3914-arch/rb?utm_source=oss&utm_medium=github&utm_campaign=leoxavier3914-arch%2Frb&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
