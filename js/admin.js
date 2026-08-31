// ============================================================
// CINEMATECA PESSOAL — admin.js (Painel de Administração)
// ============================================================
// Depende de: config.js, rating.js, supabase-client.js, viewer3d.js
// ATENÇÃO: este painel usa a service_role key exposta em config.js.
// Qualquer visitante do site consegue extraí-la pelo DevTools.
// ============================================================

const SESSION_KEY = 'cinemateca_admin_ok';

// ── Estado ────────────────────────────────────────────────────
const admin = {
  filmes: [],
  recs: [],
  comentarios: {},   // { filme_id: contagem }
  buscaFilmes: '',
  buscaRecs: '',
  notaWidget: null,
};

// ══════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════
function initGate() {
  const gate  = document.getElementById('admin-gate');
  const form  = document.getElementById('gate-form');
  const input = document.getElementById('gate-password');
  const erro  = document.getElementById('gate-error');

  // Sem js/config.local.js não há service_role key nem senha: é o estado
  // esperado em produção, já que esse arquivo não vai para o repositório.
  if (semChaveAdmin() || !ADMIN_PASSWORD) {
    form.style.display = 'none';
    erro.style.display = 'block';
    erro.style.color = 'var(--charcoal-mid)';
    erro.innerHTML = `
      <strong style="color:var(--red-cinema)">Painel indisponível aqui.</strong><br /><br />
      O administrador roda apenas na sua máquina. Copie
      <code>js/config.local.example.js</code> para <code>js/config.local.js</code>,
      preencha a service_role key e a senha, e abra o site localmente.`;
    return;
  }

  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    abrirPainel();
    return;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      abrirPainel();
    } else {
      erro.style.display = 'block';
      input.value = '';
      input.focus();
    }
  });

  function abrirPainel() {
    gate.style.display = 'none';
    document.getElementById('admin-app').style.display = 'grid';
    initPainel();
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.location.reload();
}

// ══════════════════════════════════════════════════════════════
// BOOT DO PAINEL
// ══════════════════════════════════════════════════════════════
async function initPainel() {
  bindNavegacao();
  bindFormFilme();
  bindFormRec();

  // Sem credenciais reais toda requisição ficaria pendurada no DNS.
  // Melhor avisar de uma vez do que deixar o painel girando.
  if (configIncompleta()) {
    avisarConfigIncompleta();
    document.getElementById('filmes-tabela').innerHTML = vazioBox('Configure o Supabase para ver a coleção.');
    document.getElementById('recs-tabela').innerHTML   = vazioBox('Configure o Supabase para ver as recomendações.');
    return;
  }

  await Promise.all([carregarFilmes(), carregarRecs()]);

  // Abre a seção indicada na URL (#recomendacoes)
  const hash = window.location.hash.replace('#', '');
  if (hash === 'recomendacoes') trocarView('recomendacoes');
}

function avisarConfigIncompleta() {
  const aviso = document.createElement('div');
  aviso.className = 'admin-warning';
  aviso.innerHTML = `
    <strong>Supabase ainda não configurado.</strong><br />
    Preencha <code>url</code>, <code>anonKey</code> e <code>adminKey</code> em <code>js/config.js</code>
    com os dados do seu projeto (Project Settings → API). Enquanto isso, nada é carregado nem salvo.`;
  const content = document.querySelector('.admin-content');
  content.insertBefore(aviso, content.firstChild);
}

function bindNavegacao() {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      trocarView(el.dataset.view);
    });
  });
  document.getElementById('btn-logout').addEventListener('click', (e) => { e.preventDefault(); logout(); });
  document.getElementById('btn-logout-mobile').addEventListener('click', logout);
}

