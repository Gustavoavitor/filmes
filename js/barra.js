// ============================================================
// CINEMATECA PESSOAL — barra.js
// ============================================================
// A barra de navegação é fixa no centro inferior, então ela cobre
// o conteúdo enquanto se lê. Descendo, ela sai de cena; subindo,
// volta. Perto do topo fica sempre visível.
// ============================================================

(function () {
  const barra = document.querySelector('.barra-marquise');
  if (!barra) return;

  const OCULTA  = 'barra-marquise--oculta';
  const RUIDO   = 8;    // px: tremida de scroll não conta como direção
  const SOLTA   = 120;  // px: acima disso a barra não se esconde

  let ultimo   = window.scrollY;
  let agendado = false;

  function avaliar() {
    agendado = false;
    const y = window.scrollY;

    if (y < SOLTA) {
      barra.classList.remove(OCULTA);
      ultimo = y;
      return;
    }

    const passo = y - ultimo;
    if (Math.abs(passo) < RUIDO) return;
    ultimo = y;
    barra.classList.toggle(OCULTA, passo > 0);
  }

  window.addEventListener('scroll', () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(avaliar);
  }, { passive: true });
})();
