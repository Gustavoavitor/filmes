// ============================================================
// CINEMATECA PESSOAL — Edge Function: enviar-recomendacao
// ============================================================
// Manda a recomendação da semana para quem está na lista.
//
// Roda no servidor porque precisa de duas coisas que o navegador não
// pode ter: a service_role (para ler newsletter_inscritos, que não tem
// policy de SELECT) e a chave do provedor de e-mail.
//
//   POST /functions/v1/enviar-recomendacao
//   Authorization: Bearer <SERVICE_ROLE_KEY>
//   { "recomendacaoId": "<uuid>", "teste": "voce@exemplo.com" }
//
// Com "teste", manda só para aquele endereço — vale conferir antes de
// disparar para todo mundo.
//
// Segredos (supabase secrets set):
//   RESEND_API_KEY   chave do provedor de e-mail
//   REMETENTE        ex: Cinemateca Pessoal <ola@seudominio.com>
//   URL_SITE         ex: https://filmes-five-theta.vercel.app
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const REMETENTE      = Deno.env.get('REMETENTE') ?? 'Cinemateca Pessoal <onboarding@resend.dev>';
const URL_SITE       = (Deno.env.get('URL_SITE') ?? '').replace(/\/+$/, '');
const URL_SAIR       = `${SUPABASE_URL}/functions/v1/sair`;

type Fonte = { plataforma?: string; url?: string; obs?: string };

// ── As mesmas transformações do email/montar.mjs ─────────────
// Ficam repetidas aqui porque o bundler do Deno só empacota o que está
// dentro de supabase/functions. Se mexer em uma, mexa na outra.

const escapar = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function urlSegura(u: unknown, reserva: string) {
  try {
    const p = new URL(String(u));
    return (p.protocol === 'https:' || p.protocol === 'http:') ? p.href : reserva;
  } catch {
    return reserva;
  }
}

const trocar = (html: string, valores: Record<string, string>) =>
  Object.entries(valores).reduce(
    (acc, [chave, valor]) => acc.split(`{{${chave}}}`).join(valor), html);

