// Executor local real para tarefas seguras e verificáveis.
//
// Não é IA e não chama rede: processa o texto de instruções da missão no próprio
// navegador e reconfere o resultado por caminho independente. É o único tipo de
// execução que o motor realiza automaticamente nesta entrega; execução por
// agentes externos permanece manual/assistida.

import { runLocalDemoTask } from "../domain/localExecutor";
import type { MissionView, RunResultado } from "./types";

export function executarLocalmente(missao: MissionView): RunResultado {
  const execucao = runLocalDemoTask({
    texto: `${missao.instrucoes}\n${missao.criteriosAceite.join("\n")}`,
    criterios: missao.criteriosAceite,
  });
  const passou = execucao.verificacao.passou && typeof execucao.checksum === "string";
  return {
    resumo: `${execucao.saida.resumo} (execução local, não IA)`,
    checksum: execucao.checksum,
    verificacao: {
      passou,
      detalhe: execucao.verificacao.detalhe,
    },
  };
}
