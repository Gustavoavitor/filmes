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
| `admin.html`        | Painel CRUD de filmes e recomendações                     | pronta |

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
Copie o modelo e preencha:

```bash
cp js/config.local.example.js js/config.local.js
```

Ele carrega a `service_role` key e a senha do painel. Só o `admin.html` lê esse
arquivo.

> **Por que separar.** A `service_role` key ignora todas as políticas de RLS:
> quem a tiver pode ler, alterar e apagar qualquer dado do banco. Se ela
> estivesse no `config.js`, qualquer visitante do site publicado poderia lê-la
> abrindo `/js/config.js` no navegador.
>
> Com a divisão, o site publicado funciona por inteiro — coleção, ficha dos
> filmes, recomendações e comentários — e o painel de administração existe
> apenas quando você roda o projeto localmente. Em produção ele mostra um aviso
> e o link "Admin" some da navegação.

### 4. Rodar localmente

Qualquer servidor estático serve. Abrir os arquivos direto pelo `file://`
**não** funciona — o navegador bloqueia as requisições.

```bash
npx --yes serve --listen 4173 .
```

Depois acesse <http://localhost:4173>. O painel fica em `/admin.html`.

## Estrutura

```
index.html              Home
filme.html              Ficha do filme
recomendacoes.html      Recomendações semanais
admin.html              Painel de administração
css/main.css            Todo o estilo do site
js/
  config.js             URL + anon key (versionado, público)
  config.local.js       service_role key + senha do admin (NÃO versionado)
  config.local.example.js  Modelo do arquivo acima
  supabase-client.js    Acesso ao banco + helpers compartilhados
  app.js                Home: billboard, grid, filtros, paginação
  filme.js              Ficha do filme: abas, trailer, comentários
  recomendacoes.js      Recomendações semanais
  admin.js              Painel de administração
  rating.js             Widget de estrelas (0,5 a 5,0)
  viewer3d.js           Visualizador 3D (módulo ES, importa o three.js)
assets/modelos3d/       Arquivos .glb das embalagens
supabase-schema.sql     Schema do banco
```

Toda página carrega `config.js`, `supabase-client.js` e o seu próprio script.
Só a `filme.html` carrega o `viewer3d.js`, e como módulo ES — o three.js entra
por um import map, porque `GLTFLoader`, `DRACOLoader` e `OrbitControls` saíram
do bundle global na versão r148 e hoje só existem em `examples/jsm`.

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

Nenhuma pendência técnica aberta. O que falta é operacional:

- **Criar o projeto no Supabase e preencher os dois arquivos de config** — até lá
  as páginas mostram um aviso pedindo a configuração, em vez de tentar buscar
  dados.
- **Se um dia quiser administrar a coleção pelo site publicado**, aí sim vale
  migrar para Supabase Auth com políticas RLS de escrita para usuários
  autenticados. Enquanto o painel rodar só local, não é necessário.
