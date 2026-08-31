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
// Só o admin.html carrega este arquivo. Em produção ele não existe,
// então o painel de administração fica indisponível — de propósito.
// Para administrar a coleção, rode o site na sua máquina.
// ============================================================

// Project Settings > API > "service_role" "secret"
SUPABASE_CONFIG.adminKey = 'SUA_SERVICE_ROLE_KEY_AQUI';

// Senha do portão do painel. Como o arquivo é local, ela não vaza —
// mas ainda assim escolha algo que você não use em outro lugar.
ADMIN_PASSWORD = 'escolha-uma-senha';
