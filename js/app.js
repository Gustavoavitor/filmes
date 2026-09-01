// ============================================================
// CINEMATECA PESSOAL — app.js (Página Principal)
// ============================================================
// Depende de: config.js, rating.js, supabase-client.js
// ============================================================

// ── State ────────────────────────────────────────────────────
let allFilmes    = [];
let filteredFilmes = [];
let currentPage  = 1;
const PER_PAGE   = SITE_CONFIG.itemsPerPage;

let activeFormato = '';
let activeGenero  = '';
let activeOrdem   = 'created_at-desc';
let searchQuery   = '';

// Billboard
let billboardFilmes = [];
let billboardIdx    = 0;
let billboardTimer  = null;

// ── Fetch data ────────────────────────────────────────────────
// Os acessos ao banco vivem em supabase-client.js (fetchFilmes, fetchDestaques).
async function carregarDados() {
  try {
    const [filmes, destaques] = await Promise.all([fetchFilmes(), fetchDestaques()]);
    allFilmes       = filmes;
    billboardFilmes = destaques;
  } catch (err) {
    console.error('Erro ao buscar filmes:', err);
    showToast('Erro ao conectar com o banco de dados. Verifique o config.js.', 'error');
    allFilmes       = [];
    billboardFilmes = [];
  }
}

// ── Build genre options ───────────────────────────────────────
function buildGenreFilter() {
  const generos = new Set();
  allFilmes.forEach(f => {
    if (f.generos) {
      f.generos.split(',').forEach(g => generos.add(g.trim()));
    }
  });
  const sel = document.getElementById('filter-genero');
  [...generos].sort().forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    sel.appendChild(opt);
  });
}

// ── Filter & Sort ─────────────────────────────────────────────
function applyFilters() {
  let list = [...allFilmes];

  if (activeFormato) {
    list = list.filter(f => f.formato === activeFormato);
  }
  if (activeGenero) {
    list = list.filter(f => f.generos && f.generos.toLowerCase().includes(activeGenero.toLowerCase()));
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(f =>
      (f.titulo && f.titulo.toLowerCase().includes(q)) ||
      (f.titulo_original && f.titulo_original.toLowerCase().includes(q)) ||
      (f.diretor && f.diretor.toLowerCase().includes(q))
    );
  }

  // Sort
  const [field, dir] = activeOrdem.split('-');
  list.sort((a, b) => {
    let va = a[field] ?? '';
    let vb = b[field] ?? '';
    if (typeof va === 'string') {
      va = va.toLowerCase(); vb = vb.toLowerCase();
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return dir === 'asc' ? va - vb : vb - va;
  });

  filteredFilmes = list;
  currentPage = 1;
  renderGrid();
  renderPagination();
}

// ── Render film card ──────────────────────────────────────────
function createCard(filme) {
  const card = document.createElement('article');
  card.className = 'film-card animate-fade-in';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Ver detalhes de ${filme.titulo}`);

  const formatoBadge = filme.formato === 'bluray' ? 'Blu-ray' : 'DVD';

  let posterHTML = '';
  if (filme.capa_url) {
    posterHTML = `<img class="card-poster" src="${filme.capa_url}" alt="Capa de ${filme.titulo}" loading="lazy" />`;
  } else {
    posterHTML = `
      <div class="card-poster-placeholder">
        <div class="placeholder-icon">📽</div>
        <div class="placeholder-title">${filme.titulo}</div>
      </div>`;
  }

  // As estrelas são montadas pelo componente depois de inserir o card,
  // para nunca aparecer estrela cortada e respeitar o tema do filme.
  const starsHTML = filme.minha_nota
    ? `<div class="card-stars"><div class="card-stars-widget"></div></div>`
    : '';

  // O slot vem antes do pôster: o canvas 3D cobre a imagem, que fica de
  // fallback enquanto o WebGL não sobe (ou se não houver suporte).
  card.innerHTML = `
    <div class="film-card-inner">
      <div class="card-poster-wrap">
        <div class="capa3d-slot"></div>
        ${posterHTML}
        <span class="card-format-badge">${formatoBadge}</span>
        <div class="card-overlay">
          <button class="card-overlay-btn" aria-hidden="true">Ver Detalhes</button>
        </div>
      </div>
      <div class="card-body">
        <h2 class="card-title">${escapeHtml(filme.titulo)}</h2>
        <p class="card-year">${escapeHtml([filme.diretor, filme.ano].filter(Boolean).join(' · '))}</p>
        ${starsHTML}
      </div>
    </div>
  `;

  // A transição de projeção (js/projecao.js) intercepta este atributo.
  card.dataset.filmeId = filme.id;

  const go = () => {
    if (window.projetarE) window.projetarE(`filme.html?id=${filme.id}`);
    else window.location.href = `filme.html?id=${filme.id}`;
  };
  card.addEventListener('click', go);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); });

  if (filme.minha_nota) {
    renderStars(card.querySelector('.card-stars-widget'),
                Number(filme.minha_nota), 15, filme.tema_estrelas || null);
  }

  // Capa em 3D. O gerenciador liga só o que está visível.
  if (window.galeriaCapas3D && window.suporteWebGL) {
    window.galeriaCapas3D.registrar(card.querySelector('.capa3d-slot'), {
      formato:         filme.formato,
      titulo:          filme.titulo,
      capaUrl:         filme.capa_url || null,
      capaTraseiraUrl: filme.capa_traseira_url || null,
      corSpine:        filme.cor_spine || '#1a1a1a',
    });
  }

  return card;
}

// ── Render grid ───────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('films-grid');

  // Descarta as capas 3D da página anterior — cada uma segura um contexto
  // WebGL, e o navegador só permite um punhado deles vivos ao mesmo tempo.
  window.galeriaCapas3D?.limpar();

  grid.innerHTML = '';

  const start = (currentPage - 1) * PER_PAGE;
  const page  = filteredFilmes.slice(start, start + PER_PAGE);

  if (page.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🎞</div>
        <p style="font-family:var(--font-marquee);letter-spacing:.2em;color:var(--muted);text-transform:uppercase;font-size:.7rem">
          Nenhum filme encontrado
        </p>
      </div>`;
    return;
  }

  page.forEach(f => grid.appendChild(createCard(f)));
}

