// ============================================================
// CINEMATECA PESSOAL — Estrelas de avaliação
// ============================================================
// Sempre 5 estrelas inteiras. Meia nota preenche metade do miolo da
// estrela — o contorno continua fechado, nunca aparece estrela cortada.
// O preenchimento é um gradiente com dois stops no mesmo offset, o que
// dá um corte reto e limpo dentro da forma.
//
// Cada filme pode ter um tema, que muda o material das estrelas:
//   'veludo'     azul com textura de veludo
//   'videodrome' chuvisco de TV fora de sintonia
//   'stalker'    as colinas onduladas do cartaz ilustrado
//   (padrão)     dourado da casa
// ============================================================

const CAMINHO_ESTRELA =
  'M12 2.4l2.95 5.98 6.6.96-4.775 4.655 1.127 6.573L12 17.47l-5.902 3.098 1.127-6.573L2.45 9.34l6.6-.96z';

// As colinas do cartaz do Stalker: três horizontes empilhados, do azul
// do fundo ao verde-amarelo da frente. O traçado tem período 12 e vai de
// -12 a 36, então deslizar 12 para o lado emenda sem costura.
const COLINAS_STALKER = [
  { d: 'M-12 11.5 q 3 -4 6 0 t 6 0 t 6 0 t 6 0 t 6 0 t 6 0 t 6 0 t 6 0 V24 H-12 Z',
    cor: '#7FA8C4', opacidade: 0.82, passo: 34 },
  { d: 'M-12 16 q 3 -3.4 6 0 t 6 0 t 6 0 t 6 0 t 6 0 t 6 0 t 6 0 t 6 0 V24 H-12 Z',
    cor: '#9CC0A6', opacidade: 0.8, passo: 26 },
  { d: 'M-12 20 q 3 -2.6 6 0 t 6 0 t 6 0 t 6 0 t 6 0 t 6 0 t 6 0 t 6 0 V24 H-12 Z',
    cor: '#C6CC80', opacidade: 0.78, passo: 19 },
];

let _seqEstrela = 0;

class StarRating {
  /**
   * @param {HTMLElement} container
   * @param {Object} options
   * @param {number}   options.value    - nota inicial (0 a 5, meio a meio)
   * @param {boolean}  options.readOnly - só exibição
   * @param {Function} options.onChange - callback ao escolher a nota
   * @param {number}   options.size     - lado de cada estrela em px
   * @param {string}   options.tema     - 'veludo' | 'videodrome' | 'stalker' | null
   */
  constructor(container, options = {}) {
    this.container = container;
    this.value    = options.value || 0;
    this.readOnly = options.readOnly || false;
    this.onChange = options.onChange || null;
    this.size     = options.size || 24;
    this.tema     = options.tema || null;
    this.uid      = `sr${++_seqEstrela}`;
    this.hover    = 0;

    this.render();
  }

  render() {
    this.container.className =
      `star-rating ${this.readOnly ? 'readonly' : 'interactive'}` +
      (this.tema ? ` tema-${this.tema}` : '');
    this.container.style.setProperty('--estrela-tam', `${this.size}px`);
    this.container.innerHTML = this._svg();

    this.estrelas = [...this.container.querySelectorAll('.estrela')];
    if (!this.readOnly) this._bindInteracao();
    this._pintar();
  }

