// ============================================================
// CINEMATECA PESSOAL — Supabase Configuration
// ============================================================
// INSTRUÇÕES:
// 1. Acesse https://supabase.com e crie uma conta gratuita
// 2. Crie um novo projeto
// 3. Vá em Project Settings > API
// 4. Copie o "Project URL" e a "anon public" key abaixo
// 5. Para o Admin Panel, você precisará também da "service_role" key
//    (mas mantenha ela APENAS no admin.html, nunca exponha publicamente)
// ============================================================

const SUPABASE_CONFIG = {
  url:       'https://SEU_PROJETO.supabase.co',   // ← Substitua aqui
  anonKey:   'SUA_CHAVE_ANONIMA_AQUI',             // ← Substitua aqui
  adminKey:  'SUA_SERVICE_ROLE_KEY_AQUI',           // ← Apenas para admin
};

// Senha do painel de administração (simples, para uso pessoal)
const ADMIN_PASSWORD = 'cinemateca2024'; // ← Mude para uma senha sua

// Configurações gerais do site
const SITE_CONFIG = {
  name:         'Cinemateca Pessoal',
  tagline:      'Uma coleção de mídias físicas',
  itemsPerPage: 24,
  autoAdvanceBillboard: 5000,  // ms entre slides do billboard
};
