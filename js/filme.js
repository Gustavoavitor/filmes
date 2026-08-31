// ============================================================
// CINEMATECA PESSOAL — filme.js (Página do Filme)
// ============================================================
// Depende de: config.js, rating.js, supabase-client.js
// e do módulo js/viewer3d.js (que expõe window.Viewer3D).
// ============================================================

// ── Get film ID from URL ──────────────────────────────────────
const params  = new URLSearchParams(window.location.search);
const filmeId = params.get('id');

if (!filmeId) {
  window.location.href = 'index.html';
}

// ── State ────────────────────────────────────────────────────
let filmeData     = null;
let viewer3d      = null;
let commentRating = null;

// ── Fetch film ────────────────────────────────────────────────
// Os acessos ao banco vivem em supabase-client.js. Aqui só tratamos o erro
// para a tela, em vez de deixar a exceção subir.
async function carregarFilme() {
  try {
    return await fetchFilme(filmeId);
  } catch (err) {
    console.error('Erro ao buscar filme:', err);
    mostrarErroHero('Filme não encontrado');
    return null;
  }
}

async function carregarComentarios() {
  try {
    return await fetchComentarios(filmeId);
  } catch (err) {
    console.error('Erro ao buscar comentários:', err);
    return [];
  }
}

function mostrarErroHero(msg) {
  document.getElementById('film-hero-content').innerHTML = `
    <div style="color:var(--gold);text-align:center;padding:4rem 0;">
      <div style="font-size:4rem;margin-bottom:1rem">📽</div>
      <p style="font-family:var(--font-marquee);letter-spacing:.3em;">${escapeHtml(msg)}</p>
      <a href="index.html" class="btn btn-secondary" style="margin-top:1.5rem;display:inline-flex;">← Voltar à coleção</a>
    </div>`;
}

