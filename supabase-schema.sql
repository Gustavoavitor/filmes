-- ============================================================
-- CINEMATECA PESSOAL — Refresh Script (Rerunnable)
-- ============================================================
-- Pode ser executado quantas vezes quiser: tudo é idempotente.

-- Needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS filmes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  titulo_original TEXT,
  ano INTEGER,
  diretor TEXT,
  elenco TEXT,
  sinopse TEXT,
  generos TEXT,
  formato TEXT CHECK (formato IN ('bluray', 'dvd')),
  edicao TEXT,
  pais TEXT,
  duracao INTEGER,
  classificacao TEXT,
  capa_url TEXT,
  capa_traseira_url TEXT,
  cor_spine TEXT DEFAULT '#1a1a1a',
  trailer_url TEXT,
  minha_nota DECIMAL(2,1) CHECK (minha_nota >= 0.5 AND minha_nota <= 5),
  destaque BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comentarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filme_id UUID REFERENCES filmes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  nota DECIMAL(2,1) CHECK (nota >= 0.5 AND nota <= 5),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recomendacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  titulo_original TEXT,
  ano INTEGER,
  diretor TEXT,
  sinopse TEXT,
  generos TEXT,
  pais TEXT,
  trailer_url TEXT,
  drive_url TEXT,
  capa_url TEXT,
  semana DATE,
  destaque BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Colunas novas (migrações)
-- ============================================================
-- Ficam aqui, antes de tudo, para os INSERTs lá embaixo já poderem usá-las.

-- Tema das estrelas por filme: 'veludo', 'videodrome' ou NULL (dourado padrão)
ALTER TABLE filmes        ADD COLUMN IF NOT EXISTS tema_estrelas TEXT;
ALTER TABLE recomendacoes ADD COLUMN IF NOT EXISTS tema_estrelas TEXT;

-- Ficha mais completa nas recomendações
ALTER TABLE recomendacoes ADD COLUMN IF NOT EXISTS duracao INTEGER;
ALTER TABLE recomendacoes ADD COLUMN IF NOT EXISTS elenco  TEXT;

-- Vários lugares para assistir o mesmo filme. Cada item vira um "ingresso"
-- na ficha. Formato:
--   [{"plataforma": "YouTube", "url": "https://…", "obs": "legendado"}]
ALTER TABLE recomendacoes
  ADD COLUMN IF NOT EXISTS onde_assistir JSONB DEFAULT '[]'::jsonb;

-- A mesma tabela de comentários serve aos dois acervos.
ALTER TABLE comentarios
  ADD COLUMN IF NOT EXISTS recomendacao_id UUID REFERENCES recomendacoes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comentarios_recomendacao_idx
  ON comentarios (recomendacao_id);

