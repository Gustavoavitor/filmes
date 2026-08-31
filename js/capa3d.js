// ============================================================
// CINEMATECA PESSOAL — Capas 3D na grade da coleção
// ============================================================
// Cada card mostra a embalagem em 3D em vez de uma imagem chapada.
//
// O navegador só mantém ~16 contextos WebGL vivos ao mesmo tempo; passar
// disso faz o mais antigo ser descartado e o canvas ficar preto. Por isso
// aqui só existem capas para os cards visíveis, com um teto rígido, e as
// que saem da tela são destruídas para devolver o contexto.
// ============================================================

import * as THREE from 'three';
import { criarCaixaEmbalagem, iluminacaoCinematica } from './caixa3d.js';

const MAX_ATIVAS = 8;          // teto de contextos WebGL simultâneos
const VEL_ROTACAO = 0.0035;    // rad/quadro da rotação lenta
const POSE_INICIAL = { y: -0.5, x: 0.12 };

class Capa3D {
  constructor(container, opts) {
    this.container = container;
    this.opts = opts;
    this.destruida = false;
    this.hover = false;
    this.alvoY = POSE_INICIAL.y;
    this.alvoX = POSE_INICIAL.x;

    const w = container.clientWidth  || 200;
    const h = container.clientHeight || 300;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    iluminacaoCinematica(this.scene, { comSombra: false });

    this.camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 4.2);

    const { mesh } = criarCaixaEmbalagem({
      ...opts,
      aoCarregarTextura: () => { this.precisaRender = true; },
    });

    this.grupo = new THREE.Group();
    this.grupo.add(mesh);
    this.grupo.rotation.y = POSE_INICIAL.y;
    this.grupo.rotation.x = POSE_INICIAL.x;
    this.scene.add(this.grupo);

    this._bindMouse();
    this._animar();
  }

  // Inclina seguindo o mouse enquanto o cursor está sobre o card.
  _bindMouse() {
    const card = this.container.closest('.film-card') || this.container;

    this._onEnter = () => { this.hover = true; };
    this._onLeave = () => {
      this.hover = false;
      this.alvoX = POSE_INICIAL.x;
    };
    this._onMove = (e) => {
      if (!this.hover) return;
      const r = this.container.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width  - 0.5;   // -0.5 … 0.5
      const ny = (e.clientY - r.top)  / r.height - 0.5;
      this.alvoY = POSE_INICIAL.y + nx * 1.4;
      this.alvoX = POSE_INICIAL.x + ny * 0.7;
    };

    card.addEventListener('mouseenter', this._onEnter);
    card.addEventListener('mouseleave', this._onLeave);
    card.addEventListener('mousemove',  this._onMove);
    this._card = card;
  }

  _animar() {
    if (this.destruida) return;
    this._raf = requestAnimationFrame(() => this._animar());

    // Sem o mouse em cima, gira devagar sozinha.
    if (!this.hover) this.alvoY += VEL_ROTACAO;

    const g = this.grupo;
    g.rotation.y += (this.alvoY - g.rotation.y) * 0.09;
    g.rotation.x += (this.alvoX - g.rotation.x) * 0.09;

    this.renderer.render(this.scene, this.camera);
  }

  redimensionar() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h || this.destruida) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  destruir() {
    if (this.destruida) return;
    this.destruida = true;
    cancelAnimationFrame(this._raf);

    this._card.removeEventListener('mouseenter', this._onEnter);
    this._card.removeEventListener('mouseleave', this._onLeave);
    this._card.removeEventListener('mousemove',  this._onMove);

    this.scene.traverse(n => {
      if (!n.isMesh) return;
      n.geometry?.dispose();
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach(m => { m?.map?.dispose(); m?.dispose(); });
    });

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

// ── Gerenciador: liga e desliga capas conforme a rolagem ──────
// A escolha de quem fica ligado é feita por posição na tela, e não por
// IntersectionObserver: além de funcionar em qualquer navegador, deixa a
// decisão determinística — as MAX_ATIVAS capas mais próximas do centro da
// janela ganham contexto, o resto é descartado. Isso evita o vaivém que
// um pool por ordem de chegada provocaria ao rolar.
const MARGEM = 200;   // px além da janela que ainda contam como "visível"

class GaleriaCapas3D {
  constructor() {
    this.itens = new Map();   // container -> { opts, capa }
    this.ativas = new Set();

    this._agendarRevisao = throttleRaf(() => this._revisar());
    window.addEventListener('scroll', this._agendarRevisao, { passive: true });
    window.addEventListener('resize', () => {
      this.ativas.forEach(c => this.itens.get(c)?.capa?.redimensionar());
      this._agendarRevisao();
    }, { passive: true });
  }

  registrar(container, opts) {
    this.itens.set(container, { opts, capa: null });
    this._agendarRevisao();
  }

  _revisar() {
    // Em alguns contextos embutidos innerHeight vem 0. Nesse caso não dá
    // para saber o que está na tela, então liga tudo (até o teto) em vez
    // de não ligar nada.
    const altura = window.innerHeight || document.documentElement.clientHeight || 0;
    const semMedida = altura === 0;
    const meio = altura / 2;

    const visiveis = [];
    this.itens.forEach((item, container) => {
      const r = container.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      const naTela = semMedida ||
                     (r.bottom > -MARGEM && r.top < altura + MARGEM);
      if (naTela) visiveis.push({ container, dist: Math.abs((r.top + r.bottom) / 2 - meio) });
    });

    // Mais perto do centro da janela primeiro.
    visiveis.sort((a, b) => a.dist - b.dist);
    const querem = new Set(visiveis.slice(0, MAX_ATIVAS).map(v => v.container));

    this.ativas.forEach(c => { if (!querem.has(c)) this._desativar(c); });
    querem.forEach(c => this._ativar(c));
  }

  _ativar(container) {
    const item = this.itens.get(container);
    if (!item || item.capa) return;

    try {
      item.capa = new Capa3D(container, item.opts);
      this.ativas.add(container);
      container.classList.add('capa3d-pronta');
    } catch (err) {
      // WebGL indisponível ou contextos esgotados: fica o pôster 2D do HTML.
      console.warn('[capa3d] não foi possível criar a capa 3D:', err);
      this.itens.delete(container);
    }
  }

  _desativar(container) {
    const item = this.itens.get(container);
    if (!item?.capa) return;
    item.capa.destruir();
    item.capa = null;
    container.classList.remove('capa3d-pronta');
    this.ativas.delete(container);
  }

  limpar() {
    [...this.itens.keys()].forEach(c => this._desativar(c));
    this.itens.clear();
    this.ativas.clear();
  }
}

// Junta rajadas de scroll num único quadro.
// Aba em segundo plano congela o requestAnimationFrame, e aí a primeira
// revisão nunca aconteceria; por isso um setTimeout corre em paralelo e
// vale quem chegar primeiro.
function throttleRaf(fn) {
  let agendado = false;
  const executar = () => {
    if (!agendado) return;
    agendado = false;
    fn();
  };
  return () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(executar);
    setTimeout(executar, 120);
  };
}

// Instância única para a página inteira.
window.galeriaCapas3D = new GaleriaCapas3D();
window.suporteWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
})();
