// ============================================================
// CINEMATECA PESSOAL — Caixa 3D da embalagem
// ============================================================
// Monta um Blu-ray/DVD tridimensional com a capa aplicada nas faces
// e a cor da lombada. Usado em dois lugares:
//   - js/capa3d.js    nos cards da coleção
//   - js/viewer3d.js  como fallback quando não há scan .glb
// ============================================================

import * as THREE from 'three';

// Proporções reais das embalagens, em unidades de cena.
const DIMENSOES = {
  bluray: { w: 1.20, h: 1.72, d: 0.13 },
  dvd:    { w: 1.35, h: 1.90, d: 0.14 },
};

export function dimensoesDe(formato) {
  return DIMENSOES[formato] || DIMENSOES.dvd;
}

/**
 * @param {Object} opts
 * @param {string} opts.formato          'bluray' | 'dvd'
 * @param {string} opts.titulo           usado na lombada e no placeholder
 * @param {string} opts.capaUrl          capa da frente
 * @param {string} opts.capaTraseiraUrl  capa do verso
 * @param {string} opts.corSpine         hex da lombada
 * @param {Function} opts.aoCarregarTextura  chamado quando uma capa termina de carregar
 * @returns {{ mesh: THREE.Mesh, dim: {w:number,h:number,d:number} }}
 */
export function criarCaixaEmbalagem(opts = {}) {
  const {
    formato = 'dvd',
    titulo = 'Filme',
    capaUrl = null,
    capaTraseiraUrl = null,
    corSpine = '#1a1a1a',
    aoCarregarTextura = null,
  } = opts;

  const dim = dimensoesDe(formato);
  const geo = new THREE.BoxGeometry(dim.w, dim.h, dim.d);
  const loader = new THREE.TextureLoader();

  const lateral = new THREE.MeshLambertMaterial({ color: new THREE.Color(corSpine) });

  // Ordem das faces na BoxGeometry: +x, -x, +y, -y, +z, -z
  const materiais = [
    new THREE.MeshLambertMaterial({ map: texturaLombada(dim, titulo, corSpine) }),
    lateral, lateral, lateral,
    materialDeFace(loader, capaUrl, 'frente', titulo, aoCarregarTextura),
    materialDeFace(loader, capaTraseiraUrl, 'verso', titulo, aoCarregarTextura),
  ];

  const mesh = new THREE.Mesh(geo, materiais);
  mesh.castShadow = true;
  return { mesh, dim };
}

// ── Lombada: cor sólida com o título na vertical ──────────────
function texturaLombada(dim, titulo, corSpine) {
  const canvas = document.createElement('canvas');
  canvas.width  = 64;
  canvas.height = Math.round((dim.h / dim.d) * 64);

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = corSpine;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(32, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#e8dec8';
  ctx.font = 'bold 14px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(titulo.length > 20 ? titulo.substring(0, 18) + '…' : titulo, 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Frente / verso: a capa, ou um placeholder desenhado ───────
function materialDeFace(loader, url, lado, titulo, aoCarregar) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });

  if (url) {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mat.map = tex;
        mat.needsUpdate = true;
        aoCarregar?.();
      },
      undefined,
      () => {                        // 404, CORS, link quebrado…
        mat.map = texturaPlaceholder(lado, titulo);
        mat.needsUpdate = true;
        aoCarregar?.();
      }
    );
  } else {
    mat.map = texturaPlaceholder(lado, titulo);
  }

  return mat;
}

function texturaPlaceholder(lado, titulo) {
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 600;
  const ctx = canvas.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 400, 600);
  g.addColorStop(0, '#1a0805');
  g.addColorStop(1, lado === 'frente' ? '#3d1508' : '#0f0603');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 400, 600);

  ctx.strokeStyle = '#c8a050';
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 376, 576);

  ctx.fillStyle = '#c8a050';
  ctx.font = 'bold 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const palavras = titulo.split(' ');
  let linha = '', linhas = [];
  palavras.forEach(p => {
    const t = linha + (linha ? ' ' : '') + p;
    if (ctx.measureText(t).width > 340 && linha) { linhas.push(linha); linha = p; }
    else linha = t;
  });
  if (linha) linhas.push(linha);

  const y0 = 300 - ((linhas.length - 1) * 36) / 2;
  linhas.forEach((l, i) => ctx.fillText(l, 200, y0 + i * 36));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Iluminação ────────────────────────────────────────────────
// Neutra de propósito. A versão anterior usava uma luz de preenchimento
// dourada que tingia tudo de amarelo — a arte da capa precisa aparecer na
// cor que ela tem de verdade, como numa mesa de fotografia de produto.
export function iluminacaoCinematica(scene, { comSombra = true } = {}) {
  // Céu branco + rebote quente do chão: sombras vivas em vez de pretas.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9cfbe, 0.95));

  const key = new THREE.DirectionalLight(0xffffff, 1.75);
  key.position.set(3.5, 5, 4.5);
  key.castShadow = comSombra;
  if (comSombra) {
    key.shadow.mapSize.width  = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.bias = -0.0008;
  }
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.7);
  fill.position.set(-4.5, 1.5, 3);
  scene.add(fill);

  // Só o contorno mantém um toque quente, para não ficar clínico.
  const rim = new THREE.DirectionalLight(0xfff2e0, 0.55);
  rim.position.set(0, 1.5, -4.5);
  scene.add(rim);

  return key;
}
