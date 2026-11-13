// Metadados das migrações versionadas.
//
// Cada item espelha um arquivo SQL em backend/migrations/. Nenhuma migração é
// aplicada automaticamente: aplicar em banco real exige autorização específica.

import type { Migracao } from "./types";

export const MIGRACOES: Migracao[] = [
  {
    versao: "0001",
    nome: "init",
    arquivo: "backend/migrations/0001_init.sql",
    descricao:
      "Tabelas base: organizações, usuários, agentes, projetos, missões, dependências, execuções, tentativas, evidências, aprovações, auditoria e métricas de consumo.",
    aplicada: false,
  },
  {
    versao: "0002",
    nome: "rls",
    arquivo: "backend/migrations/0002_rls.sql",
    descricao:
      "Row Level Security e isolamento entre organizações: políticas por organização e por papel (proprietário, administrador, operador, revisor, observador).",
    aplicada: false,
  },
  {
    versao: "0003",
    nome: "indices_e_funcoes",
    arquivo: "backend/migrations/0003_indices_funcoes.sql",
    descricao:
      "Índices de desempenho, função de verificação de dependências e gatilhos de atualização de atualizadoEm.",
    aplicada: false,
  },
  {
    versao: "0004",
    nome: "seguranca",
    arquivo: "backend/migrations/0004_seguranca.sql",
    descricao:
      "Endurecimento (LAB-004): imutabilidade da auditoria e dos eventos, proteção contra escalada de papel e troca de tenant, integridade de referências entre organizações, aprovação crítica, grants de menor privilégio e search_path seguro.",
    aplicada: false,
  },
];

export function listarMigracoes(): Migracao[] {
  return MIGRACOES.map((m) => ({ ...m }));
}

export function migracoesPendentes(): Migracao[] {
  return MIGRACOES.filter((m) => !m.aplicada);
}

// Bloqueio explícito: nada é aplicado sem autorização específica.
export function aplicarMigracoes(): { aplicadas: number; motivo: string } {
  return {
    aplicadas: 0,
    motivo:
      "Aplicação de migrações bloqueada: exige autorização específica e um banco autorizado. Os arquivos SQL estão versionados em backend/migrations.",
  };
}
