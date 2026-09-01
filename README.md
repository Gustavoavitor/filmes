# Cinemateca Pessoal

Catálogo digital de uma coleção pessoal de filmes em Blu-ray e DVD, com resenhas,
recomendações semanais e visualização 3D das embalagens.

Site estático (HTML + CSS + JS puro), com Supabase como banco de dados.

## Páginas

| Arquivo             | O que é                                                  | Estado |
| ------------------- | -------------------------------------------------------- | ------ |
| `index.html`        | Home: billboard de destaques, grid da coleção, filtros    | pronta |
| `filme.html`        | Ficha do filme, visualizador 3D, comentários              | pronta |
| `recomendacoes.html`| Recomendações semanais, navegação por semana, trailer     | pronta |
| `admin.html`        | Painel CRUD de filmes e recomendações                     | **fora de uso** |

## Configuração inicial

### 1. Criar o projeto no Supabase

1. Crie uma conta em <https://supabase.com> (o plano gratuito basta).
2. **New project** → escolha um nome, uma senha para o banco e a região
   mais próxima (`South America (São Paulo)`).
3. Espere alguns minutos até o projeto terminar de provisionar.

### 2. Criar as tabelas

No painel do projeto, vá em **SQL Editor** → **New query**, cole todo o conteúdo
de [`supabase-schema.sql`](supabase-schema.sql) e clique em **Run**.

Isso cria as três tabelas (`filmes`, `comentarios`, `recomendacoes`), liga o
Row Level Security e insere dois registros de exemplo.

### 3. Preencher as credenciais

As credenciais ficam em dois arquivos, e a divisão é proposital: um vai para o
repositório e o outro nunca sai da sua máquina.

**`js/config.js`** — versionado e servido publicamente. Em
**Project Settings → API**, copie:

| Campo no Supabase | Campo no `config.js` |
| ----------------- | -------------------- |
| Project URL       | `url`                |
| `anon` `public`   | `anonKey`            |

A `anon` key é feita para ficar exposta no navegador — ela respeita as políticas
de Row Level Security do [`supabase-schema.sql`](supabase-schema.sql), que
permitem leitura pública e inserção apenas em comentários.

**`js/config.local.js`** — fora do repositório, listado no `.gitignore`.
Guardaria a `service_role` key e a senha do painel de administração.

> **Hoje esse arquivo não serve para nada.** O Supabase bloqueia o uso de
> chaves secretas dentro do navegador (`Forbidden use of secret API key in
> browser`), então o painel não abre nem publicado nem rodando local.
> Veja **Cadastrando filmes**, logo abaixo.

> **Por que separar.** A `service_role` key ignora todas as políticas de RLS:
> quem a tiver pode ler, alterar e apagar qualquer dado do banco. Se ela
> estivesse no `config.js`, qualquer visitante do site publicado poderia lê-la
> abrindo `/js/config.js` no navegador.
>
> Com a divisão, o site publicado funciona por inteiro — coleção, ficha dos
> filmes, recomendações e comentários — e o painel de administração existe
> apenas quando você roda o projeto localmente. Em produção ele mostra um aviso
> e o link "Admin" some da navegação.

### Cadastrando filmes

Enquanto o painel estiver fora de uso, cadastre pelo **Table Editor** do
próprio Supabase. Algumas colunas exigem cuidado:

| Coluna       | Cuidado |
| ------------ | ------- |
| `formato`    | Só aceita `bluray` ou `dvd`, minúsculo — há um CHECK no banco |
| `generos`    | Separados por vírgula (`Drama, Ficção Científica`) — é o que monta o filtro da home |
| `minha_nota` | Entre `0.5` e `5`, com meio ponto (`4.5`) |
| `destaque`   | `true` coloca o filme no billboard da página inicial |
| `capa_url`   | URL de uma imagem já hospedada em algum lugar |
| `cor_spine`  | Hex da lombada no 3D, ex. `#2c3e50` |

Só `titulo` é obrigatório; o resto o site trata como opcional e some da tela
quando está vazio.

### 4. Rodar localmente

Qualquer servidor estático serve. Abrir os arquivos direto pelo `file://`
**não** funciona — o navegador bloqueia as requisições.

```bash
npx --yes serve --listen 4173 .
```

Depois acesse <http://localhost:4173>. O painel fica em `/admin.html`.

O [`serve.json`](serve.json) existe por causa de um detalhe: por padrão o
`serve` redireciona `/filme.html?id=X` para `/filme` e **descarta a query
string**, o que faria todo clique num filme voltar para a coleção. A Vercel
não faz isso. O arquivo desliga esse comportamento para que o ambiente local
se comporte como a produção.