-- Um comentário pertence a um filme OU a uma recomendação, nunca aos dois
-- nem a nenhum.
ALTER TABLE comentarios DROP CONSTRAINT IF EXISTS comentarios_alvo_unico;
ALTER TABLE comentarios ADD CONSTRAINT comentarios_alvo_unico CHECK (
  (filme_id IS NOT NULL AND recomendacao_id IS NULL) OR
  (filme_id IS NULL AND recomendacao_id IS NOT NULL)
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE filmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE recomendacoes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies (drop + recreate => safe refresh)
-- ============================================================

DROP POLICY IF EXISTS "filmes_leitura_publica" ON filmes;
DROP POLICY IF EXISTS "comentarios_leitura_publica" ON comentarios;
DROP POLICY IF EXISTS "recomendacoes_leitura_publica" ON recomendacoes;
DROP POLICY IF EXISTS "comentarios_insercao_publica" ON comentarios;

CREATE POLICY "filmes_leitura_publica"
  ON filmes
  FOR SELECT
  USING (true);

CREATE POLICY "comentarios_leitura_publica"
  ON comentarios
  FOR SELECT
  USING (true);

CREATE POLICY "comentarios_insercao_publica"
  ON comentarios
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "recomendacoes_leitura_publica"
  ON recomendacoes
  FOR SELECT
  USING (true);

-- ============================================================
-- Dedupe existing data BEFORE creating UNIQUE indexes
-- ============================================================

DELETE FROM filmes f
USING filmes f2
WHERE f.titulo = f2.titulo
  AND f.ano = f2.ano
  AND f.id <> f2.id
  AND (
    f.created_at < f2.created_at
    OR (f.created_at = f2.created_at AND f.id < f2.id)
  );

DELETE FROM recomendacoes r
USING recomendacoes r2
WHERE r.titulo = r2.titulo
  AND r.semana = r2.semana
  AND r.id <> r2.id
  AND (
    r.created_at < r2.created_at
    OR (r.created_at = r2.created_at AND r.id < r2.id)
  );

-- ============================================================
-- Unique indexes (now safe)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS filmes_titulo_ano_uniq
ON filmes (titulo, ano);

CREATE UNIQUE INDEX IF NOT EXISTS recomendacoes_titulo_semana_uniq
ON recomendacoes (titulo, semana);

-- ============================================================
-- COLEÇÃO — mídias físicas
-- ============================================================

INSERT INTO filmes (
  titulo, titulo_original, ano, diretor, elenco, sinopse, generos,
  formato, pais, duracao, classificacao, minha_nota, destaque, cor_spine
)
VALUES (
  'Stalker',
  'Сталкер',
  1979,
  'Andrei Tarkovsky',
  'Alexander Kaidanovsky, Anatoly Solonitsyn, Nikolai Grinko',
  'Um guia misterioso lidera dois homens — um escritor e um professor — através de uma zona proibida em busca de um quarto que, segundo a lenda, realiza os mais profundos desejos de quem o alcança.',
  'Drama, Ficção Científica, Filosófico',
  'bluray',
  'União Soviética',
  163,
  '12 anos',
  5.0,
  TRUE,
  '#2c3e50'
)
ON CONFLICT (titulo, ano) DO UPDATE SET
  titulo_original = EXCLUDED.titulo_original,
  diretor = EXCLUDED.diretor,
  elenco = EXCLUDED.elenco,
  sinopse = EXCLUDED.sinopse,
  generos = EXCLUDED.generos,
  formato = EXCLUDED.formato,
  pais = EXCLUDED.pais,
  duracao = EXCLUDED.duracao,
  classificacao = EXCLUDED.classificacao,
  minha_nota = EXCLUDED.minha_nota,
  destaque = EXCLUDED.destaque,
  cor_spine = EXCLUDED.cor_spine;

INSERT INTO filmes (
  titulo, titulo_original, ano, diretor, elenco, sinopse, generos,
  formato, edicao, pais, duracao, classificacao,
  capa_url, capa_traseira_url, cor_spine, trailer_url, minha_nota, destaque,
  tema_estrelas
)
VALUES (
  'Veludo Azul',
  'Blue Velvet',
  1986,
  'David Lynch',
  'Kyle MacLachlan, Isabella Rossellini, Dennis Hopper, Laura Dern',
  'Ao encontrar uma orelha decepada num terreno baldio, um estudante é puxado para o submundo violento da cidade pacata onde cresceu.',
  'Mistério, Suspense, Drama',
  'bluray',
  'Edição de Colecionador',
  'Estados Unidos',
  120,
  '18 anos',
  'https://rnpgknzettixrizaevft.supabase.co/storage/v1/object/public/capas/veludoazul_poster.jpg',
  NULL,
  '#1c3f94',
  'https://www.youtube.com/watch?v=00Mq6N5AsjE',
  5.0,
  TRUE,
  'veludo'
)
ON CONFLICT (titulo, ano) DO UPDATE SET
  titulo_original = EXCLUDED.titulo_original,
  diretor = EXCLUDED.diretor,
  elenco = EXCLUDED.elenco,
  sinopse = EXCLUDED.sinopse,
  generos = EXCLUDED.generos,
  formato = EXCLUDED.formato,
  edicao = EXCLUDED.edicao,
  pais = EXCLUDED.pais,
  duracao = EXCLUDED.duracao,
  classificacao = EXCLUDED.classificacao,
  capa_url = EXCLUDED.capa_url,
  capa_traseira_url = EXCLUDED.capa_traseira_url,
  cor_spine = EXCLUDED.cor_spine,
  trailer_url = EXCLUDED.trailer_url,
  minha_nota = EXCLUDED.minha_nota,
  destaque = EXCLUDED.destaque,
  tema_estrelas = EXCLUDED.tema_estrelas;

INSERT INTO filmes (
  titulo, titulo_original, ano, diretor, elenco, sinopse, generos,
  formato, edicao, pais, duracao, classificacao,
  capa_url, capa_traseira_url, cor_spine, trailer_url, minha_nota, destaque,
  tema_estrelas
)
VALUES (
  'Videodrome',
  'Videodrome',
  1983,
  'David Cronenberg',
  'James Woods, Debbie Harry, Sonja Smits',
  'O diretor de uma emissora de TV a cabo capta um sinal pirata de tortura real e começa a ter alucinações que dissolvem a fronteira entre carne e imagem.',
  'Terror, Ficção Científica',
  'bluray',
  'Edição de Colecionador',
  'Canadá',
  87,
  '18 anos',
  'https://rnpgknzettixrizaevft.supabase.co/storage/v1/object/public/capas/videodrome_poster.jpg',
  NULL,
  '#8b1a1a',
  'https://www.youtube.com/watch?v=v8BUXKcp8zE',
  5.0,
  TRUE,
  'videodrome'
)
ON CONFLICT (titulo, ano) DO UPDATE SET
  titulo_original = EXCLUDED.titulo_original,
  diretor = EXCLUDED.diretor,
  elenco = EXCLUDED.elenco,
  sinopse = EXCLUDED.sinopse,
  generos = EXCLUDED.generos,
  formato = EXCLUDED.formato,
  edicao = EXCLUDED.edicao,
  pais = EXCLUDED.pais,
  duracao = EXCLUDED.duracao,
  classificacao = EXCLUDED.classificacao,
  capa_url = EXCLUDED.capa_url,
  capa_traseira_url = EXCLUDED.capa_traseira_url,
  cor_spine = EXCLUDED.cor_spine,
  trailer_url = EXCLUDED.trailer_url,
  minha_nota = EXCLUDED.minha_nota,
  destaque = EXCLUDED.destaque,
  tema_estrelas = EXCLUDED.tema_estrelas;

-- ============================================================
-- RECOMENDAÇÕES — a semana
-- ============================================================
-- A Viagem de Chihiro saiu da programação. O DELETE fica aqui em vez de o
-- INSERT dela ser só removido: assim, se a linha ainda existir de uma
-- execução anterior, ela some.
DELETE FROM recomendacoes WHERE titulo = 'A Viagem de Chihiro';

-- ── The Ascent (1977) ───────────────────────────────────────
INSERT INTO recomendacoes (
  titulo, titulo_original, ano, diretor, elenco, sinopse, generos, pais,
  duracao, capa_url, onde_assistir, semana, destaque
)
VALUES (
  'The Ascent',
  'Voskhozhdenie',
  1977,
  'Larisa Shepitko',
  'Boris Plotnikov, Vladimir Gostyukhin, Sergey Yakovlev, Anatoliy Solonitsyn',
  'Dois partisans soviéticos saem numa missão de busca por comida e enfrentam o frio do inverno, os ocupantes alemães e, acima de tudo, a própria consciência. Capturados, cada um encara a possibilidade da morte de um jeito, e o que era uma missão de sobrevivência vira uma prova moral sem saída.',
  'Drama, Guerra, Drama Psicológico',
  'União Soviética',
  111,
  'https://rnpgknzettixrizaevft.supabase.co/storage/v1/object/public/capas/theascent_poster.jpg',
  '[
    {"plataforma": "YouTube", "url": "https://www.youtube.com/watch?v=v21lQ449T3Y", "obs": "filme completo"}
  ]'::jsonb,
  DATE_TRUNC('week', CURRENT_DATE)::date,
  TRUE
)
ON CONFLICT (titulo, semana) DO UPDATE SET
  titulo_original = EXCLUDED.titulo_original,
  ano = EXCLUDED.ano,
  diretor = EXCLUDED.diretor,
  elenco = EXCLUDED.elenco,
  sinopse = EXCLUDED.sinopse,
  generos = EXCLUDED.generos,
  pais = EXCLUDED.pais,
  duracao = EXCLUDED.duracao,
  capa_url = EXCLUDED.capa_url,
  onde_assistir = EXCLUDED.onde_assistir,
  destaque = EXCLUDED.destaque;