// ── Render film hero ──────────────────────────────────────────
function renderHero(f) {
  document.title = `${f.titulo} — Cinemateca Pessoal`;
  document.querySelector('meta[name="description"]').setAttribute(
    'content', `${f.titulo} (${f.ano}) — ${f.sinopse ? f.sinopse.substring(0, 150) + '…' : 'Detalhes na Cinemateca Pessoal.'}`
  );

  if (f.capa_url) {
    document.getElementById('film-hero-bg').style.backgroundImage = `url('${f.capa_url}')`;
  }

  const genresTags = f.generos
    ? f.generos.split(',').map(g => `<span class="meta-tag">${g.trim()}</span>`).join('')
    : '';

  document.getElementById('film-hero-content').innerHTML = `
    <a href="index.html" class="btn btn-secondary" style="margin-bottom:1.5rem;display:inline-flex;font-size:.7rem;">
      ← Voltar à coleção
    </a>
    <h1 class="film-title-lg" style="color:var(--gold-light);">${f.titulo}</h1>
    ${f.titulo_original ? `<p class="film-original-title" style="color:var(--parchment);margin-bottom:.5rem;">${f.titulo_original}</p>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.75rem;">
      ${f.formato ? `<span class="meta-tag">${f.formato === 'bluray' ? 'Blu-ray' : 'DVD'}</span>` : ''}
      ${f.ano     ? `<span class="meta-tag">${f.ano}</span>` : ''}
      ${f.pais    ? `<span class="meta-tag">${f.pais}</span>` : ''}
      ${genresTags}
    </div>
  `;
}

// ── Render film info panel ────────────────────────────────────
function renderInfo(f) {
  const infoEl = document.getElementById('film-info');

  const metaItems = [
    { label: 'Diretor',       value: f.diretor },
    { label: 'Ano',           value: f.ano },
    { label: 'País',          value: f.pais },
    { label: 'Duração',       value: f.duracao ? `${f.duracao} min` : null },
    { label: 'Classificação', value: f.classificacao },
    { label: 'Formato',       value: f.formato === 'bluray' ? 'Blu-ray' : (f.formato === 'dvd' ? 'DVD' : null) },
    { label: 'Edição',        value: f.edicao },
    { label: 'Elenco',        value: f.elenco },
  ].filter(m => m.value);

  const metaHTML = metaItems.map(m => `
    <div class="meta-item">
      <div class="meta-item-label">${m.label}</div>
      <div class="meta-item-value">${m.value}</div>
    </div>`).join('');

  infoEl.innerHTML = `
    <div class="film-meta-grid">${metaHTML}</div>
    ${f.sinopse ? `
      <div class="film-synopsis">
        <p>${f.sinopse}</p>
      </div>` : ''}
    ${f.generos ? `
      <div style="margin-bottom:1.5rem;">
        <p style="font-family:var(--font-marquee);font-size:.6rem;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;margin-bottom:.5rem;">Gêneros</p>
        <div style="display:flex;flex-wrap:wrap;gap:.4rem;">
          ${f.generos.split(',').map(g => `<span class="meta-tag">${g.trim()}</span>`).join('')}
        </div>
      </div>` : ''}
  `;
}

// ── Render sidebar cover & 3D ─────────────────────────────────
function renderSidebar(f) {
  // Cover image
  const coverImg = document.getElementById('film-cover-img');
  if (f.capa_url) {
    coverImg.src = f.capa_url;
    coverImg.alt = `Capa de ${f.titulo}`;
  } else {
    document.getElementById('panel-cover').innerHTML = `
      <div style="aspect-ratio:2/3;background:linear-gradient(135deg,var(--mahogany-dark),var(--charcoal));display:flex;align-items:center;justify-content:center;border:3px solid var(--gold-dark);">
        <span style="font-size:4rem;opacity:.5;">📽</span>
      </div>`;
  }

  // Tab listeners
  document.getElementById('tab-cover').addEventListener('click', () => switchTab('cover'));
  document.getElementById('tab-3d').addEventListener('click', () => switchTab('3d'));

  // My rating
  renderMyRating(f);

  // Trailer
  if (f.trailer_url) {
    renderTrailer(f.trailer_url);
  }
}

function switchTab(which) {
  const coverPanel = document.getElementById('panel-cover');
  const panel3d    = document.getElementById('panel-3d');
  const tabCover   = document.getElementById('tab-cover');
  const tab3d      = document.getElementById('tab-3d');

  if (which === 'cover') {
    coverPanel.style.display = 'block';
    panel3d.style.display    = 'none';
    tabCover.classList.add('active');  tabCover.setAttribute('aria-selected','true');
    tab3d.classList.remove('active');  tab3d.setAttribute('aria-selected','false');
  } else {
    coverPanel.style.display = 'none';
    panel3d.style.display    = 'block';
    tabCover.classList.remove('active'); tabCover.setAttribute('aria-selected','false');
    tab3d.classList.add('active');       tab3d.setAttribute('aria-selected','true');

    // Init 3D viewer lazily
    if (!viewer3d && !iniciando3d && filmeData) iniciarViewer3d();
  }
}

// O viewer é pesado (three.js + o GLB), então só monta quando a aba é aberta.
let iniciando3d = false;

async function iniciarViewer3d() {
  iniciando3d = true;
  const container = document.getElementById('viewer-3d-container');

  // viewer3d.js é um módulo ES: pode não ter terminado de carregar ainda.
  if (typeof Viewer3D === 'undefined') {
    container.innerHTML = `
      <div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--gold);font-family:var(--font-marquee);font-size:.65rem;letter-spacing:.2em;text-transform:uppercase">
        Carregando o visualizador…
      </div>`;
    await esperarViewer3D();
    container.innerHTML = '';
  }

  if (typeof Viewer3D === 'undefined') {
    container.innerHTML = `
      <div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-family:var(--font-marquee);font-size:.65rem;letter-spacing:.2em;text-transform:uppercase;text-align:center;padding:1rem">
        Visualizador 3D indisponível
      </div>`;
    iniciando3d = false;
    return;
  }

  // Procura assets/modelos3d/<slug-do-titulo>.glb. Se não existir,
  // o Viewer3D monta a caixa com a capa como textura.
  const glbUrl = await acharGlb(filmeData.titulo);

  viewer3d = new Viewer3D(container, {
    glbUrl,
    capaUrl:         filmeData.capa_url          || null,
    capaTraseiraUrl: filmeData.capa_traseira_url || null,
    titulo:          filmeData.titulo,
    formato:         filmeData.formato,
    corSpine:        filmeData.cor_spine || '#1a1a1a',
  });
  iniciando3d = false;
}

function esperarViewer3D(timeoutMs = 8000) {
  return new Promise(resolve => {
    const inicio = Date.now();
    (function checar() {
      if (typeof Viewer3D !== 'undefined' || Date.now() - inicio > timeoutMs) return resolve();
      setTimeout(checar, 100);
    })();
  });
}

function renderMyRating(f) {
  const block = document.getElementById('my-rating-block');
  if (f.minha_nota) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      if (f.minha_nota >= i) stars += '★';
      else if (f.minha_nota >= i - 0.5) stars += `<span style="position:relative;display:inline-block"><span style="color:rgba(232,222,200,.4)">★</span><span style="position:absolute;left:0;top:0;overflow:hidden;width:50%;color:var(--gold)">★</span></span>`;
      else stars += `<span style="color:rgba(232,222,200,.3)">★</span>`;
    }
    block.innerHTML = `
      <div class="my-rating-display">
        <div class="my-rating-stars" aria-label="Minha nota: ${f.minha_nota} de 5">${stars}</div>
        <div>
          <div class="my-rating-num">${f.minha_nota.toFixed(1)}</div>
          <div style="font-family:var(--font-marquee);font-size:.55rem;letter-spacing:.2em;color:var(--muted);text-transform:uppercase;">minha nota</div>
        </div>
      </div>`;
  } else {
    block.innerHTML = `<p style="font-family:var(--font-marquee);font-size:.65rem;color:var(--muted);letter-spacing:.1em;">Ainda sem nota do curador</p>`;
  }
}

function renderTrailer(trailerUrl) {
  const section = document.getElementById('trailer-section');
  const wrap    = document.getElementById('trailer-wrap');
  section.style.display = 'block';

  // Convert YouTube watch URLs to embed
  let embedUrl = trailerUrl;
  const ytMatch = trailerUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (ytMatch) {
    embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
  }

  wrap.innerHTML = `<iframe src="${embedUrl}" allowfullscreen title="Trailer de ${filmeData.titulo}" loading="lazy"></iframe>`;
}

// ── Render comments ───────────────────────────────────────────
function renderComments(comments) {
  const list = document.getElementById('comments-list');
  list.innerHTML = '';

  // Community average
  if (comments.length > 0) {
    const avg = comments.reduce((s, c) => s + (c.nota || 0), 0) / comments.filter(c => c.nota).length;
    const commRating = document.getElementById('community-rating');
    commRating.style.display = 'flex';
    document.getElementById('community-count').textContent = `${comments.length} avaliação${comments.length !== 1 ? 'ões' : ''}`;
    document.getElementById('community-avg').textContent   = avg.toFixed(1);
    const commStars = document.getElementById('community-stars');
    renderStars(commStars, avg, 18);
  }

  if (comments.length === 0) {
    list.innerHTML = `
      <div class="empty-state" style="padding:2rem 0;">
        <div class="empty-icon">💬</div>
        <p style="font-family:var(--font-marquee);letter-spacing:.2em;color:var(--muted);text-transform:uppercase;font-size:.65rem;">
          Seja o primeiro a comentar
        </p>
      </div>`;
    return;
  }

  comments.forEach(c => {
    const card = document.createElement('div');
    card.className = 'comment-card animate-fade-in';

    const date = new Date(c.created_at).toLocaleDateString('pt-BR', { year:'numeric', month:'short', day:'numeric' });

    let starsEl = '';
    if (c.nota) {
      const tmpDiv = document.createElement('div');
      renderStars(tmpDiv, c.nota, 16);
      starsEl = `<div style="margin-bottom:.5rem;">${tmpDiv.innerHTML}</div>`;
    }

    card.innerHTML = `
      <div class="comment-header">
        <div>
          <div class="comment-author">${escapeHtml(c.nome)}</div>
          ${starsEl}
        </div>
        <span class="comment-date">${date}</span>
      </div>
      ${c.comentario ? `<p class="comment-text">${escapeHtml(c.comentario)}</p>` : ''}
    `;
    list.appendChild(card);
  });
}

// ── Init comment form ─────────────────────────────────────────
function initCommentForm() {
  const container = document.getElementById('comment-rating-container');
  commentRating   = new StarRating(container, { value: 0, readOnly: false, size: 22 });

  const form = document.getElementById('comment-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = document.getElementById('comment-name').value.trim();
    const text  = document.getElementById('comment-text').value.trim();
    const nota  = commentRating.getValue();
    const btn   = document.getElementById('comment-submit-btn');

    if (!name) { showToast('Por favor, insira seu nome.', 'error'); return; }

    btn.disabled    = true;
    btn.textContent = 'Enviando…';

    try {
      await inserirComentario({ filmeId, nome: name, nota: nota || null, comentario: text || null });
      showToast('Comentário enviado!', 'success');
      form.reset();
      commentRating.setValue(0);
      renderComments(await carregarComentarios());
    } catch (err) {
      console.error(err);
      showToast('Erro ao enviar comentário.', 'error');
    } finally {
      btn.disabled    = false;
      btn.textContent = '✦ Enviar Comentário';
    }
  });
}

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  // Sem credenciais reais a requisição fica pendurada no DNS até dar timeout.
  if (configIncompleta()) {
    mostrarErroHero('Configure o Supabase em js/config.js');
    return;
  }

  const [filme, comentarios] = await Promise.all([carregarFilme(), carregarComentarios()]);

  if (!filme) return;
  filmeData = filme;

  renderHero(filme);
  renderInfo(filme);
  renderSidebar(filme);
  renderComments(comentarios);
  initCommentForm();

  document.getElementById('film-main').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', boot);
