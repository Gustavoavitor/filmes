// ============================================================
// CINEMATECA PESSOAL — Supabase Client
// ============================================================

let _supabase = null;
let _supabaseAdmin = null;

function getSupabase(useAdmin = false) {
  if (useAdmin) return getSupabaseAdmin();
  if (_supabase) return _supabase;
  _supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  return _supabase;
}

// Cliente com a service_role key — ignora RLS. Use APENAS no admin.html.
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  _supabaseAdmin = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.adminKey);
  return _supabaseAdmin;
}

// ── Filmes ───────────────────────────────────────────────────
async function fetchFilmes({ formato, genero, busca, ordenar } = {}) {
  let q = getSupabase().from('filmes').select('*');
  if (formato) q = q.eq('formato', formato);
  if (genero)  q = q.ilike('generos', `%${genero}%`);
  if (busca)   q = q.or(`titulo.ilike.%${busca}%,titulo_original.ilike.%${busca}%,diretor.ilike.%${busca}%`);
  switch (ordenar) {
    case 'nota_desc': q = q.order('minha_nota', { ascending: false }); break;
    case 'nota_asc':  q = q.order('minha_nota', { ascending: true  }); break;
    case 'ano_desc':  q = q.order('ano',         { ascending: false }); break;
    case 'ano_asc':   q = q.order('ano',         { ascending: true  }); break;
    default:          q = q.order('created_at',   { ascending: false });
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

async function fetchFilme(id) {
  const { data, error } = await getSupabase()
    .from('filmes').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function fetchDestaques() {
  const { data, error } = await getSupabase()
    .from('filmes').select('*').eq('destaque', true).limit(8);
  if (error) throw error;
  return data || [];
}

// ── Comentários ──────────────────────────────────────────────
async function fetchComentarios(filmeId) {
  const { data, error } = await getSupabase()
    .from('comentarios')
    .select('*')
    .eq('filme_id', filmeId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function inserirComentario({ filmeId, nome, nota, comentario }) {
  const { data, error } = await getSupabase()
    .from('comentarios')
    .insert([{ filme_id: filmeId, nome, nota, comentario }])
    .select().single();
  if (error) throw error;
  return data;
}

// A mesma tabela de comentários serve aos dois acervos: um comentário tem
// filme_id OU recomendacao_id preenchido, nunca os dois.
async function fetchComentariosRec(recId) {
  const { data, error } = await getSupabase()
    .from('comentarios')
    .select('*')
    .eq('recomendacao_id', recId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function inserirComentarioRec({ recId, nome, nota, comentario }) {
  const { data, error } = await getSupabase()
    .from('comentarios')
    .insert([{ recomendacao_id: recId, nome, nota, comentario }])
    .select().single();
  if (error) throw error;
  return data;
}

// ── Recomendações ─────────────────────────────────────────────
async function fetchRecomendacoes() {
  const { data, error } = await getSupabase()
    .from('recomendacoes')
    .select('*')
    .order('semana', { ascending: false })
    .order('destaque', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchRecomendacoesDaSemana() {
  const segunda = getSegundaFeira();
  const { data, error } = await getSupabase()
    .from('recomendacoes')
    .select('*')
    .eq('semana', segunda)
    .order('destaque', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Admin: CRUD completo ──────────────────────────────────────
async function adminListFilmes() {
  const { data, error } = await getSupabaseAdmin()
    .from('filmes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function adminInsertFilme(payload) {
  const { data, error } = await getSupabaseAdmin()
    .from('filmes').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

async function adminUpdateFilme(id, payload) {
  const { data, error } = await getSupabaseAdmin()
    .from('filmes').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function adminDeleteFilme(id) {
  const { error } = await getSupabaseAdmin().from('filmes').delete().eq('id', id);
  if (error) throw error;
}

async function adminListRecs() {
  const { data, error } = await getSupabaseAdmin()
    .from('recomendacoes').select('*')
    .order('semana', { ascending: false })
    .order('destaque', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function adminInsertRec(payload) {
  const { data, error } = await getSupabaseAdmin()
    .from('recomendacoes').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

async function adminUpdateRec(id, payload) {
  const { data, error } = await getSupabaseAdmin()
    .from('recomendacoes').update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function adminDeleteRec(id) {
  const { error } = await getSupabaseAdmin().from('recomendacoes').delete().eq('id', id);
  if (error) throw error;
}

// Conta comentários por filme, para a coluna da tabela do admin.
async function adminContarComentarios() {
  const { data, error } = await getSupabaseAdmin().from('comentarios').select('filme_id');
  if (error) throw error;
  const contagem = {};
  (data || []).forEach(c => { contagem[c.filme_id] = (contagem[c.filme_id] || 0) + 1; });
  return contagem;
}

// ── Utilitários ───────────────────────────────────────────────
function getSegundaFeira(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dom
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });
}

// As credenciais públicas ainda são as de exemplo do config.js?
// Sem esse teste, cada requisição fica pendurada no DNS até dar timeout.
function configIncompleta() {
  const { url, anonKey } = SUPABASE_CONFIG;
  return !url || !anonKey ||
         url.includes('SEU_PROJETO') ||
         anonKey.includes('SUA_CHAVE');
}

// A service_role key vem de js/config.local.js, que fica fora do
// repositório. Em produção ela não existe e o admin não deve abrir.
function semChaveAdmin() {
  const k = SUPABASE_CONFIG.adminKey;
  return !k || k.includes('SUA_SERVICE_ROLE_KEY');
}

// O painel só existe rodando localmente, então o link some em produção
// para não virar um 404 na navegação.
function ehAmbienteLocal() {
  return ['localhost', '127.0.0.1', '::1', ''].includes(window.location.hostname);
}

document.addEventListener('DOMContentLoaded', () => {
  const item = document.getElementById('nav-admin');
  if (!item) return;
  // O CSS esconde o item por padrão; rodando local ele reaparece.
  if (ehAmbienteLocal()) item.style.display = 'block';
  else item.remove();
});

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^&\n?#]+)/);
  return m ? m[1] : (url.length === 11 ? url : null);
}

// ── Modelos 3D ────────────────────────────────────────────────
// Ficam aqui, e não no viewer3d.js, porque o admin precisa do slug
// sem carregar o three.js inteiro junto.
function tituloParaSlug(titulo) {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove acentos
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function getGlbUrl(slug) {
  return `assets/modelos3d/${slug}.glb`;
}

/**
 * Descobre se existe um GLB para este filme.
 * Um HEAD antes do load evita que o GLTFLoader registre um 404 no console
 * para cada filme da colecao que ainda nao tem modelo.
 * @returns {Promise<string|null>} a URL do GLB, ou null se nao houver
 */
async function acharGlb(titulo) {
  if (!titulo) return null;
  const url = getGlbUrl(tituloParaSlug(titulo));
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    return resp.ok ? url : null;
  } catch {
    return null;   // offline, file:// ou servidor sem suporte a HEAD
  }
}

function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
