// ============================================================
// CINEMATECA PESSOAL — recomendacoes.js
// ============================================================
// Depende de: config.js, rating.js, supabase-client.js
//
// A grade mostra os cartazes. Clicar abre o cartaz em tamanho grande;
// clicar no cartaz vira a carta e revela a ficha, com os ingressos de
// "onde assistir" e os comentários de quem já viu.
// ============================================================

const SEM_DATA = 'sem-data';

let recsPorSemana = {};
let recAberta     = null;   // recomendação aberta no modal
let notaWidget    = null;

document.addEventListener('DOMContentLoaded', initRecsPage);

async function initRecsPage() {
  montarModal();

  if (configIncompleta()) {
    renderAviso('Configure o Supabase em js/config.js para carregar as recomendações.');
    return;
  }

  try {
    const recs = await fetchRecomendacoes();

    const porSemana = {};
    recs.forEach(r => {
      const semana = r.semana || SEM_DATA;
      (porSemana[semana] = porSemana[semana] || []).push(r);
    });

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
    abrirRecDaUrl();
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

  el.innerHTML = `
    <div class="rec-featured-inner animate-fade-in">
      <div style="position:relative;background:var(--mahogany-dark)">
        ${rec.capa_url
          ? `<img src="${escapeHtml(rec.capa_url)}" alt="Cartaz de ${escapeHtml(rec.titulo)}" class="rec-featured-poster">`
          : `<div class="card-poster-placeholder" style="height:100%;min-height:400px">
               <span class="placeholder-icon">🎞</span>
               <span class="placeholder-title">${escapeHtml(rec.titulo)}</span>
             </div>`}
      </div>

      <div class="rec-featured-info">
        <div class="rec-featured-label">✦ Destaque da Semana ✦</div>

        <h2 class="rec-ficha-titulo">${escapeHtml(rec.titulo)}</h2>
        ${rec.titulo_original && rec.titulo_original !== rec.titulo
          ? `<p class="rec-ficha-original">${escapeHtml(rec.titulo_original)}</p>` : ''}

        <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-5)">
          ${rec.pais    ? `<span class="meta-tag">🌍 ${escapeHtml(rec.pais)}</span>` : ''}
          ${rec.ano     ? `<span class="meta-tag">${rec.ano}</span>` : ''}
          ${rec.diretor ? `<span class="meta-tag">${escapeHtml(rec.diretor)}</span>` : ''}
          ${listaDeTags(rec.generos)}
        </div>

        ${rec.sinopse ? `<p class="rec-ficha-sinopse" style="flex:1">${escapeHtml(rec.sinopse)}</p>` : ''}

        <div style="margin-top:auto">
          <button type="button" class="btn btn-primary" data-abrir-rec="${escapeHtml(rec.id)}"
                  style="width:100%;justify-content:center">
            ✦ Ver o cartaz e a ficha
          </button>
        </div>
      </div>
    </div>`;
}

// ── Navegação de semanas + grade de cartazes ──────────────────
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
      if (btn) switchSemana(btn.dataset.semana, btn);
    });
  }

  renderRecGrid(recsPorSemana[semanaAtual], gridEl);
}

