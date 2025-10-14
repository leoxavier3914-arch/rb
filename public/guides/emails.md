# Guia de envios de e-mail

Este documento descreve as regras utilizadas pela automação de feedback por e-mail do Kiwify Hub.

## Fluxos automáticos
- Disparo inicial 30 minutos após o pagamento aprovado.
- Reenvio automático após 48 horas caso não haja resposta.
- Cancelamento automático do fluxo quando o cliente responde ou marca spam.

## Fluxos manuais
- Disponíveis diretamente no dashboard da área de Integrações.
- Permitem personalizar o assunto e anexar arquivos antes do envio.
- Cada envio manual registra histórico e responsável pela ação.

## Boas práticas
- Utilize remetentes autenticados com SPF, DKIM e DMARC.
- Mantenha o template com textos curtos e chamadas claras.
- Atualize periodicamente a base de supressão de e-mails inválidos.

Para dúvidas adicionais contate o suporte Kiwify.
