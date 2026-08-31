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

Em **Project Settings → API** você encontra três valores. Copie-os para
[`js/config.js`](js/config.js):

| Campo no Supabase        | Campo no `config.js` |
| ------------------------ | -------------------- |
| Project URL              | `url`                |
| `anon` `public`          | `anonKey`            |
| `service_role` `secret`  | `adminKey`           |

Aproveite para trocar a `ADMIN_PASSWORD`, que é a senha do painel.

> **Atenção — a `service_role` key fica exposta.**
> Ela é servida dentro do `js/config.js` junto com o resto do site, então
> qualquer visitante consegue lê-la pelo DevTools do navegador. Essa chave
> ignora todas as políticas de RLS: quem a tiver pode ler, alterar e apagar
> qualquer dado do banco.
>
> Enquanto o site rodar só na sua máquina, isso não é um problema. **Antes de
> publicar em qualquer lugar** (Vercel, GitHub Pages, Netlify), troque este
> esquema por Supabase Auth + políticas RLS de escrita para usuários
> autenticados — assim nenhuma chave secreta precisa ir para o cliente.

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
  config.js             Credenciais do Supabase e senha do admin
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

## Pendências conhecidas

Nenhuma pendência técnica aberta. O que falta é operacional:

- **Criar o projeto no Supabase e preencher o `js/config.js`** — até lá as quatro
  páginas mostram um aviso pedindo a configuração, em vez de tentar buscar dados.
- **Trocar a `service_role` key por Supabase Auth + RLS** antes de publicar o site
  em qualquer lugar. Veja o aviso na seção de configuração.
