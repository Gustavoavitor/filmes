// ============================================================
// CINEMATECA PESSOAL — ficha.js (sobreposição de detalhe)
// ============================================================
// Depende de: config.js, rating.js, supabase-client.js
// e do módulo js/viewer3d.js (que expõe window.Viewer3D).
//
// A ficha abre por cima da coleção, e não em outra página: assim o
// desfoque atrás é a grade de verdade, e fechar devolve o usuário
// exatamente onde ele estava. O endereço acompanha (?film=<id>), então
// o botão voltar do navegador funciona e o link é compartilhável.
// ============================================================

let fichaAberta   = null;   // o filme no ar
let fichaViewer   = null;   // instância do Viewer3D
let fichaNota     = null;   // widget de estrelas do formulário
let fichaScroll   = null;   // ScrollTrigger, para matar ao fechar

// ── Abrir e fechar ────────────────────────────────────────────
function abrirFicha(id, semHistorico = false) {
  const filme = allFilmes.find(f => f.id === id);
  if (!filme) return;

  if (!semHistorico) {
    const url = new URL(window.location.href);
    url.searchParams.set('film', id);
    history.pushState({ film: id }, '', url);
  }

  fichaAberta = filme;
  renderFicha(filme);

  const ficha = document.getElementById('ficha');
  ficha.hidden = false;
  document.body.classList.add('com-ficha');

  // O quadro precisa existir com altura antes do Viewer3D medir
  requestAnimationFrame(() => {
    ficha.classList.add('aberta');
    iniciarScan(filme);
    montarColapso();
  });

  document.getElementById('ficha-fechar')?.focus();
  carregarComentariosFicha(filme.id);
}

function fecharFicha(semHistorico = false) {
  const ficha = document.getElementById('ficha');
  if (!ficha || ficha.hidden) return;

  ficha.classList.remove('aberta');
  document.body.classList.remove('com-ficha');

  fichaScroll?.kill();
  fichaScroll = null;
  fichaViewer?.destroy?.();
  fichaViewer = null;
  fichaAberta = null;

  setTimeout(() => { ficha.hidden = true; }, 260);

  if (!semHistorico) {
    const url = new URL(window.location.href);
    url.searchParams.delete('film');
    history.pushState({}, '', url.pathname + url.search);
  }
}

// ── O scan 3D, no centro ──────────────────────────────────────
async function iniciarScan(filme) {
  const alvo = document.getElementById('ficha-scan');
  if (!alvo) return;
  alvo.innerHTML = '';

  if (typeof Viewer3D === 'undefined') {
    alvo.innerHTML = `<p class="ficha-scan-aviso">Carregando o visualizador…</p>`;
    await esperarViewer();
    alvo.innerHTML = '';
  }
  if (typeof Viewer3D === 'undefined') {
    alvo.innerHTML = `<p class="ficha-scan-aviso">Visualizador 3D indisponível neste navegador</p>`;
    return;
  }

  const glbUrl = await acharGlb(filme.titulo);
  fichaViewer = new Viewer3D(alvo, {
    glbUrl,
    capaUrl:         filme.capa_url          || null,
    capaTraseiraUrl: filme.capa_traseira_url || null,
    titulo:          filme.titulo,
    formato:         filme.formato,
    corSpine:        filme.cor_spine || '#1a1a1a',
  });
}

function esperarViewer(limite = 9000) {
  return new Promise(resolve => {
    const t0 = Date.now();
    (function checar() {
      if (typeof Viewer3D !== 'undefined' || Date.now() - t0 > limite) return resolve();
      setTimeout(checar, 100);
    })();
  });
}

