-- ============================================================
-- CINEMATECA PESSOAL — Recomendações: onde assistir + comentários
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- ── 1. Estrutura ────────────────────────────────────────────

-- Vários lugares para assistir o mesmo filme, cada um virando um
-- "ingresso" na ficha. Formato:
--   [{"plataforma": "Internet Archive", "url": "https://…", "obs": "legendado"}]
ALTER TABLE recomendacoes
  ADD COLUMN IF NOT EXISTS onde_assistir JSONB DEFAULT '[]'::jsonb;

-- Tema das estrelas, igual ao da coleção ('veludo', 'videodrome', NULL…)
ALTER TABLE recomendacoes
  ADD COLUMN IF NOT EXISTS tema_estrelas TEXT;

-- A mesma tabela de comentários passa a servir aos dois acervos.
-- Um comentário tem filme_id OU recomendacao_id, nunca os dois.
ALTER TABLE comentarios
  ADD COLUMN IF NOT EXISTS recomendacao_id UUID REFERENCES recomendacoes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comentarios_recomendacao_idx
  ON comentarios (recomendacao_id);

-- Impede um comentário solto ou preso aos dois de uma vez.
ALTER TABLE comentarios DROP CONSTRAINT IF EXISTS comentarios_alvo_unico;
ALTER TABLE comentarios ADD CONSTRAINT comentarios_alvo_unico CHECK (
  (filme_id IS NOT NULL AND recomendacao_id IS NULL) OR
  (filme_id IS NULL AND recomendacao_id IS NOT NULL)
);

-- ── 2. Limpa a recomendação antiga ──────────────────────────
DELETE FROM recomendacoes WHERE titulo = 'A Viagem de Chihiro';

-- ── 3. Os dois filmes da semana ─────────────────────────────
-- ATENÇÃO: troque COLE_A_URL_DO_CARTAZ_AQUI pelas URLs do Supabase
-- Storage, e preencha os links de "onde assistir".

INSERT INTO recomendacoes (
  titulo, titulo_original, ano, diretor, sinopse, generos, pais,
  capa_url, onde_assistir, semana, destaque
) VALUES
(
  'The Ascent',
  'Восхождение',
  1977,
  'Larisa Shepitko',
  'No inverno de 1942, dois partisans soviéticos deixam o grupo em busca de comida na Bielorrússia ocupada. Capturados pelos alemães, cada um encara a possibilidade da morte de um jeito, e o que era uma missão de sobrevivência vira uma prova moral sem saída.',
  'Drama, Guerra',
  'União Soviética',
  'COLE_A_URL_DO_CARTAZ_AQUI',
  '[
    {"plataforma": "Internet Archive", "url": "COLE_O_LINK_AQUI", "obs": "legendado"},
    {"plataforma": "YouTube",          "url": "COLE_O_LINK_AQUI", "obs": ""}
  ]'::jsonb,
  DATE_TRUNC('week', CURRENT_DATE)::date,
  TRUE
),
(
  'Round About Midnight',
  NULL,
  1999,
  'PREENCHA_O_DIRETOR',
  'PREENCHA A SINOPSE.',
  'PREENCHA_OS_GENEROS',
  'PREENCHA_O_PAIS',
  'COLE_A_URL_DO_CARTAZ_AQUI',
  '[
    {"plataforma": "YouTube", "url": "COLE_O_LINK_AQUI", "obs": ""}
  ]'::jsonb,
  DATE_TRUNC('week', CURRENT_DATE)::date,
  FALSE
);

-- ── 4. Conferência ──────────────────────────────────────────
-- SELECT titulo, ano, diretor, semana, destaque,
--        jsonb_array_length(onde_assistir) AS links
-- FROM recomendacoes ORDER BY destaque DESC;
