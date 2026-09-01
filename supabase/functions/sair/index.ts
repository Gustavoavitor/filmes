// ============================================================
// CINEMATECA PESSOAL — Edge Function: sair
// ============================================================
// O link de descadastro no rodapé de cada e-mail.
//
//   GET /functions/v1/sair?t=<token>
//
// Um clique basta: quem chegou aqui veio do próprio e-mail, e pedir
// confirmação para sair de uma lista é hostilidade disfarçada de
// cuidado. O token não é adivinhável e só desliga uma inscrição.
//
// A função precisa estar publicada com --no-verify-jwt, senão o
// clique no e-mail volta 401.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const URL_SITE     = (Deno.env.get('URL_SITE') ?? '').replace(/\/+$/, '');

function pagina(titulo: string, texto: string, status = 200) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${titulo} — Cinemateca Pessoal</title></head>
<body style="margin:0;background:#E8E8E4;font-family:Geist,Helvetica,Arial,sans-serif;color:#13121A;">
  <div style="max-width:520px;margin:0 auto;padding:80px 24px;text-align:center;">
    <p style="font-family:'Geist Mono',Courier,monospace;font-size:11px;letter-spacing:2.6px;
              text-transform:uppercase;color:#4A4750;margin:0 0 10px;">Cinemateca Pessoal</p>
    <h1 style="font-family:'League Gothic','Arial Narrow',Impact,sans-serif;font-weight:400;font-size:34px;
               line-height:36px;text-transform:uppercase;margin:0 0 14px;">${titulo}</h1>
    <p style="font-size:15px;line-height:26px;color:#2A2833;margin:0 0 26px;">${texto}</p>
    <a href="${URL_SITE}/recomendacoes.html"
       style="display:inline-block;padding:12px 24px;background:#13121A;color:#F6F6F3;
              border-radius:999px;text-decoration:none;font-family:'Geist Mono',Courier,monospace;
              font-size:11px;letter-spacing:2.2px;text-transform:uppercase;">
      Ver as recomendações
    </a>
  </div>
</body></html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get('t');

  if (!token) {
    return pagina('Link incompleto',
      'Falta o código de identificação no endereço. Abra o link direto do e-mail que você recebeu.',
      400);
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data, error } = await db
    .from('newsletter_inscritos')
    .update({ ativo: false })
    .eq('token', token)
    .select('email');

  if (error) {
    return pagina('Não deu para sair agora',
      'Algo falhou do nosso lado. Tente o link de novo em alguns minutos.', 500);
  }

  if (!data?.length) {
    // Token desconhecido ou já usado — o resultado prático é o mesmo,
    // e dizer qual dos dois seria contar quem está na lista.
    return pagina('Você não está na lista',
      'Este endereço não recebe mais os e-mails de recomendação.');
  }

  return pagina('Pronto, você saiu',
    'Não vamos mais mandar e-mail. As recomendações continuam no site, quando você quiser.');
});
