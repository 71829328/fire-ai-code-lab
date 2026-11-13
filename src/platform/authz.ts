// Autorização e isolamento entre organizações.
//
// Regras:
//   - Toda operação é avaliada contra o papel do usuário (menor privilégio);
//   - Todo acesso a recurso passa por verificação de organização (isolamento);
//   - Nenhum recurso de outra organização é acessível, mesmo com id válido.

import {
  PERMISSOES_POR_PAPEL,
  type Organizacao,
  type Permissao,
  type Usuario,
} from "./types";

export interface Decisao {
  permitido: boolean;
  motivo: string;
}

export function permissoesDoPapel(usuario: Pick<Usuario, "papel">): Permissao[] {
  return PERMISSOES_POR_PAPEL[usuario.papel] ?? [];
}

export function temPermissao(usuario: Pick<Usuario, "papel">, permissao: Permissao): boolean {
  return permissoesDoPapel(usuario).includes(permissao);
}

// Verificação combinada: usuário ativo + permissão + organização correta.
// Esta é a única forma correta de liberar uma operação sensível.
export function autorizar(
  usuario: Usuario | null,
  permissao: Permissao,
  organizacaoIdDoRecurso: string
): Decisao {
  if (!usuario) return { permitido: false, motivo: "Nenhum usuário autenticado." };
  if (!usuario.ativo) return { permitido: false, motivo: "Usuário inativo." };
  if (usuario.organizacaoId !== organizacaoIdDoRecurso) {
    return { permitido: false, motivo: "Recurso pertence a outra organização." };
  }
  if (!temPermissao(usuario, permissao)) {
    return { permitido: false, motivo: `Papel ${usuario.papel} não possui a permissão ${permissao}.` };
  }
  return { permitido: true, motivo: "Autorizado." };
}

// Verifica se um usuário pode enxergar/operar dentro da organização informada.
export function pertenceAOrganizacao(usuario: Usuario | null, organizacaoId: string): boolean {
  return !!usuario && usuario.ativo && usuario.organizacaoId === organizacaoId;
}

export function organizacaoAtiva(organizacoes: Organizacao[], id: string): Organizacao | null {
  return organizacoes.find((o) => o.id === id) ?? null;
}

export function usuariosDaOrganizacao(usuarios: Usuario[], organizacaoId: string): Usuario[] {
  return usuarios.filter((u) => u.organizacaoId === organizacaoId);
}
