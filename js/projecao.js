// ============================================================
// CINEMATECA PESSOAL — Transição de projeção 35mm
// ============================================================
// Ao abrir a ficha de um filme, a tela vira um projetor: a fita corre,
// o obturador pisca e o facho de luz abre. Só depois a navegação acontece.
//
// Tudo em CSS/canvas 2D — nada de WebGL, para não competir com as capas 3D.
// Respeita prefers-reduced-motion: quem pediu menos animação vai direto.
// ============================================================

const DURACAO = 1100;   // ms até a navegação
const CHAVE_ENTRADA = 'cinemateca_projetando';

function querMenosMovimento() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Dispara no próximo quadro — mas sem depender só do rAF, que fica
// congelado em aba de segundo plano. Sem isso a classe que inicia a
// animação poderia nunca ser aplicada, e a tela ficaria parada.
function noProximoQuadro(fn) {
  let feito = false;
  const uma = () => { if (feito) return; feito = true; fn(); };
  requestAnimationFrame(uma);
  setTimeout(uma, 60);
}

// ── Saída: roda a projeção e então navega ────────────────────
function projetarE(destino) {
  if (querMenosMovimento()) { window.location.href = destino; return; }

  // Marca para a próxima página abrir com o facho de luz.
  try { sessionStorage.setItem(CHAVE_ENTRADA, '1'); } catch {}

  const tela = montarTela();
  document.body.appendChild(tela);
  document.body.style.overflow = 'hidden';

  noProximoQuadro(() => tela.classList.add('projetando'));
  setTimeout(() => { window.location.href = destino; }, DURACAO);
}

function montarTela() {
  const el = document.createElement('div');
  el.className = 'projecao-35mm';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="projecao-fita">
      <div class="projecao-perfuracoes esquerda"></div>
      <div class="projecao-quadros">
        <div class="projecao-quadro"></div>
        <div class="projecao-quadro"></div>
        <div class="projecao-quadro"></div>
        <div class="projecao-quadro"></div>
      </div>
      <div class="projecao-perfuracoes direita"></div>
    </div>
    <div class="projecao-contagem">
      <svg viewBox="0 0 100 100" class="projecao-alvo">
        <circle cx="50" cy="50" r="46" />
        <circle cx="50" cy="50" r="30" />
        <line x1="50" y1="0" x2="50" y2="100" />
        <line x1="0" y1="50" x2="100" y2="50" />
        <path class="projecao-varredura" d="M50 50 L50 4 A46 46 0 0 1 50 96 Z" />
      </svg>
      <span class="projecao-numero">3</span>
    </div>
    <div class="projecao-grao"></div>
    <div class="projecao-facho"></div>
  `;

  // Contagem regressiva 3 → 2 → 1, no ritmo da fita.
  const numero = el.querySelector('.projecao-numero');
  let n = 3;
  const passo = setInterval(() => {
    n -= 1;
    if (n < 1) { clearInterval(passo); return; }
    numero.textContent = String(n);
  }, DURACAO / 3.4);

  return el;
}

// ── Entrada: a página que abre acende o projetor ─────────────
function acenderProjetor() {
  let veio;
  try {
    veio = sessionStorage.getItem(CHAVE_ENTRADA) === '1';
    sessionStorage.removeItem(CHAVE_ENTRADA);
  } catch { veio = false; }

  if (!veio || querMenosMovimento()) return;

  const flash = document.createElement('div');
  flash.className = 'projecao-abertura';
  flash.setAttribute('aria-hidden', 'true');
  document.body.appendChild(flash);
  noProximoQuadro(() => flash.classList.add('abrindo'));
  setTimeout(() => flash.remove(), 900);
}

// ── Intercepta os links que levam à ficha de um filme ────────
// Delegação: pega inclusive os cards criados depois pelo JS.
function interceptarLinksDeFilme() {
  document.addEventListener('click', (e) => {
    // Deixa passar clique do meio, ctrl/cmd+clique e afins.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const alvo = e.target.closest('a[href^="filme.html"], [data-filme-id]');
    if (!alvo) return;
    if (alvo.target === '_blank') return;

    const destino = alvo.tagName === 'A'
      ? alvo.getAttribute('href')
      : `filme.html?id=${encodeURIComponent(alvo.dataset.filmeId)}`;

    e.preventDefault();
    e.stopPropagation();
    projetarE(destino);
  }, true);   // fase de captura: chega antes do handler do card
}

document.addEventListener('DOMContentLoaded', () => {
  acenderProjetor();
  interceptarLinksDeFilme();
});

window.projetarE = projetarE;
