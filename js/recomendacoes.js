// ============================================================
// CINEMATECA PESSOAL — recomendacoes.js
// ============================================================
// Depende de: config.js, supabase-client.js
// ============================================================

const SEM_DATA = 'sem-data';

// Guarda as recomendações agrupadas por semana entre os renders.
let recsPorSemana = {};

document.addEventListener('DOMContentLoaded', initRecsPage);

async function initRecsPage() {
  bindTrailerModal();

  // Sem credenciais reais a requisição ficaria pendurada no DNS por minutos.
  if (configIncompleta()) {
    renderAviso('Configure o Supabase em js/config.js para carregar as recomendações.');
    return;
  }

  try {
    const recs = await fetchRecomendacoes();

    // Agrupa por semana
    const porSemana = {};
    recs.forEach(r => {
      const semana = r.semana || SEM_DATA;
      (porSemana[semana] = porSemana[semana] || []).push(r);
    });

    // Semanas mais recentes primeiro; "sem-data" sempre por último.
    const semanas = Object.keys(porSemana).sort((a, b) => {
      if (a === SEM_DATA) return 1;
      if (b === SEM_DATA) return -1;
      return b.localeCompare(a);
    });

    if (!semanas.length) { renderEmpty(); return; }

    recsPorSemana = porSemana;

    const semanaAtual = semanas[0];
    const recsAtual   = porSemana[semanaAtual];
    const destaque    = recsAtual.find(r => r.destaque) || recsAtual[0];

    renderHero(semanaAtual);
    renderFeatured(destaque);
    renderSemanas(semanas, semanaAtual);
  } catch (err) {
    console.error(err);
    showToast('Erro ao carregar recomendações', 'error');
    renderAviso(`Erro ao carregar: ${err.message}`);
  }
}

// ── Hero ──────────────────────────────────────────────────────
function renderHero(semana) {
  const el = document.getElementById('recs-week-label');
  if (!el) return;
  el.textContent = semana === SEM_DATA
    ? 'Sem data definida'
    : `Semana de ${formatarSemanaLonga(semana)}`;
}

// ── Destaque da semana ────────────────────────────────────────
function renderFeatured(rec) {
  const el = document.getElementById('featured-rec');
  if (!el || !rec) return;

  const ytId = extractYouTubeId(rec.trailer_url);

  el.innerHTML = `
    <div class="rec-featured-inner animate-fade-in">
      <div style="position:relative;background:var(--mahogany-dark)">
        ${rec.capa_url
          ? `<img src="${escapeHtml(rec.capa_url)}" alt="Capa de ${escapeHtml(rec.titulo)}" class="rec-featured-poster">`
          : `<div class="card-poster-placeholder" style="height:100%;min-height:400px">
               <span class="placeholder-icon">🌍</span>
               <span class="placeholder-title">${escapeHtml(rec.titulo)}</span>
             </div>`}
      </div>

      <div class="rec-featured-info">
        <div class="rec-featured-label">✦ Destaque da Semana ✦</div>

        <h2 style="font-family:var(--font-display);font-size:clamp(1.5rem,3vw,2.5rem);font-weight:900;font-style:italic;color:var(--charcoal);line-height:1.1;margin-bottom:var(--space-2)">
          ${escapeHtml(rec.titulo)}
        </h2>
        ${rec.titulo_original && rec.titulo_original !== rec.titulo
          ? `<p style="font-family:var(--font-accent);font-style:italic;color:var(--muted);margin-bottom:var(--space-4)">${escapeHtml(rec.titulo_original)}</p>`
          : ''}

        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-5)">
          ${rec.pais    ? `<span class="meta-tag">🌍 ${escapeHtml(rec.pais)}</span>` : ''}
          ${rec.ano     ? `<span class="meta-tag">${rec.ano}</span>` : ''}
          ${rec.diretor ? `<span class="meta-tag">${escapeHtml(rec.diretor)}</span>` : ''}
          ${listaDeTags(rec.generos)}
        </div>

        ${rec.sinopse
          ? `<p style="font-size:0.9rem;line-height:1.8;color:var(--charcoal-mid);font-style:italic;margin-bottom:var(--space-6);flex:1">${escapeHtml(rec.sinopse)}</p>`
          : ''}

        <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;margin-top:auto">
          ${rec.drive_url
            ? `<a href="${escapeHtml(rec.drive_url)}" target="_blank" rel="noopener" class="drive-btn" style="flex:1;min-width:160px;width:auto">
                 ${ICONE_DRIVE}
                 Assistir no Drive
               </a>`
            : ''}
          ${ytId
            ? `<button type="button" class="btn btn-secondary"
                       data-trailer="${escapeHtml(ytId)}" data-trailer-titulo="${escapeHtml(rec.titulo)}">
                 ◎ Ver Trailer
               </button>`
            : ''}
        </div>
      </div>
    </div>`;
}

