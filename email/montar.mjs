// ============================================================
// CINEMATECA PESSOAL — montar.mjs
// ============================================================
// Preenche nova-recomendacao.html com um filme e um inscrito.
//
// ESM puro, sem nada do Node: serve tanto ao preview.mjs quanto ao
// navegador. A Edge Function repete esta lógica em TypeScript, porque
// o bundler do Deno não alcança arquivos fora de supabase/functions —
// se mexer aqui, mexa lá também.
// ============================================================

const MARCA_INICIO = '<!-- INGRESSO:INICIO';
const MARCA_FIM    = '<!-- INGRESSO:FIM -->';

export function escapar(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Um link só entra no e-mail se for http(s): javascript: e data: num
// href são a porta de entrada mais óbvia para conteúdo de terceiros.
export function urlSegura(u, reserva = '#') {
  try {
    const p = new URL(String(u));
    return (p.protocol === 'https:' || p.protocol === 'http:') ? p.href : reserva;
  } catch {
    return reserva;
  }
}

function trocar(html, valores) {
  return Object.entries(valores).reduce(
    (acc, [chave, valor]) => acc.split('{{' + chave + '}}').join(valor),
    html);
}

/**
 * @param {string} modelo   conteúdo de nova-recomendacao.html
 * @param {object} rec      linha da tabela recomendacoes
 * @param {object} fontes   [{ plataforma, url, obs }]
 * @param {object} inscrito { nome, token }
 * @param {string} urlSite  endereço público do site, sem barra no fim
 * @param {string} urlDescadastro  endpoint que desliga a inscrição pelo token
 */
export function montarEmail({ modelo, rec, fontes = [], inscrito = {}, urlSite, urlDescadastro }) {
  const site = urlSite.replace(/\/+$/, '');

  // O bloco do ingresso é recortado do próprio modelo e repetido: assim
  // o arquivo continua abrindo sozinho no navegador, com um ingresso
  // de exemplo à mostra.
  const i = modelo.indexOf(MARCA_INICIO);
  const f = modelo.indexOf(MARCA_FIM);
  if (i === -1 || f === -1) throw new Error('Modelo sem as marcas INGRESSO:INICIO/FIM');

  const abertura = modelo.slice(0, i);
  const molde    = modelo.slice(modelo.indexOf('-->', i) + 3, f);
  const fecho    = modelo.slice(f + MARCA_FIM.length);

  const ingressos = fontes.map((fonte, n) => trocar(molde, {
    INGRESSO_URL:        escapar(urlSegura(fonte.url, site + '/recomendacoes.html')),
    INGRESSO_PLATAFORMA: escapar(fonte.plataforma || 'Assistir'),
    INGRESSO_NUM:        String(n + 1).padStart(3, '0'),
    // O <br> vem daqui e não do modelo: sem observação, o modelo
    // deixaria uma linha vazia embaixo do nome da plataforma.
    INGRESSO_OBS: fonte.obs
      ? '<br /><span style="font-family:\'Geist Mono\',Courier,monospace;font-size:9px;'
        + 'letter-spacing:1.6px;text-transform:uppercase;color:#F9CFC4;">'
        + escapar(fonte.obs) + '</span>'
      : '',
  })).join('');

  const fichaUrl = site + '/recomendacoes.html?rec=' + encodeURIComponent(rec.id || '');

  return trocar(abertura + ingressos + fecho, {
    TITULO:          escapar(rec.titulo),
    TITULO_ORIGINAL: escapar(rec.titulo_original && rec.titulo_original !== rec.titulo
                             ? rec.titulo_original : ''),
    ANO:             escapar(rec.ano || '—'),
    DIRETOR:         escapar(rec.diretor || '—'),
    PAIS:            escapar(rec.pais || '—'),
    DURACAO:         escapar(rec.duracao ? rec.duracao + ' min' : '—'),
    SINOPSE:         escapar(rec.sinopse || ''),
    CAPA_URL:        escapar(urlSegura(rec.capa_url, site + '/assets/sem-cartaz.png')),
    SEMANA:          escapar(formatarSemana(rec.semana)),
    URL_SITE:        escapar(site),
    URL_FICHA:       escapar(fichaUrl),
    // Sair da lista é um UPDATE, e a RLS não deixa o navegador fazer
    // isso — quem atende é a Edge Function "sair", pelo token.
    URL_DESCADASTRO: escapar(
      (urlDescadastro || site) + '?t=' + encodeURIComponent(inscrito.token || '')),
    NOME:            escapar(inscrito.nome || 'você'),
  });
}

export function formatarSemana(iso) {
  if (!iso) return 'programação atual';
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return 'programação atual';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
