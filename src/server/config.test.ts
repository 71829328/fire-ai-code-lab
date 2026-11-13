import { describe, expect, it } from "vitest";
import {
  lerConfig,
  PROJETO_VERCEL_AUTORIZADO,
  REPOSITORIO_AUTORIZADO_PADRAO,
  resumoPublico,
} from "./config";

describe("configuração server-side", () => {
  it("sem variáveis, aplica padrões e mantém segredos ausentes", () => {
    const config = lerConfig({});
    expect(config.ambiente).toBe("desenvolvimento");
    expect(config.sessao.segredo).toBeNull();
    expect(config.github.token).toBeNull();
    expect(config.github.repositorioAutorizado).toBe(REPOSITORIO_AUTORIZADO_PADRAO);
    expect(config.vercel.projetoAutorizado).toBe(PROJETO_VERCEL_AUTORIZADO);
  });

  it("mapeia o ambiente a partir de VERCEL_ENV/NODE_ENV", () => {
    expect(lerConfig({ NODE_ENV: "production" }).ambiente).toBe("producao");
    expect(lerConfig({ NODE_ENV: "test" }).ambiente).toBe("teste");
    expect(lerConfig({ VERCEL_ENV: "production" }).ambiente).toBe("producao");
  });

  it("ignora valores em branco", () => {
    const config = lerConfig({ GITHUB_TOKEN: "   ", FIRE_SESSION_SECRET: "" });
    expect(config.github.token).toBeNull();
    expect(config.sessao.segredo).toBeNull();
  });

  it("o resumo público NUNCA expõe valores de segredo", () => {
    const config = lerConfig({
      FIRE_SESSION_SECRET: "segredo-super-secreto",
      GITHUB_TOKEN: "ghp_token_secreto",
      VERCEL_TOKEN: "vercel_token_secreto",
      SUPABASE_URL: "https://proj.supabase.co",
      SUPABASE_ANON_KEY: "anon_secreta",
      SUPABASE_SERVICE_ROLE_KEY: "service_role_secreta",
    });
    const resumo = resumoPublico(config);
    const serializado = JSON.stringify(resumo);
    expect(serializado).not.toContain("segredo-super-secreto");
    expect(serializado).not.toContain("ghp_token_secreto");
    expect(serializado).not.toContain("vercel_token_secreto");
    expect(serializado).not.toContain("anon_secreta");
    expect(serializado).not.toContain("service_role_secreta");
    expect(resumo.sessaoConfigurada).toBe(true);
    expect(resumo.github.configurado).toBe(true);
    expect(resumo.supabase.configurado).toBe(true);
    expect(resumo.supabase.chaveServicoDefinida).toBe(true);
  });
});