// ── Pagination ────────────────────────────────────────────────
function renderPagination() {
  const nav   = document.getElementById('pagination');
  nav.innerHTML = '';
  const total = Math.ceil(filteredFilmes.length / PER_PAGE);
  if (total <= 1) return;

  const makeBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.disabled = disabled;
    btn.className = 'filter-btn' + (active ? ' active' : '');
    btn.setAttribute('aria-label', `Ir para página ${label}`);
    btn.style.cssText = 'min-width:2.2rem;';
    if (!disabled) btn.addEventListener('click', () => {
      currentPage = page;
      renderGrid();
      renderPagination();
      document.getElementById('colecao').scrollIntoView({ behavior: 'smooth' });
    });
    return btn;
  };

  nav.appendChild(makeBtn('‹', currentPage - 1, currentPage === 1));
  for (let p = 1; p <= total; p++) {
    if (total > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== total) {
      if (p === currentPage - 3 || p === currentPage + 3) {
        const dots = document.createElement('span');
        dots.textContent = '…';
        dots.style.cssText = 'color:var(--muted);align-self:center;padding:0 .25rem;';
        nav.appendChild(dots);
      }
      continue;
    }
    nav.appendChild(makeBtn(p, p, false, p === currentPage));
  }
  nav.appendChild(makeBtn('›', currentPage + 1, currentPage === total));
}

