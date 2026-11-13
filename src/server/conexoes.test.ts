import { describe, expect, it } from "vitest";
import { lerConfig } from "./config";
import { ESTADO_CONEXAO_LABEL, montarCentralConexoes } from "./conexoes";

function entrada(over: Partial<Parameters<typeof montarCentralConexoes>[0]> = {}) {
  return montarCentralConexoes({
    config: lerConfig({}),
    modoRepositorio: "memoria",
    persistente: false,
    mensagemRepositorio: "em memória",
    estadoSupabase: "nao_configurado",
    estadoGitHub: "nao_configurado",
    estadoVercel: "nao_configurado",
    ...over,
  });
}

describe("Central de Conexões (honestidade de estado)", () => {
  it("sem configuração, nenhum provedor aparece conectado", () => {
    const central = entrada();
    const supabase = central.provedores.find((p) => p.id === "supabase")!;
    const github = central.provedores.find((p) => p.id === "github")!;
    const vercel = central.provedores.find((p) => p.id === "vercel")!;
    expect(supabase.estado).toBe("nao_configurado");
    expect(github.estado).toBe("nao_configurado");
    expect(vercel.estado).toBe("nao_configurado");
    // O adaptador existir NÃO torna o provedor conectado.
    expect(github.adaptadorImplementado).toBe(true);
    expect(github.ultimaComunicacao).toBeNull();
  });

  it("token presente mas sem verificação ⇒ apenas 'configurado'", () => {
    const central = entrada({
      config: lerConfig({ GITHUB_TOKEN: "tok", VERCEL_TOKEN: "tok" }),
      estadoGitHub: "configurado_nao_verificado",
      estadoVercel: "configurado_nao_verificado",
    });
    expect(central.provedores.find((p) => p.id === "github")!.estado).toBe("configurado");
    expect(central.provedores.find((p) => p.id === "vercel")!.estado).toBe("configurado");
  });

  it("só após verificação real o provedor fica 'conectado_verificado'", () => {
    const central = entrada({
      config: lerConfig({ GITHUB_TOKEN: "tok" }),
      estadoGitHub: "conectado_verificado",
    });
    const github = central.provedores.find((p) => p.id === "github")!;
    expect(github.estado).toBe("conectado_verificado");
    expect(github.ultimaComunicacao).not.toBeNull();
  });

  it("erro de comunicação é refletido como 'erro'", () => {
    const central = entrada({ config: lerConfig({ VERCEL_TOKEN: "tok" }), estadoVercel: "erro" });
    expect(central.provedores.find((p) => p.id === "vercel")!.estado).toBe("erro");
  });

  it("agentes: custom é autorizado, fire_private_ai é indisponível, demais não configurados", () => {
    const central = entrada();
    const porId = new Map(central.provedores.map((p) => [p.id, p.estado]));
    expect(porId.get("custom")).toBe("autorizado");
    expect(porId.get("fire_private_ai")).toBe("indisponivel");
    expect(porId.get("chatgpt")).toBe("nao_configurado");
    expect(porId.get("trae")).toBe("nao_configurado");
  });

  it("todo estado tem rótulo legível", () => {
    for (const estado of ["nao_configurado", "configurado", "autorizado", "conectado_verificado", "indisponivel", "erro", "bloqueado_por_custo"] as const) {
      expect(ESTADO_CONEXAO_LABEL[estado]).toBeTruthy();
    }
  });
});