function switchSemana(semana, btn) {
  document.querySelectorAll('[data-semana]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const gridEl = document.getElementById('recs-grid');
  if (gridEl) renderRecGrid(recsPorSemana[semana], gridEl);

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
        <div class="empty-icon">🎞</div>
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
  return `
    <div class="rec-card animate-fade-in-up" role="button" tabindex="0"
         data-abrir-rec="${escapeHtml(rec.id)}"
         aria-label="Ver o cartaz de ${escapeHtml(rec.titulo)}">
      <div style="position:relative;aspect-ratio:2/3;overflow:hidden;background:var(--mahogany-dark)">
        ${rec.capa_url
          ? `<img src="${escapeHtml(rec.capa_url)}" alt="Cartaz de ${escapeHtml(rec.titulo)}" class="rec-card-poster" loading="lazy">`
          : `<div class="card-poster-placeholder" style="height:100%">
               <span class="placeholder-icon">🎞</span>
               <span class="placeholder-title">${escapeHtml(rec.titulo)}</span>
             </div>`}
        ${rec.destaque ? `<div class="card-format-badge">✦ Destaque</div>` : ''}
      </div>
      <div class="rec-card-body">
        <div class="rec-card-country">
          ${rec.pais ? `🌍 ${escapeHtml(rec.pais)}` : ''}${rec.ano ? ` · ${rec.ano}` : ''}
        </div>
        <h3 class="rec-card-title">${escapeHtml(rec.titulo)}</h3>
        ${rec.diretor ? `<p style="font-family:var(--font-marquee);font-size:0.55rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted)">${escapeHtml(rec.diretor)}</p>` : ''}
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// MODAL: cartaz de um lado, ficha do outro
// ══════════════════════════════════════════════════════════════
function montarModal() {
  const modal = document.createElement('div');
  modal.className = 'rec-modal';
  modal.id = 'rec-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="rec-modal-acoes">
      <button type="button" class="rec-modal-btn" id="rec-btn-virar">Ver a ficha</button>
      <button type="button" class="rec-modal-btn" id="rec-btn-fechar">✕ Fechar</button>
    </div>
    <div class="rec-palco">
      <div class="rec-carta" id="rec-carta">
        <div class="rec-face rec-face-frente" id="rec-frente"></div>
        <div class="rec-face rec-face-verso"  id="rec-verso"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('rec-btn-fechar').addEventListener('click', fecharRec);
  document.getElementById('rec-btn-virar').addEventListener('click', virarCarta);
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharRec(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharRec(); });

  // Delegação: abre pelo card da grade e pelo botão do destaque.
  document.addEventListener('click', (e) => {
    const alvo = e.target.closest('[data-abrir-rec]');
    if (alvo) abrirRec(alvo.dataset.abrirRec);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const alvo = e.target.closest?.('[data-abrir-rec]');
    if (alvo) { e.preventDefault(); abrirRec(alvo.dataset.abrirRec); }
  });
}

// O e-mail da newsletter aponta para ?rec=<id>. Quem clicou em "deixar
// minha nota" quer a ficha, e não o cartaz — a carta já abre virada.
function abrirRecDaUrl() {
  const id = new URLSearchParams(location.search).get('rec');
  if (!id || !acharRec(id)) return;
  abrirRec(id);
  virarCarta();
}

function acharRec(id) {
  for (const lista of Object.values(recsPorSemana)) {
    const achou = lista.find(r => r.id === id);
    if (achou) return achou;
  }
  return null;
}

function abrirRec(id) {
  const rec = acharRec(id);
  if (!rec) return;
  recAberta = rec;

  document.getElementById('rec-frente').innerHTML = `
    <div class="rec-cartaz" id="rec-cartaz" role="button" tabindex="0"
         aria-label="Clique no cartaz para ver a ficha">
      ${rec.capa_url
        ? `<img src="${escapeHtml(rec.capa_url)}" alt="Cartaz de ${escapeHtml(rec.titulo)}">`
        : `<div class="card-poster-placeholder" style="aspect-ratio:2/3">
             <span class="placeholder-icon">🎞</span>
             <span class="placeholder-title">${escapeHtml(rec.titulo)}</span>
           </div>`}
      <div class="rec-cartaz-dica">✦ &nbsp; Clique no cartaz para ver a ficha &nbsp; ✦</div>
    </div>`;

  const cartaz = document.getElementById('rec-cartaz');
  cartaz.addEventListener('click', virarCarta);
  cartaz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); virarCarta(); }
  });

  renderFicha(rec);

  document.getElementById('rec-carta').classList.remove('virada');
  document.getElementById('rec-btn-virar').textContent = 'Ver a ficha';

  document.getElementById('rec-modal').classList.add('aberto');
  document.body.style.overflow = 'hidden';

  carregarComentariosRec(rec.id);
}

function fecharRec() {
  const modal = document.getElementById('rec-modal');
  if (!modal?.classList.contains('aberto')) return;
  modal.classList.remove('aberto');
  document.body.style.overflow = '';
  recAberta = null;
}

function virarCarta() {
  const carta = document.getElementById('rec-carta');
  const virada = carta.classList.toggle('virada');
  document.getElementById('rec-btn-virar').textContent = virada ? 'Ver o cartaz' : 'Ver a ficha';
}

// ── O verso: ficha + ingressos + comentários ──────────────────
function renderFicha(rec) {
  document.getElementById('rec-verso').innerHTML = `
    <div class="rec-ficha">
      <h2 class="rec-ficha-titulo">${escapeHtml(rec.titulo)}</h2>
      ${rec.titulo_original && rec.titulo_original !== rec.titulo
        ? `<p class="rec-ficha-original">${escapeHtml(rec.titulo_original)}</p>` : ''}

      <div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-top:var(--space-3)">
        ${rec.ano     ? `<span class="meta-tag">${rec.ano}</span>` : ''}
        ${rec.diretor ? `<span class="meta-tag">${escapeHtml(rec.diretor)}</span>` : ''}
        ${rec.pais    ? `<span class="meta-tag">🌍 ${escapeHtml(rec.pais)}</span>` : ''}
        ${rec.duracao ? `<span class="meta-tag">${rec.duracao} min</span>` : ''}
        ${listaDeTags(rec.generos)}
      </div>

      ${rec.sinopse ? `<p class="rec-ficha-sinopse">${escapeHtml(rec.sinopse)}</p>` : ''}

      ${rec.elenco ? `
        <div class="rec-elenco">
          <span class="rec-elenco-rotulo">Elenco</span>
          <span class="rec-elenco-nomes">${escapeHtml(rec.elenco)}</span>
        </div>` : ''}

      <div class="rec-secao-titulo">Onde assistir</div>
      <div class="ingressos">${montarIngressos(rec)}</div>

      <div class="rec-secao-titulo">Já viu? Deixe sua nota</div>
      <div class="rec-comentarios">
        <form id="rec-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="rec-nome">Seu nome</label>
            <input type="text" id="rec-nome" class="form-input" required placeholder="ex: Cinéfilo Anônimo" />
          </div>
          <div class="form-group">
            <label class="form-label">Sua nota</label>
            <div class="rec-form-nota"><div id="rec-nota"></div></div>
          </div>
          <div class="form-group">
            <label class="form-label" for="rec-texto">Comentário</label>
            <textarea id="rec-texto" class="form-textarea" rows="3" placeholder="O que achou do filme?"></textarea>
          </div>
          <button type="submit" class="btn btn-primary" id="rec-enviar"
                  style="width:100%;justify-content:center">✦ Enviar</button>
        </form>
        <div class="rec-lista-comentarios" id="rec-lista"></div>
      </div>
    </div>`;

  notaWidget = new StarRating(document.getElementById('rec-nota'), {
    value: 0, readOnly: false, size: 26, tema: rec.tema_estrelas || null,
  });

  document.getElementById('rec-form').addEventListener('submit', enviarComentarioRec);
}

// ── Ingressos de "onde assistir" ──────────────────────────────
// Lê a coluna onde_assistir (JSON) e, por retrocompatibilidade, os
// campos antigos drive_url e trailer_url.
function fontesDe(rec) {
  const lista = [];

  let json = rec.onde_assistir;
  if (typeof json === 'string') {
    try { json = JSON.parse(json); } catch { json = null; }
  }
  if (Array.isArray(json)) {
    json.forEach(f => {
      if (f?.url) lista.push({ plataforma: f.plataforma || 'Assistir', url: f.url, obs: f.obs || '' });
    });
  }

  if (rec.drive_url && !lista.some(f => f.url === rec.drive_url)) {
    lista.push({ plataforma: 'Google Drive', url: rec.drive_url, obs: '' });
  }
  if (rec.trailer_url && !lista.some(f => f.url === rec.trailer_url)) {
    lista.push({ plataforma: 'Trailer', url: rec.trailer_url, obs: 'apenas o trailer' });
  }

  return lista;
}

// Nome curto ganha corpo maior, nome longo encolhe: assim a linha ocupa
// a largura do ingresso em vez de deixar um vão à direita.
function medidaDoNome(nome) {
  const n = (nome || '').length;
  if (n <= 8)  return 'curto';
  if (n <= 16) return 'medio';
  return 'longo';
}

function montarIngressos(rec) {
  const fontes = fontesDe(rec);
  if (!fontes.length) {
    return `<p style="font-family:var(--font-marquee);font-size:0.6rem;letter-spacing:0.18em;
                     text-transform:uppercase;color:var(--muted)">
              Nenhum link cadastrado ainda
            </p>`;
  }

  return fontes.map((f, i) => `
    <a class="ingresso ingresso--${medidaDoNome(f.plataforma)}" href="${escapeHtml(f.url)}" target="_blank" rel="noopener">
      <span class="ingresso-corpo">
        <span class="ingresso-cabecalho">Sessão · admite um</span>
        <span class="ingresso-plataforma">${escapeHtml(f.plataforma)}</span>
        ${f.obs ? `<span class="ingresso-obs">${escapeHtml(f.obs)}</span>` : ''}
      </span>
      <span class="ingresso-canhoto">
        <span class="ingresso-canhoto-acao">Assistir</span>
        <span class="ingresso-serie">Nº ${String(i + 1).padStart(3, '0')}</span>
      </span>
    </a>`).join('');
}

// ── Comentários da recomendação ───────────────────────────────
async function carregarComentariosRec(recId) {
  const lista = document.getElementById('rec-lista');
  if (!lista) return;
  try {
    renderComentariosRec(await fetchComentariosRec(recId));
  } catch (err) {
    console.error(err);
    lista.innerHTML = '';
  }
}

function renderComentariosRec(comentarios) {
  const lista = document.getElementById('rec-lista');
  if (!lista) return;

  if (!comentarios.length) {
    lista.innerHTML = `
      <p style="font-family:var(--font-marquee);font-size:0.58rem;letter-spacing:0.18em;
                text-transform:uppercase;color:var(--muted);text-align:center;padding:var(--space-4) 0">
        Ninguém comentou ainda
      </p>`;
    return;
  }

  lista.innerHTML = '';
  comentarios.forEach(c => {
    const data = new Date(c.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });

    const div = document.createElement('div');
    div.className = 'rec-comentario';
    div.innerHTML = `
      <div class="rec-comentario-topo">
        <span class="rec-comentario-autor">${escapeHtml(c.nome)}</span>
        <span class="rec-comentario-data">${data}</span>
      </div>
      <div class="rec-comentario-estrelas"></div>
      ${c.comentario ? `<p class="rec-comentario-texto">${escapeHtml(c.comentario)}</p>` : ''}`;
    lista.appendChild(div);

    if (c.nota) {
      renderStars(div.querySelector('.rec-comentario-estrelas'),
                  Number(c.nota), 14, recAberta?.tema_estrelas || null);
    }
  });
}

async function enviarComentarioRec(e) {
  e.preventDefault();
  if (!recAberta) return;

  const nome  = document.getElementById('rec-nome').value.trim();
  const texto = document.getElementById('rec-texto').value.trim();
  const nota  = notaWidget?.getValue() || 0;
  const btn   = document.getElementById('rec-enviar');

  if (!nome) { showToast('Por favor, insira seu nome.', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Enviando…';

  try {
    await inserirComentarioRec({
      recId: recAberta.id, nome, nota: nota || null, comentario: texto || null,
    });
    showToast('Comentário enviado!', 'success');
    e.target.reset();
    notaWidget.setValue(0);
    await carregarComentariosRec(recAberta.id);
  } catch (err) {
    console.error(err);
    showToast('Erro ao enviar comentário.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ Enviar';
  }
}

// ── Estados vazios / aviso ────────────────────────────────────
function renderEmpty() {
  renderAviso('Nenhuma recomendação ainda. Adicione pelo painel do Supabase.');
}

function renderAviso(msg) {
  const featured = document.getElementById('featured-rec');
  if (featured) featured.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🎞</div>
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

// ── Assinatura da newsletter ──────────────────────────────────
// A tabela é insert-only: ninguém lê a lista pelo navegador. Um
// e-mail repetido volta como "já estava", não como erro.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('assinatura-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('assinatura-email').value.trim();
    const nome  = document.getElementById('assinatura-nome').value.trim();
    const btn   = document.getElementById('assinatura-enviar');

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showToast('Esse e-mail está incompleto. Confira o endereço.', 'error');
      document.getElementById('assinatura-email').focus();
      return;
    }

    if (configIncompleta()) {
      showToast('A lista ainda não está ligada ao banco.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Assinando…';

    try {
      const { jaEstava } = await inscreverNewsletter({ email, nome });
      showToast(jaEstava
        ? 'Esse e-mail já está na lista.'
        : 'Assinado. A próxima recomendação chega no seu e-mail.', 'success');
      form.reset();
    } catch (err) {
      console.error(err);
      showToast('Não deu para assinar agora. Tente de novo em instantes.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Assinar';
    }
  });
});
