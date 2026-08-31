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

// ── Palco: o scan 3D sempre visível, com a capa ao lado ───────
function renderPalco(f) {
  const capa = document.getElementById('film-cover-img');
  if (f.capa_url) {
    capa.src = f.capa_url;
    capa.alt = `Capa de ${f.titulo}`;
  } else {
    // Sem capa cadastrada, um lugar reservado no lugar da imagem quebrada.
    capa.closest('.palco-capa').innerHTML = `
      <div class="capa-ausente">
        <span class="capa-ausente-icone">📽</span>
        <span class="capa-ausente-texto">${escapeHtml(f.titulo)}</span>
      </div>
      <figcaption class="palco-capa-legenda">Sem capa cadastrada</figcaption>`;
  }

  renderMyRating(f);
  prepararTrailer(f);

  // O visualizador entra de imediato: é o centro da página.
  iniciarViewer3d();
}

// O tema das estrelas vem do banco (coluna tema_estrelas). Sem valor,
// usa o dourado padrão da casa.
function temaDoFilme(f) {
  return f?.tema_estrelas || null;
}

// ── Visualizador 3D ───────────────────────────────────────────
async function iniciarViewer3d() {
  const container = document.getElementById('viewer-3d-container');
  if (!container || viewer3d) return;

  // viewer3d.js é um módulo ES: pode não ter terminado de carregar ainda.
  if (typeof Viewer3D === 'undefined') {
    container.innerHTML = `<div class="viewer-3d-aviso">Carregando o visualizador…</div>`;
    await esperarViewer3D();
    container.innerHTML = '';
  }

  if (typeof Viewer3D === 'undefined') {
    container.innerHTML = `<div class="viewer-3d-aviso">Visualizador 3D indisponível neste navegador</div>`;
    return;
  }

  // Procura assets/modelos3d/<slug-do-titulo>.glb. Sem arquivo, o Viewer3D
  // monta a caixa da embalagem com a capa como textura.
  const glbUrl = await acharGlb(filmeData.titulo);

  viewer3d = new Viewer3D(container, {
    glbUrl,
    capaUrl:         filmeData.capa_url          || null,
    capaTraseiraUrl: filmeData.capa_traseira_url || null,
    titulo:          filmeData.titulo,
    formato:         filmeData.formato,
    corSpine:        filmeData.cor_spine || '#1a1a1a',
  });
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

  if (!f.minha_nota) {
    block.innerHTML = `<p style="font-family:var(--font-marquee);font-size:.65rem;color:var(--muted);letter-spacing:.1em;">Ainda sem nota do curador</p>`;
    return;
  }

  block.innerHTML = `
    <div class="my-rating-display">
      <div class="my-rating-stars"></div>
      <div>
        <div class="my-rating-num">${Number(f.minha_nota).toFixed(1)}</div>
        <div class="rating-mini-label">minha nota</div>
      </div>
    </div>`;

  renderStars(block.querySelector('.my-rating-stars'), Number(f.minha_nota), 26, temaDoFilme(f));
}

// ── Trailer ───────────────────────────────────────────────────
function urlDeEmbed(trailerUrl) {
  const id = extractYouTubeId(trailerUrl);
  // enablejsapi permite mandar "pause" pelo postMessage quando a aba muda.
  return id
    ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&enablejsapi=1`
    : trailerUrl;              // link direto de outra origem
}

// Esconder o painel não interrompe o áudio do YouTube; é preciso pedir.
function pausarTrailer() {
  document.querySelectorAll('#trailer-iframe').forEach(ifr => {
    try {
      ifr.contentWindow?.postMessage(
        '{"event":"command","func":"pauseVideo","args":""}', '*'
      );
    } catch { /* origem cruzada sem jsapi: nada a fazer */ }
  });
}

function prepararTrailer(f) {
  const btn = document.getElementById('btn-trailer');
  if (!btn) return;

  if (!f.trailer_url) { btn.style.display = 'none'; return; }
  btn.style.display = 'flex';
  btn.addEventListener('click', abrirTrailerModal);

  document.getElementById('btn-fechar-trailer')?.addEventListener('click', fecharTrailerModal);
  document.getElementById('trailer-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'trailer-modal') fecharTrailerModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharTrailerModal();
  });
}

function abrirTrailerModal() {
  const modal  = document.getElementById('trailer-modal');
  const iframe = document.getElementById('trailer-iframe');
  if (!modal || !iframe || !filmeData?.trailer_url) return;

  iframe.src = urlDeEmbed(filmeData.trailer_url) + '&autoplay=1';
  document.getElementById('trailer-modal-title').textContent = filmeData.titulo;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  document.getElementById('btn-fechar-trailer')?.focus();
}

function fecharTrailerModal() {
  const modal  = document.getElementById('trailer-modal');
  const iframe = document.getElementById('trailer-iframe');
  if (!modal || modal.style.display !== 'flex') return;
  modal.style.display = 'none';
  iframe.src = 'about:blank';        // interrompe a reprodução
  document.body.style.overflow = '';
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
    renderStars(commStars, avg, 18, temaDoFilme(filmeData));
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
      renderStars(tmpDiv, c.nota, 16, temaDoFilme(filmeData));
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
  commentRating   = new StarRating(container, {
    value: 0, readOnly: false, size: 26, tema: temaDoFilme(filmeData),
  });

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
  renderPalco(filme);
  renderComments(comentarios);
  initCommentForm();

  document.getElementById('film-main').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', boot);