// ── Billboard ─────────────────────────────────────────────────
function renderBillboardSlide(idx) {
  const f = billboardFilmes[idx];
  const content = document.getElementById('billboard-content');
  if (!f) return;

  const formatoBadge = f.formato === 'bluray' ? 'Blu-ray' : 'DVD';

  let posterEl = '';
  if (f.capa_url) {
    posterEl = `<img class="billboard-poster" src="${f.capa_url}" alt="Capa de ${f.titulo}" />`;
  } else {
    posterEl = `<div class="billboard-poster" style="background:linear-gradient(135deg,var(--breu),#3A2E45);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:5rem;">📽</div>`;
  }

  const genresTags = f.generos
    ? f.generos.split(',').map(g => `<span class="meta-tag">${g.trim()}</span>`).join('')
    : '';

  let ratingHTML = '';
  if (f.minha_nota) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      if (f.minha_nota >= i) stars += '★';
      else if (f.minha_nota >= i - 0.5) stars += '½';
      else stars += '☆';
    }
    ratingHTML = `
      <div class="billboard-rating">
        <span class="billboard-stars" aria-label="Nota: ${f.minha_nota} de 5">${stars}</span>
        <span class="billboard-rating-num">${f.minha_nota.toFixed(1)}</span>
      </div>`;
  }

  content.style.opacity = '0';
  content.style.transition = 'opacity .4s ease';
  setTimeout(() => {
    content.innerHTML = `
      <div class="billboard-poster-wrap animate-fade-in">
        ${posterEl}
        <span class="billboard-format-badge">${formatoBadge}</span>
      </div>
      <div class="billboard-info animate-fade-in-up">
        <h2 class="billboard-title">${f.titulo}</h2>
        ${f.titulo_original ? `<p class="billboard-original-title">${f.titulo_original} (${f.ano || ''})</p>` : ''}
        <div class="billboard-meta">
          ${f.diretor ? `<span class="meta-tag">Dir. ${f.diretor}</span>` : ''}
          ${f.ano    ? `<span class="meta-tag">${f.ano}</span>` : ''}
          ${f.pais   ? `<span class="meta-tag">${f.pais}</span>` : ''}
          ${f.duracao ? `<span class="meta-tag">${f.duracao} min</span>` : ''}
          ${genresTags}
        </div>
        ${f.sinopse ? `<p class="billboard-synopsis">${f.sinopse.substring(0, 300)}${f.sinopse.length > 300 ? '…' : ''}</p>` : ''}
        ${ratingHTML}
        <div class="billboard-cta">
          <a href="filme.html?id=${f.id}" class="btn btn-primary" id="billboard-cta-details">Ver Detalhes</a>
          ${f.trailer_url ? `<a href="${f.trailer_url}" target="_blank" rel="noopener" class="btn btn-secondary" id="billboard-cta-trailer">▶ Trailer</a>` : ''}
        </div>
      </div>
    `;
    content.style.opacity = '1';
  }, 200);

  // Dots
  document.querySelectorAll('.billboard-dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
    d.setAttribute('aria-selected', i === idx);
  });
}

function renderBillboardDots() {
  const dotsEl = document.getElementById('billboard-dots');
  dotsEl.innerHTML = '';
  billboardFilmes.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'billboard-dot' + (i === 0 ? ' active' : '');
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-label', `Slide ${i + 1} de ${billboardFilmes.length}`);
    btn.addEventListener('click', () => {
      clearInterval(billboardTimer);
      billboardIdx = i;
      renderBillboardSlide(i);
      startBillboardAuto();
    });
    dotsEl.appendChild(btn);
  });
}

function startBillboardAuto() {
  clearInterval(billboardTimer);
  if (billboardFilmes.length <= 1) return;
  billboardTimer = setInterval(() => {
    billboardIdx = (billboardIdx + 1) % billboardFilmes.length;
    renderBillboardSlide(billboardIdx);
  }, SITE_CONFIG.autoAdvanceBillboard);
}

function initBillboard() {
  if (billboardFilmes.length === 0) {
    document.getElementById('billboard').style.display = 'none';
    return;
  }
  renderBillboardDots();
  renderBillboardSlide(0);
  startBillboardAuto();
}

// ── Filter event listeners ────────────────────────────────────
function initFilters() {
  // Format buttons
  document.querySelectorAll('[data-filter="formato"]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter="formato"]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFormato = btn.dataset.value;
      applyFilters();
    });
  });

  // Genre select
  document.getElementById('filter-genero').addEventListener('change', e => {
    activeGenero = e.target.value;
    applyFilters();
  });

  // Sort select
  document.getElementById('filter-ordem').addEventListener('change', e => {
    activeOrdem = e.target.value;
    applyFilters();
  });

  // Search input (debounced)
  let searchTimer = null;
  document.getElementById('filter-busca').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value.trim();
      applyFilters();
    }, 300);
  });
}

// ── Boot ──────────────────────────────────────────────────────
async function boot() {
  // Sem credenciais reais a requisição fica pendurada no DNS até dar timeout.
  if (configIncompleta()) {
    document.getElementById('billboard').style.display = 'none';
    document.getElementById('films-grid').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">⚙️</div>
        <p style="font-family:var(--font-marquee);font-size:.7rem;letter-spacing:.2em;color:var(--muted);text-transform:uppercase">
          Configure o Supabase em js/config.js
        </p>
        <p style="font-size:.8rem;color:var(--muted);margin-top:.5rem">
          Veja o passo a passo no README do projeto.
        </p>
      </div>`;
    return;
  }

  await carregarDados();

  initBillboard();
  buildGenreFilter();
  initFilters();
  applyFilters();
}

document.addEventListener('DOMContentLoaded', boot);
