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

O projeto já tem `supabase/config.toml` (criado com `supabase init`) e a
verificação de JWT de cada função declarada nele — a `sair` vai aberta, a
`enviar-recomendacao` fechada. Não precisa passar `--no-verify-jwt` na mão.

1. Rode `supabase-schema.sql` no SQL editor. Ele é reexecutável e cria a tabela
   da newsletter.

2. Entre e ligue o projeto:

   ```bash
   npx supabase login
   ```

   ```bash
   npx supabase link --project-ref rnpgknzettixrizaevft
   ```

3. Guarde os segredos num arquivo, **não na linha de comando** — o shell grava
   histórico. Crie `supabase/.env.local` (já é ignorado pelo git):

   ```
   RESEND_API_KEY=re_sua_chave
   REMETENTE=Cinemateca Pessoal <ola@seudominio.com>
   URL_SITE=https://cinematecapessoal.vercel.app
   ```

   E envie:

   ```bash
   npx supabase secrets set --env-file supabase/.env.local
   ```

   `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` não entram aí: a Supabase
   injeta as duas sozinha, e nomes começando com `SUPABASE_` são reservados.

4. Publique. O `--use-api` monta o pacote no servidor e dispensa o Docker:

   ```bash
   npx supabase functions deploy enviar-recomendacao sair --use-api
   ```

   Nunca use `--prune` aqui: ele apaga do projeto qualquer função que não
   exista nesta pasta.

## Disparar

Primeiro para você:

```bash
curl -X POST "https://rnpgknzettixrizaevft.supabase.co/functions/v1/enviar-recomendacao" -H "Authorization: Bearer SUA_SERVICE_ROLE" -H "Content-Type: application/json" -d '{"teste":"voce@exemplo.com"}'
```

Conferido, para a lista inteira:

```bash
curl -X POST "https://rnpgknzettixrizaevft.supabase.co/functions/v1/enviar-recomendacao" -H "Authorization: Bearer SUA_SERVICE_ROLE" -H "Content-Type: application/json" -d '{}'
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

## Conferir se a lista está mesmo protegida

A tabela tem policy só de INSERT. Sem policy de SELECT, a RLS filtra tudo e o
PostgREST devolve `200 []` — conjunto vazio, não erro. Isso significa que uma
resposta vazia **não prova nada** enquanto a lista está vazia: parece igual à
lista protegida e à lista sem ninguém.

O jeito de ter certeza é olhar as policies direto, no SQL editor:

```sql
select relrowsecurity as rls_ligada from pg_class where relname = 'newsletter_inscritos';
```

```sql
select policyname, cmd, roles from pg_policies where tablename = 'newsletter_inscritos';
```

Tem que aparecer `rls_ligada = true` e exatamente uma policy, `INSERT`. Se
aparecer qualquer policy de `SELECT`, a lista de e-mails está legível para
quem tiver a chave anônima — que está no JavaScript do site, à vista de todos.

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