function trocarView(view) {
  document.getElementById('view-filmes').style.display        = view === 'filmes' ? 'block' : 'none';
  document.getElementById('view-recomendacoes').style.display = view === 'recomendacoes' ? 'block' : 'none';

  document.querySelectorAll('[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  // Sempre volta para a listagem ao trocar de seção
  mostrarListaFilmes();
  mostrarListaRecs();
  window.location.hash = view;
}

// ══════════════════════════════════════════════════════════════
// FILMES — LISTAGEM
// ══════════════════════════════════════════════════════════════
async function carregarFilmes() {
  const alvo = document.getElementById('filmes-tabela');
  try {
    const [filmes, contagem] = await Promise.all([
      adminListFilmes(),
      adminContarComentarios().catch(() => ({})),
    ]);
    admin.filmes = filmes;
    admin.comentarios = contagem;
    renderTabelaFilmes();
  } catch (err) {
    console.error(err);
    alvo.innerHTML = erroBox(err.message);
  }
}

function renderTabelaFilmes() {
  const alvo = document.getElementById('filmes-tabela');
  const lista = filtrar(admin.filmes, admin.buscaFilmes, ['titulo', 'titulo_original', 'diretor']);

  document.getElementById('contador-filmes').textContent =
    `${lista.length} de ${admin.filmes.length}`;

  if (!lista.length) {
    alvo.innerHTML = vazioBox(admin.filmes.length ? 'Nenhum filme corresponde à busca.' : 'Nenhum filme cadastrado ainda.');
    return;
  }

  alvo.innerHTML = `
    <div style="overflow-x:auto">
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width:56px">Capa</th>
            <th>Título</th>
            <th style="width:70px">Ano</th>
            <th style="width:90px">Formato</th>
            <th style="width:70px">Nota</th>
            <th style="width:90px">Comentários</th>
            <th style="width:90px">Billboard</th>
            <th style="width:150px">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(f => `
            <tr>
              <td>${f.capa_url
                    ? `<img class="admin-thumb" src="${escapeHtml(f.capa_url)}" alt="" loading="lazy" />`
                    : `<div class="admin-thumb-empty">📽</div>`}</td>
              <td>
                <div style="font-weight:600;color:var(--charcoal)">${escapeHtml(f.titulo)}</div>
                ${f.diretor ? `<div style="font-size:0.75rem;color:var(--muted)">${escapeHtml(f.diretor)}</div>` : ''}
              </td>
              <td>${f.ano ?? '—'}</td>
              <td>${f.formato === 'bluray' ? 'Blu-ray' : (f.formato === 'dvd' ? 'DVD' : '—')}</td>
              <td>${f.minha_nota ? `★ ${Number(f.minha_nota).toFixed(1)}` : '—'}</td>
              <td>${admin.comentarios[f.id] || 0}</td>
              <td>${f.destaque ? `<span class="admin-badge">✦ Destaque</span>` : '—'}</td>
              <td>
                <div class="admin-row-actions">
                  <a class="btn-mini" href="filme.html?id=${encodeURIComponent(f.id)}" target="_blank" rel="noopener">Ver</a>
                  <button class="btn-mini" data-editar-filme="${escapeHtml(f.id)}">Editar</button>
                  <button class="btn-mini danger" data-excluir-filme="${escapeHtml(f.id)}">Excluir</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  alvo.querySelectorAll('[data-editar-filme]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormFilme(btn.dataset.editarFilme));
  });
  alvo.querySelectorAll('[data-excluir-filme]').forEach(btn => {
    btn.addEventListener('click', () => excluirFilme(btn.dataset.excluirFilme));
  });
}

// ══════════════════════════════════════════════════════════════
// FILMES — FORMULÁRIO
// ══════════════════════════════════════════════════════════════
function bindFormFilme() {
  document.getElementById('btn-novo-filme').addEventListener('click', () => abrirFormFilme(null));
  document.getElementById('filme-cancelar').addEventListener('click', mostrarListaFilmes);
  document.getElementById('filme-form').addEventListener('submit', salvarFilme);

  document.getElementById('busca-filmes').addEventListener('input', debounce((e) => {
    admin.buscaFilmes = e.target.value.trim();
    renderTabelaFilmes();
  }, 250));

  // Nome sugerido do arquivo GLB, derivado do título
  document.getElementById('f-titulo').addEventListener('input', atualizarSlugGlb);

  // Pré-visualização das capas
  bindPreview('f-capa', 'f-capa-preview');
  bindPreview('f-capa-traseira', 'f-capa-traseira-preview');

  // Widget de estrelas
  admin.notaWidget = new StarRating(document.getElementById('f-nota-container'), {
    value: 0,
    readOnly: false,
    size: 26,
    onChange: (v) => { document.getElementById('f-nota-valor').textContent = v.toFixed(1); },
  });
  document.getElementById('f-nota-limpar').addEventListener('click', () => {
    admin.notaWidget.setValue(0);
    document.getElementById('f-nota-valor').textContent = '—';
  });
}

