// ============================================================
// CINEMATECA PESSOAL — 3D GLB Viewer
// ============================================================
// Módulo ES. Carregado por filme.html via <script type="module">
// com um import map apontando "three" e "three/addons/" para o CDN.
//
// Os loaders e controles vivem em examples/jsm desde o r148 — não
// existe mais THREE.GLTFLoader nem THREE.OrbitControls no bundle
// global, por isso esta página não usa mais o three.min.js clássico.
// ============================================================

import * as THREE from 'three';
import { GLTFLoader }   from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }  from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { criarCaixaEmbalagem, iluminacaoCinematica } from './caixa3d.js';

export class Viewer3D {
  /**
   * @param {HTMLElement} container
   * @param {Object} options
   * @param {string}  options.glbUrl          - Caminho do arquivo GLB (ex: assets/modelos3d/stalker.glb)
   * @param {string}  options.capaUrl         - URL da capa (frente) — fallback se sem GLB
   * @param {string}  options.capaTraseiraUrl  - URL da capa traseira — fallback
   * @param {string}  options.titulo           - Título do filme
   * @param {string}  options.formato          - 'bluray' | 'dvd'
   * @param {string}  options.corSpine         - Cor hex da lombada (fallback)
   */
  constructor(container, options = {}) {
    this.container = container;
    this.opts = Object.assign({
      glbUrl: null,
      capaUrl: null,
      capaTraseiraUrl: null,
      titulo: 'Filme',
      formato: 'dvd',
      corSpine: '#1a1a1a',
    }, options);

    try {
      this._init();
    } catch (err) {
      console.error('[Viewer3D] Falha ao inicializar:', err);
      this._showFallback('Não foi possível iniciar o 3D');
    }
  }

  // ── Inicializa a cena Three.js ───────────────────────────
  _init() {
    const w = this.container.clientWidth  || 300;
    const h = this.container.clientHeight || 400;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES esquentava a imagem, e o amarelado era justamente a queixa.
    // Linear não desloca matiz nenhum; a exposição levanta as sombras.
    // (NeutralToneMapping só existe do r162 em diante, e estamos no r160.)
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.container.appendChild(this.renderer.domElement);

    // Cena
    this.scene = new THREE.Scene();

    // Câmera
    this.camera = new THREE.PerspectiveCamera(40, w / h, 0.01, 1000);
    this.camera.position.set(0, 0, 5);

    this._setupLighting();
    this._setupControls();

    // Resize observer
    this._ro = new ResizeObserver(() => this._onResize());
    this._ro.observe(this.container);

    // Carrega GLB ou fallback
    if (this.opts.glbUrl) {
      this._loadGLB(this.opts.glbUrl);
    } else {
      this._buildBoxFallback();
    }

    this._animate();
  }

  // ── Iluminação cinemática ────────────────────────────────
  _setupLighting() {
    iluminacaoCinematica(this.scene);

    // Chão só para receber a sombra do modelo.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.18 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this._ground = ground;
  }

  // ── Controles orbitais ────────────────────────────────────
  _setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping  = true;
    this.controls.dampingFactor  = 0.05;
    this.controls.enableZoom     = true;
    this.controls.enablePan      = false;
    this.controls.autoRotate     = true;
    this.controls.autoRotateSpeed = 1.5;
    this.controls.minPolarAngle  = Math.PI / 3;
    this.controls.maxPolarAngle  = Math.PI * 2 / 3;