  // ── SVG: defs do tema + as cinco estrelas ───────────────────
  _svg() {
    // Chuvisco e colinas vão numa camada própria por cima, e não como
    // filtro do preenchimento: filtro no preenchimento é destrutivo, e se
    // ele falha a estrela some. Assim a pior hipótese é ficar sem o
    // material — a estrela continua lá.
    const estatica = this.tema === 'videodrome';
    const colinas  = this.tema === 'stalker';

    const estrelas = [1, 2, 3, 4, 5].map(i => `
      <svg class="estrela" viewBox="0 0 24 24" aria-hidden="true">
        <path class="estrela-base" d="${CAMINHO_ESTRELA}" />
        <path class="estrela-brilho" d="${CAMINHO_ESTRELA}"
              fill="url(#${this.uid}-g${i})" />
        ${estatica ? `<path class="estrela-estatica" d="${CAMINHO_ESTRELA}"
              fill="url(#${this.uid}-g${i})" />` : ''}
        ${colinas ? `<g class="estrela-colina"
              clip-path="url(#${this.uid}-recorte)" mask="url(#${this.uid}-m${i})">
          ${COLINAS_STALKER.map(c => `<path d="${c.d}" fill="${c.cor}" opacity="${c.opacidade}">
            <animateTransform attributeName="transform" type="translate"
                              values="0 0;-12 0" dur="${c.passo}s" repeatCount="indefinite" />
          </path>`).join('')}
        </g>` : ''}
        <path class="estrela-contorno" d="${CAMINHO_ESTRELA}" />
      </svg>`).join('');

    return `
      <svg width="0" height="0" class="estrela-defs" aria-hidden="true">
        <defs>
          ${this._defsTema()}
          ${[1, 2, 3, 4, 5].map(i => `
            <linearGradient id="${this.uid}-g${i}" x1="0" y1="0" x2="1" y2="0">
              <stop class="parada-cheia"  offset="0%"   stop-color="var(--estrela-cor)" />
              <stop class="parada-vazia"  offset="0%"   stop-color="transparent" />
            </linearGradient>
            ${colinas ? `
            <linearGradient id="${this.uid}-mg${i}" x1="0" y1="0" x2="1" y2="0">
              <stop class="mascara-cheia" offset="0%" stop-color="#fff" />
              <stop class="mascara-vazia" offset="0%" stop-color="#000" />
            </linearGradient>
            <mask id="${this.uid}-m${i}">
              <rect x="0" y="0" width="24" height="24" fill="url(#${this.uid}-mg${i})" />
            </mask>` : ''}`).join('')}
        </defs>
      </svg>
      <div class="estrelas-linha">${estrelas}</div>
      ${this.readOnly ? '' : '<span class="estrela-valor" aria-live="polite"></span>'}
    `;
  }

  _defsTema() {
    if (this.tema === 'veludo') {
      // Ruído fino iluminado de lado: o pelo do veludo pegando a luz.
      return `
        <filter id="${this.uid}-veludo" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" seed="7" result="pelo" />
          <feDiffuseLighting in="pelo" surfaceScale="1.6" diffuseConstant="1.1"
                             lighting-color="#8fb4ff" result="luz">
            <feDistantLight azimuth="235" elevation="58" />
          </feDiffuseLighting>
          <feComposite in="luz" in2="SourceGraphic" operator="in" result="tecido" />
          <feBlend in="SourceGraphic" in2="tecido" mode="multiply" />
        </filter>`;
    }

    if (this.tema === 'stalker') {
      // O cartaz tem colinas empilhadas de borda limpa, e turbulência num
      // quadro de 24 unidades não faz isso — vira mancha. As ondas são
      // desenhadas mesmo, e o recorte da estrela as segura dentro da forma.
      return `
        <clipPath id="${this.uid}-recorte"><path d="${CAMINHO_ESTRELA}" /></clipPath>
        <filter id="${this.uid}-vaga" x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="2" seed="9" result="vaga" />
          <feDisplacementMap in="SourceGraphic" in2="vaga" scale="0"
                             xChannelSelector="R" yChannelSelector="G">
            <animate class="anim-vaga" attributeName="scale" values="0;7;2;0"
                     dur="1.1s" begin="indefinite" fill="freeze" />
          </feDisplacementMap>
        </filter>`;
    }

    if (this.tema === 'videodrome') {
      // Chuvisco de canal fora do ar, rolando sem parar.
      return `
        <filter id="${this.uid}-chuvisco" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.85" numOctaves="3" seed="3" result="ruido">
            <animate attributeName="seed" values="1;9;3;7;2;8;1" dur="0.7s" repeatCount="indefinite" />
          </feTurbulence>
          <feColorMatrix in="ruido" type="saturate" values="0" result="cinza" />
          <feComponentTransfer in="cinza" result="contraste">
            <feFuncA type="linear" slope="2.2" intercept="-0.35" />
          </feComponentTransfer>
          <!-- Recorta o chuvisco na forma da estrela e para por aqui: quem
               compõe com o preenchimento é o mix-blend-mode, no CSS. -->
          <feComposite in="contraste" in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="${this.uid}-derrete" x="-45%" y="-45%" width="190%" height="190%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015 0.06" numOctaves="2" seed="5" result="onda" />
          <feDisplacementMap in="SourceGraphic" in2="onda" scale="0" xChannelSelector="R" yChannelSelector="G">
            <animate class="anim-derrete" attributeName="scale" values="0;9;3;0" dur="0.75s" begin="indefinite" fill="freeze" />
          </feDisplacementMap>
        </filter>`;
    }

    return '';
  }

