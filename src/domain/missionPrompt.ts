// Geração do prompt completo de uma missão, para cópia e execução manual em
// outra ferramenta. O texto deixa explícito que a execução é manual/assistida
// e que nenhuma integração automática está ativa.

import { MISSION_STATUS_LABEL, PRIORITY_LABEL, type Mission } from "../types";

export interface MissionPromptContext {
  agenteNome?: string | null;
  projetoNome?: string | null;
  dependencias?: { codigo: string; titulo: string; status: Mission["status"] }[];
}

export function buildMissionPrompt(mission: Mission, ctx: MissionPromptContext = {}): string {
  const linhas: string[] = [];
  linhas.push(`# MISSÃO ${mission.codigo} — ${mission.titulo}`);
  linhas.push("");
  linhas.push(`Status: ${MISSION_STATUS_LABEL[mission.status]}`);
  linhas.push(`Prioridade: ${PRIORITY_LABEL[mission.prioridade]}`);
  linhas.push(`Agente responsável: ${ctx.agenteNome ?? "não atribuído"}`);
  linhas.push(`Projeto: ${ctx.projetoNome ?? "não vinculado"}`);
  linhas.push("");
  linhas.push("## Objetivo");
  linhas.push(mission.objetivo.trim() || "(não informado)");
  linhas.push("");
  linhas.push("## Instruções");
  linhas.push(mission.instrucoes.trim() || "(não informadas)");

  linhas.push("");
  linhas.push("## Critérios de aceite");
  if (mission.criteriosAceite.length === 0) {
    linhas.push("- (nenhum critério informado)");
  } else {
    mission.criteriosAceite.forEach((criterio) => linhas.push(`- [ ] ${criterio}`));
  }

  if (ctx.dependencias && ctx.dependencias.length > 0) {
    linhas.push("");
    linhas.push("## Dependências");
    ctx.dependencias.forEach((dep) =>
      linhas.push(`- ${dep.codigo} — ${dep.titulo} (${MISSION_STATUS_LABEL[dep.status]})`)
    );
  }

  if (mission.evidencias.length > 0) {
    linhas.push("");
    linhas.push("## Evidências registradas");
    mission.evidencias.forEach((ev) =>
      linhas.push(`- [${ev.tipo}] ${ev.descricao}${ev.valor ? ` — ${ev.valor}` : ""}`)
    );
  }

  linhas.push("");
  linhas.push("---");
  linhas.push(
    "Execução manual/assistida. Nenhuma integração automática está ativa: registre o resultado e anexe as evidências na Central de Missões."
  );

  return linhas.join("\n");
}
