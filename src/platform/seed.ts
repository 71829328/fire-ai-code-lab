// Semente do núcleo operacional (LAB-003).
//
// Dados de exemplo claramente marcados como demonstração. Nenhum deles representa
// credencial, conexão real ou custo efetivo.

import { listarMigracoes } from "./migrations";
import { PLATFORM_STATE_VERSION, type PlatformState, type Usuario } from "./types";

const agora = () => new Date().toISOString();

export function criarRepositorioSeed(): PlatformState {
  const usuarios: Usuario[] = [
    {
      id: "us-owner",
      organizacaoId: "org-demo",
      nome: "Operador FIRE",
      email: "operador@exemplo.invalid",
      papel: "proprietario",
      ativo: true,
      criadoEm: agora(),
    },
    {
      id: "us-op",
      organizacaoId: "org-demo",
      nome: "Analista de Execução",
      email: "operacao@exemplo.invalid",
      papel: "operador",
      ativo: true,
      criadoEm: agora(),
    },
    {
      id: "us-rev",
      organizacaoId: "org-demo",
      nome: "Revisor Técnico",
      email: "revisao@exemplo.invalid",
      papel: "revisor",
      ativo: true,
      criadoEm: agora(),
    },
    {
      id: "us-obs",
      organizacaoId: "org-demo",
      nome: "Observador",
      email: "observador@exemplo.invalid",
      papel: "observador",
      ativo: true,
      criadoEm: agora(),
    },
  ];

  return {
    versao: PLATFORM_STATE_VERSION,
    organizacaoAtivaId: "org-demo",
    organizacoes: [
      {
        id: "org-demo",
        nome: "FIRE Intelligence — Demonstração",
        criadoEm: agora(),
        ambiente: "demonstracao",
      },
      {
        id: "org-lab",
        nome: "Laboratório de Homologação",
        criadoEm: agora(),
        ambiente: "homologacao",
      },
    ],
    usuarios,
    usuarioAtivoId: "us-owner",
    aprovacoes: [],
    auditoria: [],
    consumo: [],
    evidencias: [],
    migracoes: listarMigracoes(),
  };
}
