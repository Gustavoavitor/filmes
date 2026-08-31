// ============================================================
// CINEMATECA PESSOAL — Supabase Configuration
// ============================================================
// Este arquivo VAI para o repositório e é servido publicamente.
// Só coloque aqui o que pode ser lido por qualquer visitante.
//
// INSTRUÇÕES:
// 1. Acesse https://supabase.com e crie uma conta gratuita
// 2. Crie um novo projeto
// 3. Vá em Project Settings > API
// 4. Copie o "Project URL" e a "anon public" key abaixo
//
// A "anon public" key é feita para ficar exposta no navegador: ela
// respeita as políticas de Row Level Security definidas no
// supabase-schema.sql (leitura pública, e inserção só em comentários).
//
// A "service_role" key NÃO entra aqui — veja js/config.local.example.js
// ============================================================

const SUPABASE_CONFIG = {
  url:     'https://SEU_PROJETO.supabase.co',   // ← Substitua aqui
  anonKey: 'SUA_CHAVE_ANONIMA_AQUI',            // ← Substitua aqui

  // Preenchida por js/config.local.js, que fica fora do repositório.
  // Em produção continua nula, e o painel de administração não abre.
  adminKey: null,
};

// Idem: definida em js/config.local.js. Sem ela o admin não abre.
let ADMIN_PASSWORD = null;

// Configurações gerais do site
const SITE_CONFIG = {
  name:         'Cinemateca Pessoal',
  tagline:      'Uma coleção de mídias físicas',
  itemsPerPage: 24,
  autoAdvanceBillboard: 5000,  // ms entre slides do billboard
};
