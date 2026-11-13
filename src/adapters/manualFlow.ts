// Fluxo manual assistido — o que É tecnicamente possível hoje.
//
// Sem integração automática autorizada, o operador exporta o prompt da missão,
// executa em outra ferramenta por conta própria e importa o resultado de volta.
// A importação é DEFENSIVA e DETERMINÍSTICA: extrai apenas o que está de fato no
// texto, sem inventar resumos, artefatos ou métricas.

import { buildMissionPrompt } from "../domain/missionPrompt";
import type { Mission } from "../types";

export function exportarMissao(
  missao: Mission,
  ctx: { agenteNome?: string | null; projetoNome?: string | null } = {}
): { prompt: string; nomeArquivo: string } {
  const prompt = buildMissionPrompt(missao, ctx);
  return { prompt, nomeArquivo: `missao-${missao.codigo}.md` };
}

export interface ResultadoImportado {
  resumo: string;
  artefatos: { nome: string; valor: string }[];
  bruto: string;
}

// Regexes locais: URLs http(s) e hashes hexadecimais de 7 a 40 caracteres.
const URL_REGEX = /https?:\/\/[^\s)]+/g;
const HASH_REGEX = /\b[0-9a-f]{7,40}\b/g;
// Formato "chave: valor" — exige espaço após os dois-pontos, o que evita confundir
// uma URL solta ("https://...") com o par chave/valor.
const PAR_REGEX = /^([^:]{1,40}):\s+(.+)$/;

export function importarResultado(texto: string): ResultadoImportado {
  if (!texto || texto.trim() === "") {
    throw new Error("Relatório vazio");
  }

  const linhas = texto.split(/\r?\n/);

  const primeiraNaoVazia = linhas.map((linha) => linha.trim()).find((linha) => linha.length > 0) ?? "";
  const resumo = primeiraNaoVazia.slice(0, 280);

  const artefatos: { nome: string; valor: string }[] = [];

  for (const linha of linhas) {
    const conteudo = linha.trim();
    if (conteudo === "") continue;

    // 1) Par "chave: valor" tem prioridade (ex.: "commit: abc1234", "PR: https://...").
    const par = conteudo.match(PAR_REGEX);
    if (par) {
      artefatos.push({ nome: par[1].trim(), valor: par[2].trim() });
      continue;
    }

    // 2) URL solta.
    const urls = conteudo.match(URL_REGEX);
    if (urls && urls.length > 0) {
      for (const url of urls) artefatos.push({ nome: "URL", valor: url });
      continue;
    }

    // 3) Hash hexadecimal solto.
    const hashes = conteudo.match(HASH_REGEX);
    if (hashes && hashes.length > 0) {
      for (const hash of hashes) artefatos.push({ nome: "Hash", valor: hash });
    }
  }

  return { resumo, artefatos, bruto: texto };
}
