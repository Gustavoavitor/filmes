// ============================================================
// CINEMATECA PESSOAL — Configuração local (modelo)
// ============================================================
// COMO USAR:
//   1. Copie este arquivo para js/config.local.js
//   2. Preencha os dois valores abaixo
//
// js/config.local.js está no .gitignore e NUNCA deve ser commitado
// nem publicado. A service_role key ignora todas as políticas de RLS:
// quem tiver ela consegue ler, alterar e apagar qualquer dado do banco.
//
// AVISO: hoje este arquivo não resolve nada. O Supabase bloqueia o uso de
// chaves secretas dentro do navegador, então o painel de administração não
// abre nem publicado nem rodando local. Cadastre pelo Table Editor do
// Supabase, ou migre o admin para Supabase Auth + RLS. Veja o README.
// ============================================================

// Project Settings > API > "service_role" "secret"
SUPABASE_CONFIG.adminKey = 'SUA_SERVICE_ROLE_KEY_AQUI';

// Senha do portão do painel. Como o arquivo é local, ela não vaza —
// mas ainda assim escolha algo que você não use em outro lugar.
ADMIN_PASSWORD = 'escolha-uma-senha';