function formatarSemana(iso: string | null) {
  if (!iso) return 'programação atual';
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? 'programação atual'
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Lê onde_assistir e, por retrocompatibilidade, drive_url e trailer_url —
// a mesma ordem que a ficha usa no site.
function fontesDe(rec: Record<string, unknown>): Fonte[] {
  const lista: Fonte[] = [];
  let json = rec.onde_assistir as unknown;
  if (typeof json === 'string') { try { json = JSON.parse(json); } catch { json = null; } }
  if (Array.isArray(json)) {
    for (const f of json as Fonte[]) {
      if (f?.url) lista.push({ plataforma: f.plataforma || 'Assistir', url: f.url, obs: f.obs || '' });
    }
  }
  if (rec.drive_url && !lista.some(f => f.url === rec.drive_url)) {
    lista.push({ plataforma: 'Google Drive', url: String(rec.drive_url), obs: '' });
  }
  if (rec.trailer_url && !lista.some(f => f.url === rec.trailer_url)) {
    lista.push({ plataforma: 'Trailer', url: String(rec.trailer_url), obs: 'apenas o trailer' });
  }
  return lista;
}

function montarEmail(
  modelo: string,
  rec: Record<string, unknown>,
  fontes: Fonte[],
  inscrito: { nome?: string | null; token?: string | null },
) {
  const i = modelo.indexOf('<!-- INGRESSO:INICIO');
  const f = modelo.indexOf('<!-- INGRESSO:FIM -->');
  if (i === -1 || f === -1) throw new Error('Modelo sem as marcas INGRESSO:INICIO/FIM');

  const molde = modelo.slice(modelo.indexOf('-->', i) + 3, f);

  const ingressos = fontes.map((fonte, n) => trocar(molde, {
    INGRESSO_URL:        escapar(urlSegura(fonte.url, `${URL_SITE}/recomendacoes.html`)),
    INGRESSO_PLATAFORMA: escapar(fonte.plataforma || 'Assistir'),
    INGRESSO_NUM:        String(n + 1).padStart(3, '0'),
    INGRESSO_OBS: fonte.obs
      ? `<br /><span style="font-family:'Geist Mono',Courier,monospace;font-size:9px;`
        + `letter-spacing:1.6px;text-transform:uppercase;color:#F9CFC4;">${escapar(fonte.obs)}</span>`
      : '',
  })).join('');

  const corpo = modelo.slice(0, i) + ingressos + modelo.slice(f + '<!-- INGRESSO:FIM -->'.length);

  return trocar(corpo, {
    TITULO:          escapar(rec.titulo),
    TITULO_ORIGINAL: escapar(rec.titulo_original && rec.titulo_original !== rec.titulo
                             ? rec.titulo_original : ''),
    ANO:             escapar(rec.ano ?? '—'),
    DIRETOR:         escapar(rec.diretor ?? '—'),
    PAIS:            escapar(rec.pais ?? '—'),
    DURACAO:         escapar(rec.duracao ? `${rec.duracao} min` : '—'),
    SINOPSE:         escapar(rec.sinopse ?? ''),
    CAPA_URL:        escapar(urlSegura(rec.capa_url, `${URL_SITE}/assets/sem-cartaz.png`)),
    SEMANA:          escapar(formatarSemana(rec.semana as string | null)),
    URL_SITE:        escapar(URL_SITE),
    URL_FICHA:       escapar(`${URL_SITE}/recomendacoes.html?rec=${encodeURIComponent(String(rec.id))}`),
    URL_DESCADASTRO: escapar(`${URL_SAIR}?t=${encodeURIComponent(inscrito.token ?? '')}`),
    NOME:            escapar(inscrito.nome || 'você'),
  });
}

// ── O disparo ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ erro: 'Use POST' }, { status: 405 });
  }

  try {
    const { recomendacaoId, teste } = await req.json();
    const db = createClient(SUPABASE_URL, SERVICE_ROLE);

    // A recomendação: a indicada, ou o destaque da semana mais recente.
    const consulta = db.from('recomendacoes').select('*');
    const { data: rec, error: erroRec } = recomendacaoId
      ? await consulta.eq('id', recomendacaoId).single()
      : await consulta.order('semana', { ascending: false })
                      .order('destaque', { ascending: false })
                      .limit(1).single();

    if (erroRec || !rec) {
      return Response.json({ erro: 'Recomendação não encontrada', detalhe: erroRec?.message },
                           { status: 404 });
    }

    const modelo = await fetch(`${URL_SITE}/email/nova-recomendacao.html`).then(r => {
      if (!r.ok) throw new Error(`Modelo respondeu ${r.status} em ${URL_SITE}/email/`);
      return r.text();
    });

    const fontes = fontesDe(rec);

    const destinatarios = teste
      ? [{ email: String(teste), nome: 'Teste', token: 'teste' }]
      : (await db.from('newsletter_inscritos')
                 .select('email, nome, token')
                 .eq('ativo', true)).data ?? [];

    if (!destinatarios.length) {
      return Response.json({ enviados: 0, aviso: 'Ninguém na lista' });
    }

    const assunto = `Nova recomendação: ${rec.titulo}${rec.ano ? ` (${rec.ano})` : ''}`;
    let enviados = 0;
    const falhas: string[] = [];

    const espera = (ms: number) => new Promise(r => setTimeout(r, ms));

    async function mandar(inscrito: { email: string; nome?: string | null; token?: string | null }) {
      return await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: REMETENTE,
          to: inscrito.email,
          subject: assunto,
          html: montarEmail(modelo, rec, fontes, inscrito),
        }),
      });
    }

    // Um a um, e não em cópia oculta: cada e-mail leva o nome e o link
    // de saída do próprio inscrito. O intervalo existe porque a Resend
    // aceita 2 pedidos por segundo — sem ele, a partir do terceiro
    // inscrito a lista começa a levar 429.
    for (const [i, inscrito] of destinatarios.entries()) {
      if (i > 0) await espera(600);

      let resp = await mandar(inscrito);

      // Se ainda assim vier 429, espera e tenta uma vez mais antes de
      // dar o e-mail como perdido.
      if (resp.status === 429) {
        await espera(2000);
        resp = await mandar(inscrito);
      }

      if (resp.ok) enviados++;
      else falhas.push(`${inscrito.email}: ${resp.status} ${await resp.text()}`);
    }

    return Response.json({ filme: rec.titulo, enviados, falhas });
  } catch (err) {
    return Response.json({ erro: String((err as Error)?.message ?? err) }, { status: 500 });
  }
});
