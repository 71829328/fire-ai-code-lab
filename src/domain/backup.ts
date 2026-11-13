// Backup: exportação e importação seguras do estado da aplicação.
//
// - `serializarBackup` gera um envelope versionado com metadados.
// - `parseBackup` aceita tanto o envelope quanto um estado cru (compatibilidade)
//   e SEMPRE valida/normaliza o conteúdo por meio de `parseStoredState` antes de
//   devolvê-lo — nunca se aplica um backup sem validação.

import { APP_STATE_VERSION, type AppState } from "../types";
import { parseStoredState, type ParseResult } from "./validation";

export const BACKUP_APLICACAO = "fire-agent-command-center";

export interface BackupEnvelope {
  aplicacao: string;
  versao: number;
  geradoEm: string;
  estado: AppState;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function serializarBackup(
  state: AppState,
  geradoEm: string = new Date().toISOString()
): string {
  const envelope: BackupEnvelope = {
    aplicacao: BACKUP_APLICACAO,
    versao: APP_STATE_VERSION,
    geradoEm,
    estado: state,
  };
  return JSON.stringify(envelope, null, 2);
}

export interface BackupMeta {
  geradoEm: string | null;
  versao: number | null;
}

export interface BackupParseResult extends ParseResult {
  meta: BackupMeta | null;
}

export function parseBackup(texto: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(texto);
  } catch {
    return {
      state: null,
      issues: [{ caminho: "arquivo", mensagem: "o conteúdo não é um JSON válido" }],
      migrado: false,
      descartados: 0,
      meta: null,
    };
  }

  const temEnvelope = isRecord(parsed) && "estado" in parsed;
  const candidato = temEnvelope ? (parsed as Record<string, unknown>).estado : parsed;
  const resultado = parseStoredState(candidato);
  const meta: BackupMeta | null = temEnvelope
    ? {
        geradoEm:
          typeof (parsed as Record<string, unknown>).geradoEm === "string"
            ? ((parsed as Record<string, unknown>).geradoEm as string)
            : null,
        versao:
          typeof (parsed as Record<string, unknown>).versao === "number"
            ? ((parsed as Record<string, unknown>).versao as number)
            : null,
      }
    : null;

  return { ...resultado, meta };
}