    // Ao arrastar, pausa a rotação automática; retoma alguns segundos depois.
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false;
      clearTimeout(this._autoTimer);
    });
    this.controls.addEventListener('end', () => {
      this._autoTimer = setTimeout(() => { this.controls.autoRotate = true; }, 2500);
    });
  }

  // ── Carrega arquivo GLB ───────────────────────────────────
  _loadGLB(url) {
    this._showLoading();

    // DRACOLoader para modelos comprimidos (Polycam, Scaniverse, Blender…)
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.setDecoderConfig({ type: 'js' });

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      url,
      (gltf) => {
        this._hideLoading();
        this._processModel(gltf.scene);
        dracoLoader.dispose();
      },
      (progress) => {
        if (progress.lengthComputable) {
          this._updateLoadingProgress(Math.round((progress.loaded / progress.total) * 100));
        }
      },
      (error) => {
        console.warn('[Viewer3D] Erro ao carregar GLB:', error);
        this._hideLoading();
        dracoLoader.dispose();
        // Fallback gracioso: constrói o box 3D com a capa
        this._buildBoxFallback();
      }
    );
  }

  // ── Processa e centraliza o modelo carregado ─────────────
  _processModel(model) {
    model.traverse((node) => {
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      // Garante que as texturas sejam interpretadas em sRGB
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach(m => { if (m && m.map) m.map.colorSpace = THREE.SRGBColorSpace; });
    });

    // Centraliza pelo bounding box
    const box    = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    // Enquadra a câmera no modelo
    const maxDim  = Math.max(size.x, size.y, size.z) || 1;
    const fov     = this.camera.fov * (Math.PI / 180);
    const camDist = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.8;

    this.camera.position.set(0, size.y * 0.05, camDist);
    this.camera.near = camDist / 100;
    this.camera.far  = camDist * 10;
    this.camera.updateProjectionMatrix();

    // O chão acompanha a base do modelo, senão a sombra flutua.
    if (this._ground) this._ground.position.y = -size.y / 2;

    // Limita o zoom a uma faixa proporcional ao tamanho do modelo
    this.controls.minDistance = camDist * 0.4;
    this.controls.maxDistance = camDist * 3;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // Pose inicial de 3/4 (mostra frente e lado)
    this.modelGroup = new THREE.Group();
    this.modelGroup.add(model);
    this.modelGroup.rotation.y = -0.4;
    this.modelGroup.rotation.x = 0.1;
    this.scene.add(this.modelGroup);
  }

  // ── Fallback: a embalagem montada em geometria, com a capa ──
  _buildBoxFallback() {
    const { mesh, dim } = criarCaixaEmbalagem({
      formato:         this.opts.formato,
      titulo:          this.opts.titulo,
      capaUrl:         this.opts.capaUrl,
      capaTraseiraUrl: this.opts.capaTraseiraUrl,
      corSpine:        this.opts.corSpine,
    });

    this.modelGroup = new THREE.Group();
    this.modelGroup.add(mesh);
    this.modelGroup.rotation.y = -0.4;
    this.modelGroup.rotation.x = 0.1;
    this.scene.add(this.modelGroup);

    if (this._ground) this._ground.position.y = -dim.h / 2;

    this.camera.position.set(0, 0, 4);
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 8;
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  // ── Loop de animação ─────────────────────────────────────
  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());
    this.controls.update();          // damping + autoRotate
    this.renderer.render(this.scene, this.camera);
  }

  // ── Loading overlay ──────────────────────────────────────
  _showLoading() {
    this._loadingEl = document.createElement('div');
    this._loadingEl.style.cssText = `
      position:absolute; inset:0;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      background: linear-gradient(135deg, #0D0A11, #17131C);
      color: #C89543;
      font-family: 'Geist Mono', ui-monospace, monospace;
      font-size: 0.65rem;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      gap: 12px;
      z-index: 10;
    `;
    this._loadingEl.innerHTML = `
      <div style="width:40px;height:40px;border:3px solid #3A2E45;border-top-color:#C89543;border-radius:50%;animation:spin3d 0.8s linear infinite"></div>
      <div class="loading-pct">Carregando modelo...</div>
      <style>@keyframes spin3d{to{transform:rotate(360deg)}}</style>
    `;
    this.container.style.position = 'relative';
    this.container.appendChild(this._loadingEl);
  }

  _updateLoadingProgress(pct) {
    const el = this._loadingEl?.querySelector('.loading-pct');
    if (el) el.textContent = `Carregando... ${pct}%`;
  }

  _hideLoading() {
    if (!this._loadingEl) return;
    const el = this._loadingEl;
    this._loadingEl = null;
    el.style.transition = 'opacity 0.4s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }

  // ── Resize ───────────────────────────────────────────────
  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ── Destruir ─────────────────────────────────────────────
  destroy() {
    cancelAnimationFrame(this._rafId);
    clearTimeout(this._autoTimer);
    this._ro?.disconnect();
    this.controls?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
  }

  // ── Fallback de erro ─────────────────────────────────────
  _showFallback(msg) {
    this.container.innerHTML = `
      <div style="
        width:100%; height:100%; min-height:200px;
        display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        background: linear-gradient(135deg, #17131C, #241C2B);
        color: #C89543; font-family: 'Geist Mono', ui-monospace, monospace;
        font-size:0.7rem; letter-spacing:0.2em; text-transform:uppercase;
        gap:12px; border:2px solid #9A7130;
      ">
        <div style="font-size:3rem">📦</div>
        <div>${this.opts.titulo}</div>
        <div style="color:#8a7260;font-size:0.6rem">${msg}</div>
      </div>`;
  }
}

// Expõe no window para os scripts clássicos das páginas.
window.Viewer3D = Viewer3D;
