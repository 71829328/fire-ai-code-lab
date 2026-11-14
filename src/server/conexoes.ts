// =====================================================================
// FIRE Agent Command Center — LAB-004
// Central de Conexões (estado server-side).
//
// Regra de honestidade: um provedor NUNCA aparece como "conectado" só porque
// seu adaptador existe. O estado reflete a configuração real e, quando houver,
// o resultado de uma chamada real de verificação.
// =====================================================================

import { INTEGRACOES_CATALOGO } from "../adapters/capabilities";
import type { ConfiguracaoServidor } from "./config";
import type { EstadoGitHub } from "./integracoes/github";
import type { EstadoVercel } from "./integracoes/vercel";
import type { EstadoConexaoSupabase } from "./supabase";

export type EstadoConexao =
  | "nao_configurado"
  | "configurado"
  | "autorizado"
  | "conectado_verificado"
  | "leitura_publica_verificada"
  | "indisponivel"
  | "erro"
  | "bloqueado_por_custo";

export const ESTADO_CONEXAO_LABEL: Record<EstadoConexao, string> = {
  nao_configurado: "Não configurado",
  configurado: "Configurado",
  autorizado: "Autorizado",
  conectado_verificado: "Conectado e verificado",
  leitura_publica_verificada: "Leitura pública verificada",
  indisponivel: "Indisponível",
  erro: "Erro",
  bloqueado_por_custo: "Bloqueado por custo",
};

export type CategoriaConexao = "backend" | "repositorio" | "deploy" | "agente";

export interface ConexaoProvedor {
  id: string;
  nome: string;
  categoria: CategoriaConexao;
  estado: EstadoConexao;
  /** Permissões reais concedidas (nunca presumidas). */
  permissoes: string[];
  requerimentos: string[];
  observacao: string;
  /** Só preenchido quando existir verificação real. */
  ultimaComunicacao: string | null;
  /** Falhas observadas (mensagens seguras, sem segredos). */
  falhas: string[];
  limites: string;
  consumo: string;
  /** Nunca exibido como conectado por existir o adaptador. */
  adaptadorImplementado: boolean;
  /** true quando o operador desativou o provedor no servidor (kill switch). */
  desativadoPeloOperador?: boolean;
}

export interface EstadoConexoes {
  backend: { modo: string; persistente: boolean; mensagem: string };
  supabase: EstadoConexaoSupabase;
  github: EstadoGitHub;
  vercel: EstadoVercel;
  provedores: ConexaoProvedor[];
}

export interface EntradaConexoes {
  config: ConfiguracaoServidor;
  modoRepositorio: string;
  persistente: boolean;
  mensagemRepositorio: string;
  estadoSupabase: EstadoConexaoSupabase;
  estadoGitHub: EstadoGitHub;
  estadoVercel: EstadoVercel;
  falhasGitHub?: string[];
  falhasVercel?: string[];
  /** Ids de provedores desativados pelo operador (kill switch). */
  provedoresDesativados?: string[];
}

function deSupabase(estado: EstadoConexaoSupabase, configurado: boolean): EstadoConexao {
  switch (estado) {
    case "verificado":
      return "conectado_verificado";
    case "erro":
      return "erro";
    case "configurado_nao_verificado":
      return configurado ? "configurado" : "nao_configurado";
    default:
      return "nao_configurado";
  }
}

function deExterno(estado: EstadoGitHub | EstadoVercel, configurado: boolean): EstadoConexao {
  switch (estado) {
    case "conectado_verificado":
      return "conectado_verificado";
    case "leitura_publica_verificada":
      return "leitura_publica_verificada";
    case "erro":
      return "erro";
    case "configurado_nao_verificado":
      return configurado ? "configurado" : "nao_configurado";
    default:
      return "nao_configurado";
  }
}