// ── Conteúdo ──────────────────────────────────────────────────
function renderFicha(f) {
  document.getElementById('ficha-titulo').textContent = f.titulo;

  // Esquerda: a ficha técnica
  const dados = [
    ['Diretor', f.diretor],
    ['Ano', f.ano],
    ['País', f.pais],
    ['Duração', f.duracao ? `${f.duracao} min` : null],
    ['Classificação', f.classificacao],
    ['Formato', f.formato === 'bluray' ? 'Blu-ray' : (f.formato === 'dvd' ? 'DVD' : null)],
    ['Edição', f.edicao],
    ['Elenco', f.elenco],
  ].filter(([, v]) => v);

  // O quadro de letras tem duas colunas. O elenco sempre ocupa o trilho
  // inteiro; se sobrar um campo ímpar antes dele, esse campo estica
  // também — senão fica um encaixe vazio no meio do quadro.
  const estreitos = dados.filter(([k]) => k !== 'Elenco');
  const ultimoImpar = estreitos.length % 2 ? estreitos[estreitos.length - 1][0] : null;
  const largo = (k) => k === 'Elenco' || k === ultimoImpar;

  document.getElementById('ficha-info').innerHTML = `
    <h2 class="ficha-nome">${escapeHtml(f.titulo)}</h2>
    ${f.titulo_original && f.titulo_original !== f.titulo
      ? `<p class="ficha-original">${escapeHtml(f.titulo_original)}</p>` : ''}
    <dl class="ficha-dados">
      ${dados.map(([k, v]) => `
        <div class="ficha-dado${largo(k) ? ' ficha-dado--largo' : ''}${k === 'Elenco' ? ' ficha-dado--lista' : ''}">
          <dt>${k}</dt>
          <dd>${escapeHtml(String(v))}</dd>
        </div>`).join('')}
    </dl>
    ${f.sinopse ? `<p class="ficha-sinopse">${escapeHtml(f.sinopse)}</p>` : ''}
    ${f.generos ? `<div class="ficha-generos">${f.generos.split(',')
      .map(g => `<span class="meta-tag">${escapeHtml(g.trim())}</span>`).join('')}</div>` : ''}
  `;

  // Direita: pôster, depois notas e trailer
  document.getElementById('ficha-lado').innerHTML = `
    <figure class="ficha-cartaz">
      ${f.capa_url
        ? `<img src="${escapeHtml(f.capa_url)}" alt="Capa de ${escapeHtml(f.titulo)}">`
        : `<div class="capa-ausente">
             <span class="capa-ausente-icone">📽</span>
             <span class="capa-ausente-texto">${escapeHtml(f.titulo)}</span>
           </div>`}
    </figure>

    <div class="ficha-nota">
      <span class="rating-mini-label">Minha nota</span>
      <div id="ficha-minha-nota"></div>
    </div>

    ${f.trailer_url ? `
      <button type="button" class="btn-bluray" id="ficha-trailer">
        <span class="btn-bluray-disco" aria-hidden="true">
          <svg viewBox="0 0 40 40">
            <circle class="disco-borda"  cx="20" cy="20" r="18" />
            <circle class="disco-trilha" cx="20" cy="20" r="13" />
            <circle class="disco-trilha" cx="20" cy="20" r="9.5" />
            <circle class="disco-furo"   cx="20" cy="20" r="4.5" />
            <path   class="disco-play"   d="M17.5 15.5l7 4.5-7 4.5z" />
          </svg>
        </span>
        <span class="btn-bluray-texto">
          <strong>Assistir ao trailer</strong>
          <em>Blu-ray · reprodução</em>
        </span>
      </button>` : ''}
  `;

  if (f.minha_nota) {
    renderStars(document.getElementById('ficha-minha-nota'),
                Number(f.minha_nota), 24, f.tema_estrelas || null);
  } else {
    document.getElementById('ficha-minha-nota').innerHTML =
      `<span class="ficha-sem-nota">Ainda sem nota do curador</span>`;
  }

  document.getElementById('ficha-trailer')?.addEventListener('click', () => abrirTrailer(f));

  // Embaixo: a comunidade
  document.getElementById('ficha-comunidade').innerHTML = `
    <div class="ficha-comunidade-topo">
      <span class="rating-mini-label">Quem já viu</span>
      <h3 class="ficha-nome ficha-nome--menor">Notas da comunidade</h3>
    </div>

    <div class="ficha-media" id="ficha-media" hidden>
      <div>
        <span class="rating-mini-label">Média</span>
        <div id="ficha-media-estrelas"></div>
      </div>
      <div class="ficha-media-num"><span id="ficha-media-valor"></span></div>
    </div>

    <form class="ficha-form" id="ficha-form" novalidate>
      <div class="ficha-form-linha">
        <div class="form-group">
          <label class="form-label" for="ficha-nome-campo">Seu nome</label>
          <input type="text" id="ficha-nome-campo" class="form-input" required placeholder="ex: Cinéfilo Anônimo">
        </div>
        <div class="form-group">
          <label class="form-label">Sua nota</label>
          <div id="ficha-nota-campo"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="ficha-texto">Comentário</label>
        <textarea id="ficha-texto" class="form-textarea" rows="3" placeholder="O que você achou deste filme?"></textarea>
      </div>
      <button type="submit" class="btn btn-primary" id="ficha-enviar">✦ Enviar</button>
    </form>

    <div class="ficha-lista" id="ficha-lista"></div>
  `;

  fichaNota = new StarRating(document.getElementById('ficha-nota-campo'), {
    value: 0, readOnly: false, size: 26, tema: f.tema_estrelas || null,
  });
  document.getElementById('ficha-form').addEventListener('submit', enviarComentarioFicha);
}