-- ── Round About Midnight (1999) ─────────────────────────────
INSERT INTO recomendacoes (
  titulo, titulo_original, ano, diretor, elenco, sinopse, generos, pais,
  duracao, capa_url, onde_assistir, semana, destaque
)
VALUES (
  'Round About Midnight',
  'Mayonaka made',
  1999,
  'Makoto Wada',
  'Hiroyuki Sanada, Michelle Reis, Akira Emoto, Toshiaki Karasawa',
  'Koji, um músico de jazz, testemunha um assassinato. Fugindo dos matadores e da polícia, encontra Linda, e os dois correm contra o relógio para chegar ao clube antes da meia-noite e limpar seus nomes.',
  'Drama, Suspense',
  'Japão',
  110,
  'https://rnpgknzettixrizaevft.supabase.co/storage/v1/object/public/capas/roundaboutmidnight_poster.jpg',
  '[
    {"plataforma": "Google Drive", "url": "https://drive.google.com/drive/folders/1Z_cOxnGa3N1M23rNuBd7xnU8Thr-zOpF?usp=drive_link", "obs": "pasta com o filme"}
  ]'::jsonb,
  DATE_TRUNC('week', CURRENT_DATE)::date,
  FALSE
)
ON CONFLICT (titulo, semana) DO UPDATE SET
  titulo_original = EXCLUDED.titulo_original,
  ano = EXCLUDED.ano,
  diretor = EXCLUDED.diretor,
  elenco = EXCLUDED.elenco,
  sinopse = EXCLUDED.sinopse,
  generos = EXCLUDED.generos,
  pais = EXCLUDED.pais,
  duracao = EXCLUDED.duracao,
  capa_url = EXCLUDED.capa_url,
  onde_assistir = EXCLUDED.onde_assistir,
  destaque = EXCLUDED.destaque;