// ── Navegação de semanas + grid ───────────────────────────────
function renderSemanas(semanas, semanaAtual) {
  const navEl  = document.getElementById('semanas-nav');
  const gridEl = document.getElementById('recs-grid');
  if (!gridEl) return;

  if (navEl && semanas.length > 1) {
    navEl.innerHTML = semanas.map((s, i) => {
      let label;
      if (s === SEM_DATA)  label = 'Sem data';
      else if (i === 0)    label = 'Esta Semana';
      else                 label = formatarSemanaCurta(s);
      return `<button type="button" class="filter-btn ${s === semanaAtual ? 'active' : ''}" data-semana="${escapeHtml(s)}">${label}</button>`;
    }).join('');

    navEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-semana]');
      if (!btn) return;
      switchSemana(btn.dataset.semana, btn);
    });
  }

  renderRecGrid(recsPorSemana[semanaAtual], gridEl);
}

function switchSemana(semana, btn) {
  document.querySelectorAll('[data-semana]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const gridEl = document.getElementById('recs-grid');
  if (gridEl) renderRecGrid(recsPorSemana[semana], gridEl);

  // Ao voltar a uma semana antiga, o destaque e o rótulo acompanham.
  const recs = recsPorSemana[semana] || [];
  if (recs.length) {
    renderHero(semana);
    renderFeatured(recs.find(r => r.destaque) || recs[0]);
  }
}

function renderRecGrid(recs, gridEl) {
  if (!recs || !recs.length) {
    gridEl.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🎬</div>
        <p style="font-family:var(--font-marquee);font-size:0.7rem;letter-spacing:0.2em;color:var(--muted);text-transform:uppercase">
          Nada nesta semana
        </p>
      </div>`;
    return;
  }

  gridEl.className = 'films-grid recs-grid stagger-children';
  gridEl.innerHTML = recs.map(buildRecCard).join('');
}

function buildRecCard(rec) {
  const ytId = extractYouTubeId(rec.trailer_url);
  return `
    <div class="rec-card animate-fade-in-up">
      <div style="position:relative;aspect-ratio:2/3;overflow:hidden;background:var(--mahogany-dark)">
        ${rec.capa_url
          ? `<img src="${escapeHtml(rec.capa_url)}" alt="Capa de ${escapeHtml(rec.titulo)}" class="rec-card-poster" loading="lazy">`
          : `<div class="card-poster-placeholder" style="height:100%">
               <span class="placeholder-icon">🌍</span>
               <span class="placeholder-title">${escapeHtml(rec.titulo)}</span>
             </div>`}
        ${rec.destaque ? `<div class="card-format-badge">✦ Destaque</div>` : ''}
      </div>
      <div class="rec-card-body">
        <div class="rec-card-country">
          ${rec.pais ? `🌍 ${escapeHtml(rec.pais)}` : ''}${rec.ano ? ` · ${rec.ano}` : ''}
        </div>
        <h3 class="rec-card-title">${escapeHtml(rec.titulo)}</h3>
        ${rec.titulo_original && rec.titulo_original !== rec.titulo
          ? `<p style="font-family:var(--font-accent);font-size:0.75rem;font-style:italic;color:var(--muted);margin-bottom:var(--space-3)">${escapeHtml(rec.titulo_original)}</p>`
          : ''}
        ${rec.generos ? `<p style="font-size:0.75rem;color:var(--muted);margin-bottom:var(--space-3)">${escapeHtml(rec.generos)}</p>` : ''}
        ${rec.sinopse
          ? `<p style="font-size:0.78rem;line-height:1.6;color:var(--charcoal-mid);margin-bottom:var(--space-3);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(rec.sinopse)}</p>`
          : ''}
        <div style="display:flex;gap:var(--space-2);flex-direction:column">
          ${rec.drive_url
            ? `<a href="${escapeHtml(rec.drive_url)}" target="_blank" rel="noopener" class="drive-btn">
                 ${ICONE_DRIVE}
                 Assistir no Drive
               </a>`
            : ''}
          ${ytId
            ? `<button type="button" class="btn btn-secondary" style="width:100%;justify-content:center;font-size:0.6rem"
                       data-trailer="${escapeHtml(ytId)}" data-trailer-titulo="${escapeHtml(rec.titulo)}">
                 ◎ Trailer
               </button>`
            : ''}
        </div>
      </div>
    </div>`;
}

// ── Modal de Trailer ──────────────────────────────────────────
function bindTrailerModal() {
  // Delegação: pega qualquer botão de trailer, inclusive os criados depois.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-trailer]');
    if (btn) {
      openTrailer(btn.dataset.trailer, btn.dataset.trailerTitulo || 'Trailer');
      return;
    }
    // Clique no fundo escuro fecha
    if (e.target === document.getElementById('trailer-modal')) closeTrailer();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTrailer();
  });
}

function openTrailer(ytId, titulo) {
  const modal   = document.getElementById('trailer-modal');
  const iframe  = document.getElementById('trailer-iframe');
  const titleEl = document.getElementById('trailer-modal-title');
  if (!modal || !iframe) return;

  iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(ytId)}?autoplay=1&rel=0&modestbranding=1`;
  if (titleEl) titleEl.textContent = titulo;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  modal.querySelector('.trailer-modal-close')?.focus();
}

function closeTrailer() {
  const modal  = document.getElementById('trailer-modal');
  const iframe = document.getElementById('trailer-iframe');
  if (!modal || modal.style.display !== 'flex') return;
  modal.style.display = 'none';
  iframe.src = 'about:blank';            // interrompe a reprodução
  document.body.style.overflow = '';
}

// ── Estados vazios / aviso ────────────────────────────────────
function renderEmpty() {
  renderAviso('Nenhuma recomendação ainda. Adicione pelo painel de administração.');
}

function renderAviso(msg) {
  const featured = document.getElementById('featured-rec');
  if (featured) featured.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🎬</div>
      <p style="font-family:var(--font-marquee);font-size:0.75rem;letter-spacing:0.2em;color:var(--muted);text-transform:uppercase">
        ${escapeHtml(msg)}
      </p>
    </div>`;

  const grid = document.getElementById('recs-grid');
  if (grid) grid.innerHTML = '';

  const label = document.getElementById('recs-week-label');
  if (label) label.textContent = '—';
}

// ── Utilitários ───────────────────────────────────────────────
function listaDeTags(generos) {
  if (!generos) return '';
  return generos.split(',')
    .map(g => `<span class="meta-tag">${escapeHtml(g.trim())}</span>`)
    .join('');
}

function formatarSemanaLonga(iso) {
  return new Date(iso + 'T12:00:00')
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatarSemanaCurta(iso) {
  return new Date(iso + 'T12:00:00')
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const ICONE_DRIVE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.5 18l-5-8.66L8.5 1h7l5 8.66-5 8.66H8.5z" opacity=".5"/><path d="M1.5 14.34L6.5 6h11l-5 8.66H1.5z" opacity=".7"/><path d="M8.5 18h7l2.5-4.34H6L8.5 18z"/></svg>`;

window.openTrailer  = openTrailer;
window.closeTrailer = closeTrailer;