export function montarCentralConexoes(entrada: EntradaConexoes): EstadoConexoes {
  const { config } = entrada;
  const supabaseConfigurado = Boolean(config.supabase.url && config.supabase.anonKey);
  const githubConfigurado = config.github.token !== null;
  const vercelConfigurado = config.vercel.token !== null;

  const provedores: ConexaoProvedor[] = [
    {
      id: "supabase",
      nome: "Supabase (persistência e autenticação)",
      categoria: "backend",
      estado: deSupabase(entrada.estadoSupabase, supabaseConfigurado),
      permissoes: supabaseConfigurado ? ["leitura", "escrita", "autenticação"] : [],
      requerimentos: [
        "Projeto Supabase autorizado pelo proprietário",
        "SUPABASE_URL e SUPABASE_ANON_KEY no servidor (nunca no frontend)",
        "SUPABASE_SERVICE_ROLE_KEY no servidor apenas para operações administrativas",
      ],
      observacao: supabaseConfigurado
        ? "Credenciais presentes. Enquanto não houver chamada real de verificação, permanece apenas 'configurado'."
        : "Sem credenciais: nenhuma operação de banco é executada. Persistência limitada ao modo em memória.",
      ultimaComunicacao: entrada.estadoSupabase === "verificado" ? new Date().toISOString() : null,
      falhas: entrada.estadoSupabase === "erro" ? ["Falha na última tentativa de verificação."] : [],
      limites: "Definido pela cota do projeto Supabase do proprietário.",
      consumo: "Não monitorado pelo Command Center.",
      adaptadorImplementado: true,
    },
    {
      id: "github",
      nome: "GitHub (repositório autorizado)",
      categoria: "repositorio",
      estado: deExterno(entrada.estadoGitHub, githubConfigurado),
      permissoes: githubConfigurado
        ? ["leitura autenticada no repositório autorizado", "leitura de ações/CI conforme permissões do token"]
        : entrada.estadoGitHub === "leitura_publica_verificada"
          ? ["somente leitura de conteúdo público do repositório autorizado"]
          : [],
      requerimentos: [
        githubConfigurado
          ? "Token da aplicação com escopo mínimo de leitura no repositório autorizado"
          : config.github.permitirLeituraPublica
            ? "FIRE_GITHUB_PUBLIC_READ=true; limita chamadas públicas ao repositório autorizado"
            : "Token de leitura para dados privados e operações autenticadas",
        "Repositório " + config.github.repositorioAutorizado + " autorizado pelo proprietário",
      ],
      observacao: entrada.estadoGitHub === "leitura_publica_verificada"
        ? "Leitura pública verificada sem autenticação. Isso não comprova identidade da aplicação nem concede acesso a dados privados."
        : githubConfigurado
          ? "Token presente. Só é 'conectado e verificado' após uma chamada autenticada real bem-sucedida."
          : config.github.permitirLeituraPublica
            ? "Leitura pública somente de leitura habilitada; o estado só muda após chamada real bem-sucedida."
            : "Token ausente e leitura pública desativada: nenhuma chamada é feita.",
      ultimaComunicacao: entrada.estadoGitHub === "conectado_verificado" || entrada.estadoGitHub === "leitura_publica_verificada"
        ? new Date().toISOString()
        : null,
      falhas: entrada.falhasGitHub ?? [],
      limites: "Limite da API REST do GitHub: cota anônima por origem; token autorizado eleva a cota e libera recursos privados.",
      consumo: "Chamadas de leitura contabilizadas pelo GitHub.",
      adaptadorImplementado: true,
    },
    {
      id: "vercel",
      nome: "Vercel (deployments do projeto autorizado)",
      categoria: "deploy",
      estado: deExterno(entrada.estadoVercel, vercelConfigurado),
      permissoes: vercelConfigurado ? ["leitura de projeto", "leitura de deployments", "leitura de logs"] : [],
      requerimentos: [
        "Token da aplicação com escopo de leitura",
        "Projeto " + config.vercel.projetoAutorizado + " — nenhum outro projeto é acessível",
      ],
      observacao: vercelConfigurado
        ? "Token presente. Escopo fixo no projeto autorizado; nenhum deploy é executado."
        : "Token ausente: nenhuma chamada é feita.",
      ultimaComunicacao: entrada.estadoVercel === "conectado_verificado" ? new Date().toISOString() : null,
      falhas: entrada.falhasVercel ?? [],
      limites: "Limite de taxa da API da Vercel (por token).",
      consumo: "Operações de leitura contabilizadas pela Vercel.",
      adaptadorImplementado: true,
    },
  ];

  for (const integracao of INTEGRACOES_CATALOGO) {
    const ehCustom = integracao.id === "custom";
    const ehPrivado = integracao.id === "fire_private_ai";
    const estado: EstadoConexao = ehCustom ? "autorizado" : ehPrivado ? "indisponivel" : "nao_configurado";
    provedores.push({
      id: integracao.id,
      nome: integracao.nome,
      categoria: "agente",
      estado,
      permissoes: [],
      requerimentos: integracao.requerimentos,
      observacao: integracao.observacao,
      ultimaComunicacao: null,
      falhas: [],
      limites: "Sem integração autorizada não há telemetria de limite.",
      consumo: "Informado manualmente pelo operador.",
      adaptadorImplementado: true,
    });
  }

  // Kill switch do operador: provedores desativados NUNCA aparecem conectados
  // nem são consultados. O estado passa a "indisponivel" com motivo explícito.
  const desativados = new Set(entrada.provedoresDesativados ?? []);
  for (const provedor of provedores) {
    if (!desativados.has(provedor.id)) continue;
    provedor.desativadoPeloOperador = true;
    provedor.estado = "indisponivel";
    provedor.permissoes = [];
    provedor.observacao =
      "Desativado pelo operador no servidor: nenhuma chamada externa é realizada enquanto permanecer desativado.";
  }

  return {
    backend: {
      modo: entrada.modoRepositorio,
      persistente: entrada.persistente,
      mensagem: entrada.mensagemRepositorio,
    },
    supabase: entrada.estadoSupabase,
    github: entrada.estadoGitHub,
    vercel: entrada.estadoVercel,
    provedores,
  };
}