  // ── Interação: metade esquerda = .5, direita = inteira ──────
  _bindInteracao() {
    this.estrelas.forEach((svg, idx) => {
      svg.addEventListener('mousemove', (e) => {
        this.hover = this._valorNoPonto(svg, idx, e.clientX);
        this._pintar();
      });
      svg.addEventListener('click', (e) => {
        this.value = this._valorNoPonto(svg, idx, e.clientX);
        this.hover = 0;
        this._pintar();
        this._animarEscolha();
        this.onChange?.(this.value);
      });
    });

    this.container.addEventListener('mouseleave', () => {
      this.hover = 0;
      this._pintar();
    });

    // Teclado: a linha inteira é um slider.
    const linha = this.container.querySelector('.estrelas-linha');
    linha.tabIndex = 0;
    linha.setAttribute('role', 'slider');
    linha.setAttribute('aria-valuemin', '0');
    linha.setAttribute('aria-valuemax', '5');
    linha.addEventListener('keydown', (e) => {
      const passo = e.shiftKey ? 0.5 : 1;
      let v = this.value;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   v = Math.min(5, v + passo);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = Math.max(0, v - passo);
      else return;
      e.preventDefault();
      this.value = v;
      this._pintar();
      this._animarEscolha();
      this.onChange?.(v);
    });
  }

  _valorNoPonto(svg, idx, clientX) {
    const r = svg.getBoundingClientRect();
    const metadeEsquerda = (clientX - r.left) < r.width / 2;
    return idx + (metadeEsquerda ? 0.5 : 1);
  }

  // ── Pintura: quanto de cada estrela está preenchido ─────────
  _pintar() {
    const v = this.hover || this.value;

    this.estrelas.forEach((svg, idx) => {
      // 0 = vazia, 0.5 = metade, 1 = cheia
      const parte = Math.max(0, Math.min(1, v - idx));
      const pct = `${parte * 100}%`;

      const g = this.container.querySelector(`#${this.uid}-g${idx + 1}`);
      g.querySelector('.parada-cheia').setAttribute('offset', pct);
      g.querySelector('.parada-vazia').setAttribute('offset', pct);

      svg.classList.toggle('cheia', parte === 1);
      svg.classList.toggle('meia', parte === 0.5);
      svg.classList.toggle('vazia', parte === 0);

      // O material do tema só entra na parte acesa.
      const brilho = svg.querySelector('.estrela-brilho');
      if (this.tema === 'veludo') {
        brilho.style.filter = parte > 0 ? `url(#${this.uid}-veludo)` : '';
      } else if (this.tema === 'videodrome') {
        const estatica = svg.querySelector('.estrela-estatica');
        if (estatica) estatica.style.filter = parte > 0 ? `url(#${this.uid}-chuvisco)` : '';
      } else if (this.tema === 'stalker') {
        const mg = this.container.querySelector(`#${this.uid}-mg${idx + 1}`);
        if (mg) {
          mg.querySelector('.mascara-cheia').setAttribute('offset', pct);
          mg.querySelector('.mascara-vazia').setAttribute('offset', pct);
        }
      }
    });

    const rotulo = this.container.querySelector('.estrela-valor');
    if (rotulo) rotulo.textContent = v ? v.toFixed(1) : '—';

    const linha = this.container.querySelector('.estrelas-linha');
    linha?.setAttribute('aria-valuenow', String(this.value));
    linha?.setAttribute('aria-valuetext', `${this.value} de 5`);
    this.container.setAttribute('aria-label', `Nota: ${this.value} de 5`);
  }

  // ── Ao escolher a nota, as estrelas se deformam ─────────────
  _animarEscolha() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    this.container.classList.remove('escolhendo');
    void this.container.offsetWidth;        // reinicia a animação
    this.container.classList.add('escolhendo');
    setTimeout(() => this.container.classList.remove('escolhendo'), 800);

    // Videodrome derrete, Stalker ondula: os dois por displacement.
    this.container.querySelectorAll('.anim-derrete, .anim-vaga').forEach(a => {
      try { a.beginElement(); } catch { /* navegador sem SMIL */ }
    });
  }

  setValue(v) {
    this.value = v || 0;
    this.hover = 0;
    this._pintar();
  }

  getValue() { return this.value; }
}

// ============================================================
// Helper: estrelas só de exibição
// ============================================================
function renderStars(container, value, size = 20, tema = null) {
  return new StarRating(container, { value, readOnly: true, size, tema });
}

window.StarRating  = StarRating;
window.renderStars = renderStars;
