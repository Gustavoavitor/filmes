# Newsletter

Quando entra uma recomendação nova, quem assinou recebe um e-mail com a ficha do
filme, os ingressos de onde assistir e um link para voltar ao site e comentar.

## As peças

| Arquivo | O que faz |
|---|---|
| `email/nova-recomendacao.html` | O modelo do e-mail, com `{{PLACEHOLDERS}}`. Tabelas e estilos embutidos, para aguentar Gmail e Outlook. |
| `email/montar.mjs` | Preenche o modelo. ESM puro, sem nada do Node. |
| `email/preview.mjs` | Gera `email/preview.html` com um filme de exemplo, para conferir no navegador. |
| `supabase/functions/enviar-recomendacao/` | Lê a lista e dispara os e-mails. |
| `supabase/functions/sair/` | O link de descadastro no rodapé. |

A tabela `newsletter_inscritos` e a policy estão no fim de `supabase-schema.sql`.
Ela aceita **INSERT e nada mais**: sem policy de SELECT, a chave anônima que está
no navegador de todo mundo não consegue ler a lista de e-mails. Quem lê é a Edge
Function, com a `service_role`, no servidor.

## Ver o e-mail antes de mandar

```bash
node email/preview.mjs
```

Abre `email/preview.html` no navegador. É o mesmo caminho que a função usa, com
dados de exemplo.

## Publicar

1. Rode `supabase-schema.sql` de novo no SQL editor — ele é reexecutável, e
   agora cria a tabela da newsletter.

2. Crie uma conta num provedor de e-mail ([Resend](https://resend.com) é o que a
   função chama) e verifique um domínio remetente.

3. Guarde os segredos. **Nenhum deles entra em arquivo do repositório:**

   ```bash
   supabase secrets set RESEND_API_KEY=... REMETENTE="Cinemateca Pessoal <ola@seudominio.com>" URL_SITE=https://filmes-five-theta.vercel.app
   ```

4. Publique as duas funções. A de saída vai sem verificação de JWT, senão o
   clique no rodapé do e-mail volta 401:

   ```bash
   supabase functions deploy enviar-recomendacao
   ```

   ```bash
   supabase functions deploy sair --no-verify-jwt
   ```

## Disparar

Primeiro para você:

```bash
curl -X POST "https://SEU-PROJETO.supabase.co/functions/v1/enviar-recomendacao" -H "Authorization: Bearer SUA_SERVICE_ROLE" -H "Content-Type: application/json" -d '{"teste":"voce@exemplo.com"}'
```

Conferido, para a lista inteira:

```bash
curl -X POST "https://SEU-PROJETO.supabase.co/functions/v1/enviar-recomendacao" -H "Authorization: Bearer SUA_SERVICE_ROLE" -H "Content-Type: application/json" -d '{}'
```

Sem `recomendacaoId`, ela pega o destaque da semana mais recente. Com ele, manda
a que você indicar.

A resposta diz quantos saíram e lista as falhas:

```json
{ "filme": "The Ascent", "enviados": 12, "falhas": [] }
```

## O que ainda é manual

O disparo. A função existe e funciona, mas alguém precisa chamá-la — de
propósito, para você conferir o e-mail antes de ele sair. Se quiser automatizar
depois, dá para agendar com `pg_cron` no próprio Supabase, ou disparar por um
gatilho de `INSERT` na tabela `recomendacoes`.

## Cuidados com o modelo

- O bloco entre `<!-- INGRESSO:INICIO -->` e `<!-- INGRESSO:FIM -->` é recortado e
  repetido, um por link. Por isso o arquivo continua abrindo sozinho no
  navegador, com um ingresso de exemplo à mostra.
- Os entalhes laterais do ingresso do site são máscara CSS, que nenhum cliente de
  e-mail aplica. No e-mail o papel é um retângulo, com o canhoto separado pelo
  picote tracejado.
- A fita de lâmpadas da marquise é feita de `●` em ocre. Gradiente e
  `background-image` somem no Gmail; um caractere não some.
- A lógica de preenchimento está duplicada em `montar.mjs` (JS) e na Edge
  Function (TypeScript), porque o bundler do Deno só empacota o que está dentro
  de `supabase/functions`. Mexeu numa, mexa na outra.