## Estrutura

```
index.html              Coleção + a ficha do filme, que abre por cima dela
filme.html              Só redireciona para index.html?film=<id> (links antigos)
recomendacoes.html      Recomendações semanais + assinatura da newsletter
admin.html              Painel de administração
css/main.css            Todo o estilo do site
js/
  config.js             URL + anon key (versionado, público)
  config.local.js       service_role key + senha do admin (NÃO versionado)
  config.local.example.js  Modelo do arquivo acima
  supabase-client.js    Acesso ao banco + helpers compartilhados
  app.js                Coleção: billboard, grade, filtros, paginação
  ficha.js              Ficha do filme: sobreposição, scan 3D, comentários
  recomendacoes.js      Recomendações semanais + assinatura
  admin.js              Painel de administração
  barra.js              Esconde a barra de navegação ao descer a página
  rating.js             Widget de estrelas (0,5 a 5,0)
  viewer3d.js           Visualizador 3D (módulo ES, importa o three.js)
  caixa3d.js            Embalagem 3D compartilhada (grade + fallback da ficha)
  capa3d.js             Capas 3D nos cards da coleção
  projecao.js           Transição de projeção 35mm ao abrir um filme
email/                  Newsletter: modelo do e-mail, gerador e preview
supabase/functions/     Edge Functions: enviar-recomendacao e sair
assets/modelos3d/       Arquivos .glb das embalagens
serve.json              Config do servidor local (ver acima)
supabase-schema.sql     Schema do banco
```

Toda página carrega `config.js`, `supabase-client.js` e o seu próprio script.
Só a `index.html` carrega o `viewer3d.js`, e como módulo ES — o three.js entra
por um import map, porque `GLTFLoader`, `DRACOLoader` e `OrbitControls` saíram
do bundle global na versão r148 e hoje só existem em `examples/jsm`.

A newsletter tem instruções próprias em [email/README.md](email/README.md):
como ver o e-mail antes de mandar, o que publicar no Supabase e como disparar.

## Modelos 3D

A aba **Vista 3D** da página do filme procura, sob demanda, um arquivo em
`assets/modelos3d/<slug-do-título>.glb`. Se existir, carrega o modelo real
(com suporte a compressão Draco); se não existir, monta uma caixa de Blu-ray/DVD
usando a capa como textura e a `cor_spine` na lombada.

O slug é o título em minúsculas, sem acentos, com espaços virando hífens.
O painel de administração mostra o nome exato esperado no campo
**Arquivo 3D (GLB)** enquanto você digita o título — basta nomear o arquivo igual.

| Título                        | Arquivo esperado                 |
| ----------------------------- | -------------------------------- |
| Stalker                       | `stalker.glb`                    |
| O Poderoso Chefão             | `o-poderoso-chefao.glb`          |
| 2001: Uma Odisseia no Espaço  | `2001-uma-odisseia-no-espaco.glb`|

Veja [`assets/modelos3d/README.md`](assets/modelos3d/README.md) para detalhes
de exportação.

## Deploy na Vercel

O site é estático, sem etapa de build. Na Vercel, **Add New → Project →
Import** o repositório do GitHub e use:

| Campo            | Valor   |
| ---------------- | ------- |
| Framework Preset | `Other` |
| Build Command    | (vazio) |
| Output Directory | (vazio) |

Depois disso o vínculo é automático: todo push na `main` vira um deploy de
produção, e cada branch ou pull request ganha uma URL de preview própria.

O `js/config.local.js` não é commitado, então não chega à Vercel — é assim que
a `service_role` key fica fora do ar. Não adicione a chave como variável de
ambiente na Vercel: este é um site estático, sem servidor, e qualquer valor
injetado no cliente seria igualmente público.

## Pendências conhecidas

- **O painel de administração não funciona.** Ele escreve no banco usando a
  `service_role` key direto do navegador, e o Supabase passou a bloquear isso
  nas chaves do formato novo (`sb_secret_…`). A mesma chave responde 200 fora
  do navegador, então é um bloqueio deliberado deles, não um bug do projeto.

  Para reativá-lo: criar um usuário no Supabase Auth, trocar o portão de senha
  por um login de verdade e adicionar políticas de RLS de escrita para
  `authenticated`. Aí o painel volta a funcionar — e passa a funcionar também
  no site publicado, sem nenhuma chave secreta no cliente.

  Enquanto isso, o cadastro é feito pelo Table Editor do Supabase.