function abrirFormFilme(id) {
  const filme = id ? admin.filmes.find(f => f.id === id) : null;

  document.getElementById('filmes-list-wrap').style.display = 'none';
  document.getElementById('filmes-form-wrap').style.display = 'block';
  document.getElementById('filme-form-title').textContent = filme ? `Editando: ${filme.titulo}` : 'Novo Filme';

  const v = (campo) => (filme && filme[campo] != null ? filme[campo] : '');

  document.getElementById('filme-id').value           = filme ? filme.id : '';
  document.getElementById('f-titulo').value           = v('titulo');
  document.getElementById('f-titulo-original').value  = v('titulo_original');
  document.getElementById('f-ano').value              = v('ano');
  document.getElementById('f-diretor').value          = v('diretor');
  document.getElementById('f-pais').value             = v('pais');
  document.getElementById('f-elenco').value           = v('elenco');
  document.getElementById('f-sinopse').value          = v('sinopse');
  document.getElementById('f-generos').value          = v('generos');
  document.getElementById('f-formato').value          = v('formato');
  document.getElementById('f-edicao').value           = v('edicao');
  document.getElementById('f-duracao').value          = v('duracao');
  document.getElementById('f-classificacao').value    = v('classificacao');
  document.getElementById('f-capa').value             = v('capa_url');
  document.getElementById('f-capa-traseira').value    = v('capa_traseira_url');
  document.getElementById('f-trailer').value          = v('trailer_url');
  document.getElementById('f-cor-spine').value        = filme && filme.cor_spine ? filme.cor_spine : '#1a1a1a';
  document.getElementById('f-destaque').checked       = !!(filme && filme.destaque);

  const nota = filme && filme.minha_nota ? Number(filme.minha_nota) : 0;
  admin.notaWidget.setValue(nota);
  document.getElementById('f-nota-valor').textContent = nota ? nota.toFixed(1) : '—';

  atualizarSlugGlb();
  atualizarPreview('f-capa', 'f-capa-preview');
  atualizarPreview('f-capa-traseira', 'f-capa-traseira-preview');

  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('f-titulo').focus();
}

function mostrarListaFilmes() {
  document.getElementById('filmes-list-wrap').style.display = 'block';
  document.getElementById('filmes-form-wrap').style.display = 'none';
}

