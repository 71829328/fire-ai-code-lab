// =====================================================================
// FIRE Agent Command Center — LAB-004
// Configuração server-side.
//
// REGRA DE SEGURANÇA: os valores dos segredos só existem aqui, no servidor,
// e nunca são serializados para o cliente. As respostas públicas usam
// apenas `resumoPublico()` (presença booleana + estado de configuração).
//
// Nenhuma credencial do ambiente TRAE é lida ou reutilizada: só variáveis
// explícitas e próprias da aplicação.
// =====================================================================

export interface ConfiguracaoServidor {
  ambiente: "desenvolvimento" | "teste" | "producao";
  sessao: { segredo: string | null };
  supabase: { url: string | null; anonKey: string | null; serviceRoleKey: string | null };
  github: { token: string | null; repositorioAutorizado: string };
  vercel: { token: string | null; projetoAutorizado: string; teamId: string | null };
  oauth: { googleClientId: string | null; microsoftClientId: string | null };
}

/** Projeto Vercel autorizado desta aplicação. Escopo fixo — nunca outro projeto. */
export const PROJETO_VERCEL_AUTORIZADO = "fire-agent-command-center";

/** Repositório autorizado desta missão (usado quando FIRE_GITHUB_REPO não é definido). */
export const REPOSITORIO_AUTORIZADO_PADRAO = "71829328/fire-ai-code-lab";

function limpar(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export function lerConfig(env: Record<string, string | undefined> = process.env): ConfiguracaoServidor {
  const bruto = limpar(env.VERCEL_ENV) ?? limpar(env.NODE_ENV);
  const ambiente: ConfiguracaoServidor["ambiente"] =
    bruto === "production" ? "producao" : bruto === "test" ? "teste" : "desenvolvimento";

  return {
    ambiente,
    sessao: { segredo: limpar(env.FIRE_SESSION_SECRET) },
    supabase: {
      url: limpar(env.SUPABASE_URL),
      anonKey: limpar(env.SUPABASE_ANON_KEY),
      serviceRoleKey: limpar(env.SUPABASE_SERVICE_ROLE_KEY),
    },
    github: {
      token: limpar(env.GITHUB_TOKEN),
      repositorioAutorizado: limpar(env.FIRE_GITHUB_REPO) ?? REPOSITORIO_AUTORIZADO_PADRAO,
    },
    vercel: {
      token: limpar(env.VERCEL_TOKEN),
      projetoAutorizado: limpar(env.FIRE_VERCEL_PROJECT) ?? PROJETO_VERCEL_AUTORIZADO,
      teamId: limpar(env.VERCEL_TEAM_ID),
    },
    oauth: {
      googleClientId: limpar(env.FIRE_GOOGLE_CLIENT_ID),
      microsoftClientId: limpar(env.FIRE_MICROSOFT_CLIENT_ID),
    },
  };
}

export interface ResumoSupabase {
  configurado: boolean;
  urlDefinida: boolean;
  chaveAnonDefinida: boolean;
  chaveServicoDefinida: boolean;
}

export interface ResumoPublico {
  ambiente: ConfiguracaoServidor["ambiente"];
  sessaoConfigurada: boolean;
  supabase: ResumoSupabase;
  github: { configurado: boolean; repositorioAutorizado: string };
  vercel: { configurado: boolean; projetoAutorizado: string };
}

/** Resumo seguro para exposição: NUNCA inclui valores de segredos. */
export function resumoPublico(config: ConfiguracaoServidor): ResumoPublico {
  const supabaseConfigurado = Boolean(config.supabase.url && config.supabase.anonKey);
  return {
    ambiente: config.ambiente,
    sessaoConfigurada: config.sessao.segredo !== null,
    supabase: {
      configurado: supabaseConfigurado,
      urlDefinida: config.supabase.url !== null,
      chaveAnonDefinida: config.supabase.anonKey !== null,
      chaveServicoDefinida: config.supabase.serviceRoleKey !== null,
    },
    github: {
      configurado: config.github.token !== null,
      repositorioAutorizado: config.github.repositorioAutorizado ?? REPOSITORIO_AUTORIZADO_PADRAO,
    },
    vercel: {
      configurado: config.vercel.token !== null,
      projetoAutorizado: config.vercel.projetoAutorizado,
    },
  };
}