-- ============================================================
-- Conferência
-- ============================================================
-- SELECT titulo, ano, diretor, pais, duracao, destaque,
--        jsonb_array_length(onde_assistir) AS links
-- FROM recomendacoes ORDER BY destaque DESC, titulo;

-- ============================================================
-- NEWSLETTER — quem quer receber a próxima recomendação
-- ============================================================
CREATE TABLE IF NOT EXISTS newsletter_inscritos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT NOT NULL,
  nome       TEXT,
  ativo      BOOLEAN DEFAULT TRUE,
  -- O link de saída no rodapé do e-mail carrega este token, para
  -- ninguém precisar de senha só para se descadastrar.
  token      UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Um e-mail, uma inscrição — independente de maiúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_email_uniq
  ON newsletter_inscritos (lower(email));

ALTER TABLE newsletter_inscritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_insercao_publica" ON newsletter_inscritos;

-- Só INSERT é público. Não existe policy de SELECT de propósito: a
-- chave anônima está no navegador de todo mundo, e uma lista de
-- e-mails legível seria uma lista de e-mails colhível. Quem envia é
-- a Edge Function, com a service_role, no servidor.
CREATE POLICY "newsletter_insercao_publica"
  ON newsletter_inscritos
  FOR INSERT
  WITH CHECK (
    email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  );

-- ============================================================
-- Conferência (rode como service_role, no SQL editor)
-- ============================================================
-- SELECT count(*) FILTER (WHERE ativo) AS ativos, count(*) AS total
-- FROM newsletter_inscritos;