// ── Trailer ───────────────────────────────────────────────────
function abrirTrailer(f) {
  const modal  = document.getElementById('trailer-modal');
  const iframe = document.getElementById('trailer-iframe');
  if (!modal || !iframe || !f.trailer_url) return;

  const id = extractYouTubeId(f.trailer_url);
  iframe.src = id
    ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&enablejsapi=1&autoplay=1`
    : f.trailer_url;
  document.getElementById('trailer-modal-title').textContent = f.titulo;
  modal.style.display = 'flex';
}

function fecharTrailer() {
  const modal  = document.getElementById('trailer-modal');
  const iframe = document.getElementById('trailer-iframe');
  if (!modal || modal.style.display !== 'flex') return;
  modal.style.display = 'none';
  iframe.src = 'about:blank';
}

// ── Comentários ───────────────────────────────────────────────
async function carregarComentariosFicha(id) {
  try { renderComentariosFicha(await fetchComentarios(id)); }
  catch (err) { console.error(err); }
}

function renderComentariosFicha(comentarios) {
  const lista = document.getElementById('ficha-lista');
  const media = document.getElementById('ficha-media');
  if (!lista) return;

  const comNota = comentarios.filter(c => c.nota);
  if (comNota.length) {
    const m = comNota.reduce((s, c) => s + Number(c.nota), 0) / comNota.length;
    media.hidden = false;
    document.getElementById('ficha-media-valor').textContent = m.toFixed(1);
    renderStars(document.getElementById('ficha-media-estrelas'), m, 18,
                fichaAberta?.tema_estrelas || null);
  } else {
    media.hidden = true;
  }

  if (!comentarios.length) {
    lista.innerHTML = `<p class="ficha-vazio">Seja o primeiro a comentar</p>`;
    return;
  }

  lista.innerHTML = '';
  comentarios.forEach(c => {
    const data = new Date(c.created_at).toLocaleDateString('pt-BR',
      { day: '2-digit', month: 'short', year: 'numeric' });
    const div = document.createElement('div');
    div.className = 'rec-comentario';
    div.innerHTML = `
      <div class="rec-comentario-topo">
        <span class="rec-comentario-autor">${escapeHtml(c.nome)}</span>
        <span class="rec-comentario-data">${data}</span>
      </div>
      <div class="ficha-comentario-estrelas"></div>
      ${c.comentario ? `<p class="rec-comentario-texto">${escapeHtml(c.comentario)}</p>` : ''}`;
    lista.appendChild(div);
    if (c.nota) {
      renderStars(div.querySelector('.ficha-comentario-estrelas'),
                  Number(c.nota), 14, fichaAberta?.tema_estrelas || null);
    }
  });
}

async function enviarComentarioFicha(e) {
  e.preventDefault();
  if (!fichaAberta) return;

  const nome  = document.getElementById('ficha-nome-campo').value.trim();
  const texto = document.getElementById('ficha-texto').value.trim();
  const nota  = fichaNota?.getValue() || 0;
  const btn   = document.getElementById('ficha-enviar');

  if (!nome) { showToast('Por favor, insira seu nome.', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    await inserirComentario({ filmeId: fichaAberta.id, nome, nota: nota || null, comentario: texto || null });
    showToast('Comentário enviado!', 'success');
    e.target.reset();
    fichaNota.setValue(0);
    await carregarComentariosFicha(fichaAberta.id);
  } catch (err) {
    console.error(err);
    showToast('Erro ao enviar comentário.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✦ Enviar';
  }
}

// ── O colapso guiado pelo scroll ──────────────────────────────
// O palco fica grudado no topo; conforme a rolagem avança ele encolhe,
// sobe e some, e a área da comunidade toma a tela. Sem GSAP a ficha
// continua funcionando — só sem a transição.
function montarColapso() {
  fichaScroll?.kill();
  fichaScroll = null;

  const rolagem = document.getElementById('ficha-rolagem');
  const palco   = document.getElementById('ficha-palco');
  const scan    = document.getElementById('ficha-scan');
  const colunas = [document.getElementById('ficha-info'), document.getElementById('ficha-lado')];
  const alvos   = [...colunas, scan].filter(Boolean);

  // Abaixo de 1080px o palco deixa de ser fixo: as três partes empilham
  // e rolam junto com a página. Animar a opacidade ali abria buracos —
  // a coluna do cartaz sumia mas continuava ocupando o lugar dela, e
  // sobrava um vão vazio no meio da ficha.
  const empilhado      = window.matchMedia?.('(max-width: 1080px)').matches;
  const menosMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (empilhado || menosMovimento || !window.gsap || !window.ScrollTrigger) {
    window.gsap?.set(alvos, { clearProps: 'all' });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const linha = gsap.timeline({
    scrollTrigger: {
      scroller: rolagem,
      trigger: palco,
      start: 'top top',
      end: '+=70%',
      scrub: 0.6,
      invalidateOnRefresh: true,
    },
  });

  // As colunas laterais saem primeiro, para os lados; o scan encolhe e
  // sobe por último — assim a embalagem é a última coisa a sair de cena.
  linha
    .to(colunas[0], { xPercent: -12, autoAlpha: 0, ease: 'power2.in' }, 0)
    .to(colunas[1], { xPercent: 12,  autoAlpha: 0, ease: 'power2.in' }, 0)
    .to(scan, { scale: 0.62, yPercent: -18, autoAlpha: 0, ease: 'power2.in' }, 0.12);

  fichaScroll = linha.scrollTrigger;
  ScrollTrigger.refresh();
}

// ── Ligações ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ficha-fechar')?.addEventListener('click', () => fecharFicha());
  document.getElementById('btn-fechar-trailer')?.addEventListener('click', fecharTrailer);

  document.getElementById('trailer-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'trailer-modal') fecharTrailer();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('trailer-modal');
    if (modal?.style.display === 'flex') fecharTrailer();
    else fecharFicha();
  });

  // Girar o telefone ou redimensionar cruza o limite de 1080px, e o
  // colapso precisa ser montado ou desfeito de acordo.
  let remontar;
  window.addEventListener('resize', () => {
    if (!fichaAberta) return;
    clearTimeout(remontar);
    remontar = setTimeout(montarColapso, 180);
  });

  // Voltar do navegador fecha a ficha; avançar reabre.
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('film');
    if (id) abrirFicha(id, true);
    else fecharFicha(true);
  });
});

// Chamado pelo boot da coleção, quando a URL já traz ?film=<id>
function abrirFichaDaUrl() {
  const id = new URLSearchParams(location.search).get('film');
  if (id) abrirFicha(id, true);
}

window.abrirFicha = abrirFicha;
window.fecharFicha = fecharFicha;
