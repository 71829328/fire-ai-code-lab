import { describe, expect, it } from "vitest";
import { criarRepositorio, parseOpsState, parsePlatformState } from "./persistence";
import { listarMigracoes } from "./migrations";

const AGORA = "2026-01-01T00:00:00.000Z";

describe("persistência — parsePlatformState (validação de entrada)", () => {
  it("rejeita conteúdo que não é objeto", () => {
    const r = parsePlatformState(42);
    expect(r.state).toBeNull();
    expect(r.issues[0].caminho).toBe("raiz");
  });

  it("rejeita quando faltam coleções obrigatórias", () => {
    const r = parsePlatformState({ organizacaoAtivaId: "org-1" });
    expect(r.state).toBeNull();
    expect(r.issues[0].mensagem).toMatch(/organizacoes/);
  });

  it("coage valores inválidos para o padrão conservador", () => {
    const r = parsePlatformState({
      organizacaoAtivaId: "org-1",
      organizacoes: [{ id: "org-1", nome: "A", ambiente: "producao-invalido" }],
      usuarios: [{ id: "u1", organizacaoId: "org-1", papel: "chefe-invalido" }],
    });
    expect(r.state).not.toBeNull();
    expect(r.state?.organizacoes[0].ambiente).toBe("demonstracao");
    expect(r.state?.usuarios[0].papel).toBe("observador");
    expect(r.state?.usuarios[0].ativo).toBe(true);
  });

  it("descarta registros inválidos e contabiliza", () => {
    const r = parsePlatformState({
      organizacaoAtivaId: "org-1",
      organizacoes: [{ id: "org-1", nome: "A" }, { nome: "sem id" }],
      usuarios: [{ id: "u1", organizacaoId: "org-1" }, { id: "u2" }],
    });
    expect(r.state?.organizacoes).toHaveLength(1);
    expect(r.state?.usuarios).toHaveLength(1);
    expect(r.descartados).toBe(2);
  });

  it("sempre relê as migrações do código-fonte como não aplicadas", () => {
    const r = parsePlatformState({
      organizacaoAtivaId: "org-1",
      organizacoes: [{ id: "org-1", nome: "A" }],
      usuarios: [],
      migracoes: [{ versao: "9999", nome: "nao-existe", arquivo: "x.sql", descricao: "", aplicada: true }],
    });
    expect(r.state?.migracoes).toEqual(listarMigracoes());
    expect(r.state?.migracoes.every((m) => !m.aplicada)).toBe(true);
  });

  it("corrige organização e usuário ativos inexistentes", () => {
    const r = parsePlatformState({
      organizacaoAtivaId: "org-inexistente",
      organizacoes: [{ id: "org-1", nome: "A" }],
      usuarios: [{ id: "u1", organizacaoId: "org-1" }],
      usuarioAtivoId: "u-fantasma",
    });
    expect(r.state?.organizacaoAtivaId).toBe("org-1");
    expect(r.state?.usuarioAtivoId).toBe("u1");
  });

  it("não promove evidência informada a verificada mesmo com campos preenchidos", () => {
    const r = parsePlatformState({
      organizacaoAtivaId: "org-1",
      organizacoes: [{ id: "org-1", nome: "A" }],
      usuarios: [],
      evidencias: [
        {
          id: "ev-1",
          referencia: "abc",
          origemDado: "informado_agente",
          verificadoPor: "invasor",
          verificadoEm: AGORA,
          timestamp: AGORA,
        },
      ],
    });
    expect(r.state?.evidencias[0].verificadoPor).toBeNull();
    expect(r.state?.evidencias[0].verificadoEm).toBeNull();
  });

  it("descarta evidência sem referência", () => {
    const r = parsePlatformState({
      organizacaoAtivaId: "org-1",
      organizacoes: [{ id: "org-1", nome: "A" }],
      usuarios: [],
      evidencias: [{ id: "ev-1", referencia: "   ", timestamp: AGORA }],
    });
    expect(r.state?.evidencias).toHaveLength(0);
    expect(r.descartados).toBe(1);
  });
});

describe("persistência — parseOpsState", () => {
  const plataformaValida = {
    organizacaoAtivaId: "org-1",
    organizacoes: [{ id: "org-1", nome: "A" }],
    usuarios: [{ id: "u1", organizacaoId: "org-1" }],
  };

  it("rejeita quando o núcleo operacional é inválido", () => {
    expect(parseOpsState({ runs: [] }).state).toBeNull();
  });

  it("carrega execuções válidas e descarta inválidas", () => {
    const r = parseOpsState({
      platform: plataformaValida,
      runs: [{ id: "r1", missaoId: "ms-1" }, { id: "r2" }, "lixo"],
    });
    expect(r.state?.runs).toHaveLength(1);
    expect(r.state?.runs[0].id).toBe("r1");
    expect(r.aviso).toMatch(/descartado/);
  });

  it("coage status desconhecido para enfileirada", () => {
    const r = parseOpsState({
      platform: plataformaValida,
      runs: [{ id: "r1", missaoId: "ms-1", status: "status-bizarro" }],
    });
    expect(r.state?.runs[0].status).toBe("enfileirada");
  });
});

describe("persistência — porta de repositório", () => {
  it("supabase permanece indisponível (não há projeto/credencial autorizados)", () => {
    const repo = criarRepositorio("supabase");
    expect(repo.disponivel).toBe(false);
    expect(repo.disponivelMotivo).toMatch(/não configurado/i);
  });

  it("repositório em memória está disponível", () => {
    const repo = criarRepositorio("memoria");
    expect(repo.disponivel).toBe(true);
    expect(repo.nome).toBe("memoria");
  });

  it("local fica indisponível fora do navegador (ambiente node)", () => {
    const repo = criarRepositorio("local");
    expect(repo.disponivel).toBe(false);
  });
});
