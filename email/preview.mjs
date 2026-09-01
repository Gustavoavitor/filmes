// ============================================================
// CINEMATECA PESSOAL — preview.mjs
// ============================================================
// Preenche o modelo com uma recomendação de exemplo e grava
// email/preview.html, para conferir o e-mail no navegador antes de
// mandar para alguém.
//
//   node email/preview.mjs
// ============================================================

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { montarEmail } from './montar.mjs';

const aqui = dirname(fileURLToPath(import.meta.url));

const rec = {
  id: '00000000-0000-0000-0000-000000000000',
  titulo: 'The Ascent',
  titulo_original: 'Восхождение',
  ano: 1977,
  diretor: 'Larisa Shepitko',
  pais: 'União Soviética',
  duracao: 111,
  semana: '2026-08-31',
  sinopse: 'No inverno de 1942, dois partisans bielorrussos saem em busca de comida '
         + 'para o pelotão e são capturados pelos alemães. O que era uma missão de '
         + 'sobrevivência vira um interrogatório sobre o que cada um está disposto a entregar.',
  capa_url: 'https://rnpgknzettixrizaevft.supabase.co/storage/v1/object/public/capas/theascent_poster.jpg',
};

const fontes = [
  { plataforma: 'YouTube',      url: 'https://www.youtube.com/watch?v=v21lQ449T3Y', obs: 'filme completo' },
  { plataforma: 'Google Drive', url: 'https://drive.google.com/file/d/exemplo/view', obs: '' },
];

const modelo = await readFile(join(aqui, 'nova-recomendacao.html'), 'utf8');

const html = montarEmail({
  modelo,
  rec,
  fontes,
  inscrito: { nome: 'Gustavo', token: 'exemplo-de-token' },
  urlSite: 'https://filmes-five-theta.vercel.app',
  urlDescadastro: 'https://exemplo.supabase.co/functions/v1/sair',
});

const saida = join(aqui, 'preview.html');
await writeFile(saida, html, 'utf8');
console.log('Escrito em', saida);