async function salvarFilme(e) {
  e.preventDefault();

  if (configIncompleta()) { showToast('Configure o Supabase em js/config.js antes de salvar.', 'error'); return; }

  const titulo = document.getElementById('f-titulo').value.trim();
  if (!titulo) { showToast('O título é obrigatório.', 'error'); return; }

  const nota = admin.notaWidget.getValue();

  const payload = {
    titulo,
    titulo_original:   textoOuNull('f-titulo-original'),
    ano:               numeroOuNull('f-ano'),
    diretor:           textoOuNull('f-diretor'),
    elenco:            textoOuNull('f-elenco'),
    sinopse:           textoOuNull('f-sinopse'),
    generos:           textoOuNull('f-generos'),
    formato:           textoOuNull('f-formato'),
    edicao:            textoOuNull('f-edicao'),
    pais:              textoOuNull('f-pais'),
    duracao:           numeroOuNull('f-duracao'),
    classificacao:     textoOuNull('f-classificacao'),
    capa_url:          textoOuNull('f-capa'),
    capa_traseira_url: textoOuNull('f-capa-traseira'),
    cor_spine:         document.getElementById('f-cor-spine').value || '#1a1a1a',
    trailer_url:       textoOuNull('f-trailer'),
    minha_nota:        nota > 0 ? nota : null,
    destaque:          document.getElementById('f-destaque').checked,
  };

  const id  = document.getElementById('filme-id').value;
  const btn = document.getElementById('filme-salvar');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  try {
    if (id) {
      const atualizado = await adminUpdateFilme(id, payload);
      const i = admin.filmes.findIndex(f => f.id === id);
      if (i !== -1) admin.filmes[i] = atualizado;
      showToast('Filme atualizado.', 'success');
    } else {
      const novo = await adminInsertFilme(payload);
      admin.filmes.unshift(novo);
      showToast('Filme adicionado à coleção.', 'success');
    }
    renderTabelaFilmes();
    mostrarListaFilmes();
  } catch (err) {
    console.error(err);
    showToast(`Erro ao salvar: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ Salvar';
  }
}

async function excluirFilme(id) {
  const filme = admin.filmes.find(f => f.id === id);
  if (!filme) return;

  const qtd = admin.comentarios[id] || 0;
  const aviso = qtd
    ? `\n\nOs ${qtd} comentário(s) deste filme também serão apagados.`
    : '';
  if (!confirm(`Excluir "${filme.titulo}" da coleção?${aviso}\n\nEsta ação não pode ser desfeita.`)) return;

  try {
    await adminDeleteFilme(id);
    admin.filmes = admin.filmes.filter(f => f.id !== id);
    delete admin.comentarios[id];
    renderTabelaFilmes();
    showToast('Filme excluído.', 'success');
  } catch (err) {
    console.error(err);
    showToast(`Erro ao excluir: ${err.message}`, 'error');
  }
}

function atualizarSlugGlb() {
  const titulo = document.getElementById('f-titulo').value.trim();
  document.getElementById('f-glb-nome').textContent =
    titulo ? `${tituloParaSlug(titulo)}.glb` : '—';
}

// ══════════════════════════════════════════════════════════════
// RECOMENDAÇÕES — LISTAGEM
// ══════════════════════════════════════════════════════════════
async function carregarRecs() {
  const alvo = document.getElementById('recs-tabela');
  try {
    admin.recs = await adminListRecs();
    renderTabelaRecs();
  } catch (err) {
    console.error(err);
    alvo.innerHTML = erroBox(err.message);
  }
}

function renderTabelaRecs() {
  const alvo = document.getElementById('recs-tabela');
  const lista = filtrar(admin.recs, admin.buscaRecs, ['titulo', 'titulo_original', 'diretor']);

  document.getElementById('contador-recs').textContent =
    `${lista.length} de ${admin.recs.length}`;

  if (!lista.length) {
    alvo.innerHTML = vazioBox(admin.recs.length ? 'Nenhuma recomendação corresponde à busca.' : 'Nenhuma recomendação cadastrada ainda.');
    return;
  }

  alvo.innerHTML = `
    <div style="overflow-x:auto">
      <table class="admin-table">
        <thead>
          <tr>
            <th style="width:56px">Capa</th>
            <th>Título</th>
            <th style="width:70px">Ano</th>
            <th style="width:120px">País</th>
            <th style="width:120px">Semana</th>
            <th style="width:80px">Drive</th>
            <th style="width:90px">Destaque</th>
            <th style="width:130px">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${lista.map(r => `
            <tr>
              <td>${r.capa_url
                    ? `<img class="admin-thumb" src="${escapeHtml(r.capa_url)}" alt="" loading="lazy" />`
                    : `<div class="admin-thumb-empty">🌍</div>`}</td>
              <td>
                <div style="font-weight:600;color:var(--charcoal)">${escapeHtml(r.titulo)}</div>
                ${r.diretor ? `<div style="font-size:0.75rem;color:var(--muted)">${escapeHtml(r.diretor)}</div>` : ''}
              </td>
              <td>${r.ano ?? '—'}</td>
              <td>${escapeHtml(r.pais) || '—'}</td>
              <td>${r.semana ? formatarSemana(r.semana) : '—'}</td>
              <td>${r.drive_url ? '✓' : '—'}</td>
              <td>${r.destaque ? `<span class="admin-badge">✦ Destaque</span>` : '—'}</td>
              <td>
                <div class="admin-row-actions">
                  <button class="btn-mini" data-editar-rec="${escapeHtml(r.id)}">Editar</button>
                  <button class="btn-mini danger" data-excluir-rec="${escapeHtml(r.id)}">Excluir</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  alvo.querySelectorAll('[data-editar-rec]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormRec(btn.dataset.editarRec));
  });
  alvo.querySelectorAll('[data-excluir-rec]').forEach(btn => {
    btn.addEventListener('click', () => excluirRec(btn.dataset.excluirRec));
  });
}

// ══════════════════════════════════════════════════════════════
// RECOMENDAÇÕES — FORMULÁRIO
// ══════════════════════════════════════════════════════════════
function bindFormRec() {
  document.getElementById('btn-nova-rec').addEventListener('click', () => abrirFormRec(null));
  document.getElementById('rec-cancelar').addEventListener('click', mostrarListaRecs);
  document.getElementById('rec-form').addEventListener('submit', salvarRec);

  document.getElementById('busca-recs').addEventListener('input', debounce((e) => {
    admin.buscaRecs = e.target.value.trim();
    renderTabelaRecs();
  }, 250));

  document.getElementById('r-semana-atual').addEventListener('click', () => {
    document.getElementById('r-semana').value = getSegundaFeira();
  });

  bindPreview('r-capa', 'r-capa-preview');
}

function abrirFormRec(id) {
  const rec = id ? admin.recs.find(r => r.id === id) : null;

  document.getElementById('recs-list-wrap').style.display = 'none';
  document.getElementById('recs-form-wrap').style.display = 'block';
  document.getElementById('rec-form-title').textContent = rec ? `Editando: ${rec.titulo}` : 'Nova Recomendação';

  const v = (campo) => (rec && rec[campo] != null ? rec[campo] : '');

  document.getElementById('rec-id').value            = rec ? rec.id : '';
  document.getElementById('r-titulo').value          = v('titulo');
  document.getElementById('r-titulo-original').value = v('titulo_original');
  document.getElementById('r-ano').value             = v('ano');
  document.getElementById('r-diretor').value         = v('diretor');
  document.getElementById('r-pais').value            = v('pais');
  document.getElementById('r-sinopse').value         = v('sinopse');
  document.getElementById('r-generos').value         = v('generos');
  document.getElementById('r-capa').value            = v('capa_url');
  document.getElementById('r-trailer').value         = v('trailer_url');
  document.getElementById('r-drive').value           = v('drive_url');
  document.getElementById('r-semana').value          = rec && rec.semana ? rec.semana : getSegundaFeira();
  document.getElementById('r-destaque').checked      = !!(rec && rec.destaque);

  atualizarPreview('r-capa', 'r-capa-preview');

  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.getElementById('r-titulo').focus();
}

function mostrarListaRecs() {
  document.getElementById('recs-list-wrap').style.display = 'block';
  document.getElementById('recs-form-wrap').style.display = 'none';
}

async function salvarRec(e) {
  e.preventDefault();

  if (configIncompleta()) { showToast('Configure o Supabase em js/config.js antes de salvar.', 'error'); return; }

  const titulo = document.getElementById('r-titulo').value.trim();
  if (!titulo) { showToast('O título é obrigatório.', 'error'); return; }

  const payload = {
    titulo,
    titulo_original: textoOuNull('r-titulo-original'),
    ano:             numeroOuNull('r-ano'),
    diretor:         textoOuNull('r-diretor'),
    sinopse:         textoOuNull('r-sinopse'),
    generos:         textoOuNull('r-generos'),
    pais:            textoOuNull('r-pais'),
    trailer_url:     textoOuNull('r-trailer'),
    drive_url:       textoOuNull('r-drive'),
    capa_url:        textoOuNull('r-capa'),
    semana:          textoOuNull('r-semana'),
    destaque:        document.getElementById('r-destaque').checked,
  };

  const id  = document.getElementById('rec-id').value;
  const btn = document.getElementById('rec-salvar');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  try {
    if (id) {
      const atualizado = await adminUpdateRec(id, payload);
      const i = admin.recs.findIndex(r => r.id === id);
      if (i !== -1) admin.recs[i] = atualizado;
      showToast('Recomendação atualizada.', 'success');
    } else {
      const nova = await adminInsertRec(payload);
      admin.recs.unshift(nova);
      showToast('Recomendação adicionada.', 'success');
    }
    renderTabelaRecs();
    mostrarListaRecs();
  } catch (err) {
    console.error(err);
    showToast(`Erro ao salvar: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ Salvar';
  }
}

async function excluirRec(id) {
  const rec = admin.recs.find(r => r.id === id);
  if (!rec) return;
  if (!confirm(`Excluir a recomendação "${rec.titulo}"?\n\nEsta ação não pode ser desfeita.`)) return;

  try {
    await adminDeleteRec(id);
    admin.recs = admin.recs.filter(r => r.id !== id);
    renderTabelaRecs();
    showToast('Recomendação excluída.', 'success');
  } catch (err) {
    console.error(err);
    showToast(`Erro ao excluir: ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ══════════════════════════════════════════════════════════════
function textoOuNull(id) {
  const val = document.getElementById(id).value.trim();
  return val === '' ? null : val;
}

function numeroOuNull(id) {
  const val = document.getElementById(id).value.trim();
  if (val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function filtrar(lista, busca, campos) {
  if (!busca) return lista;
  const q = busca.toLowerCase();
  return lista.filter(item =>
    campos.some(c => item[c] && String(item[c]).toLowerCase().includes(q))
  );
}

function formatarSemana(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function bindPreview(inputId, imgId) {
  document.getElementById(inputId).addEventListener('input',
    debounce(() => atualizarPreview(inputId, imgId), 400));
}

function atualizarPreview(inputId, imgId) {
  const url = document.getElementById(inputId).value.trim();
  const img = document.getElementById(imgId);
  if (!url) { img.style.display = 'none'; img.removeAttribute('src'); return; }
  img.src = url;
  img.style.display = 'block';
  img.onerror = () => { img.style.display = 'none'; };
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function erroBox(msg) {
  return `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <p style="font-family:var(--font-marquee);font-size:0.7rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--red-cinema)">
        ${escapeHtml(msg)}
      </p>
      <p style="font-size:0.78rem;color:var(--muted);margin-top:8px">
        Verifique a URL e a service_role key em js/config.js.
      </p>
    </div>`;
}

function vazioBox(msg) {
  return `
    <div class="empty-state">
      <div class="empty-icon">🎬</div>
      <p style="font-family:var(--font-marquee);font-size:0.7rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--muted)">
        ${escapeHtml(msg)}
      </p>
    </div>`;
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initGate);
