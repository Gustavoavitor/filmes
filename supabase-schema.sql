-- ============================================================
-- CINEMATECA PESSOAL — Supabase Schema
-- Execute este SQL no seu painel do Supabase (SQL Editor)
-- ============================================================

-- Tabela principal de filmes da coleção
CREATE TABLE IF NOT EXISTS filmes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo        TEXT NOT NULL,
  titulo_original TEXT,
  ano           INTEGER,
  diretor       TEXT,
  elenco        TEXT,           -- separado por vírgulas
  sinopse       TEXT,
  generos       TEXT,           -- separado por vírgulas
  formato       TEXT CHECK (formato IN ('bluray', 'dvd')),
  edicao        TEXT,           -- ex: "Edição de Colecionador"
  pais          TEXT,
  duracao       INTEGER,        -- em minutos
  classificacao TEXT,           -- ex: "14 anos", "L", etc.
  capa_url      TEXT,           -- URL da capa (frente)
  capa_traseira_url TEXT,       -- URL da capa traseira (opcional)
  cor_spine     TEXT DEFAULT '#1a1a1a', -- cor da lombada no modelo 3D
  trailer_url   TEXT,           -- URL ou ID do YouTube
  minha_nota    DECIMAL(2,1) CHECK (minha_nota >= 0.5 AND minha_nota <= 5),
  destaque      BOOLEAN DEFAULT FALSE,  -- exibir no billboard
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de comentários da comunidade
CREATE TABLE IF NOT EXISTS comentarios (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filme_id  UUID REFERENCES filmes(id) ON DELETE CASCADE,
  nome      TEXT NOT NULL,
  nota      DECIMAL(2,1) CHECK (nota >= 0.5 AND nota <= 5),
  comentario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de recomendações semanais
CREATE TABLE IF NOT EXISTS recomendacoes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo          TEXT NOT NULL,
  titulo_original TEXT,
  ano             INTEGER,
  diretor         TEXT,
  sinopse         TEXT,
  generos         TEXT,
  pais            TEXT,
  trailer_url     TEXT,
  drive_url       TEXT,         -- link do Google Drive
  capa_url        TEXT,
  semana          DATE,         -- segunda-feira da semana
  destaque        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Políticas de Segurança (Row Level Security)
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE filmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE recomendacoes ENABLE ROW LEVEL SECURITY;

-- Leitura pública para todos
CREATE POLICY "filmes_leitura_publica" ON filmes FOR SELECT USING (true);
CREATE POLICY "comentarios_leitura_publica" ON comentarios FOR SELECT USING (true);
CREATE POLICY "recomendacoes_leitura_publica" ON recomendacoes FOR SELECT USING (true);

-- Inserção pública apenas para comentários (visitantes podem comentar)
CREATE POLICY "comentarios_insercao_publica" ON comentarios FOR INSERT WITH CHECK (true);

-- Para filmes e recomendações: apenas via chave service_role (admin panel)
-- O admin usa a SERVICE KEY, não a ANON KEY
-- Configure isso no seu js/config.js

-- ============================================================
-- Dados de exemplo para começar
-- ============================================================

INSERT INTO filmes (titulo, titulo_original, ano, diretor, elenco, sinopse, generos, formato, pais, duracao, classificacao, minha_nota, destaque, cor_spine)
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
);

INSERT INTO recomendacoes (titulo, titulo_original, ano, diretor, sinopse, generos, pais, semana, destaque)
VALUES (
  'A Viagem de Chihiro',
  '千と千尋の神隠し',
  2001,
  'Hayao Miyazaki',
  'Uma garota de 10 anos se vê presa em um mundo mágico habitado por deuses e espíritos, onde seus pais foram transformados em porcos. Para salvá-los, ela precisa trabalhar em uma casa de banhos sobrenatural.',
  'Animação, Fantasia, Aventura',
  'Japão',
  DATE_TRUNC('week', CURRENT_DATE),
  TRUE
);
