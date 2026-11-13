// =====================================================================
// FIRE Agent Command Center — LAB-004
// Autenticação e sessões server-side.
//
// Regra de segurança: a identidade NUNCA é aceita do cliente. O cliente
// apresenta apenas um token de sessão assinado (HMAC-SHA256) emitido pelo
// servidor. Toda decisão de acesso é tomada no servidor com base no token
// verificado — espelhando, no backend, a regra `auth.uid()` da RLS.
//
// O formato do token é:  v1.<payload base64url>.<assinatura base64url>
// A assinatura cobre a string "v1.<payload>". Sem segredo configurado, nenhuma
// sessão é emitida ou aceita.
// =====================================================================

import { createHmac, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { Papel } from "../platform/types";

export interface SessaoPayload {
  /** Identificador do usuário (equivalente a `sub` do JWT / auth.uid()). */
  sub: string;
  /** Organização à qual a identidade pertence — base do isolamento. */
  org: string;
  papel: Papel;
  nome: string;
  email: string;
  /** Emitido em (epoch ms). */
  iat: number;
  /** Expira em (epoch ms). */
  exp: number;
  /** Identificador único do token (permite revogação/rotação futura). */
  jti: string;
}

export type ResultadoSessao =
  | { ok: true; payload: SessaoPayload }
  | { ok: false; motivo: "ausente" | "formato_invalido" | "assinatura_invalida" | "expirada" | "segredo_ausente" };

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

function b64url(bytes: Buffer | string): string {
  return Buffer.from(bytes).toString("base64url");
}

function deB64url(texto: string): Buffer {
  return Buffer.from(texto, "base64url");
}

function assinar(conteudo: string, segredo: string): string {
  return createHmac("sha256", segredo).update(conteudo).digest("base64url");
}

export interface CriarSessaoParams {
  sub: string;
  org: string;
  papel: Papel;
  nome: string;
  email: string;
  agoraMs?: number;
  ttlMs?: number;
}

/** Emite um token assinado. Lança se o segredo estiver ausente. */
export function criarSessao(params: CriarSessaoParams, segredo: string | null): string {
  if (!segredo) {
    throw new Error("Segredo de sessão não configurado: emissão de sessão desabilitada.");
  }
  const iat = params.agoraMs ?? Date.now();
  const payload: SessaoPayload = {
    sub: params.sub,
    org: params.org,
    papel: params.papel,
    nome: params.nome,
    email: params.email,
    iat,
    exp: iat + (params.ttlMs ?? SESSION_TTL_MS),
    jti: randomUUID(),
  };
  const corpo = b64url(JSON.stringify(payload));
  const conteudo = `v1.${corpo}`;
  return `${conteudo}.${assinar(conteudo, segredo)}`;
}

function ehPayload(valor: unknown): valor is SessaoPayload {
  if (valor === null || typeof valor !== "object") return false;
  const p = valor as Record<string, unknown>;
  return (
    typeof p.sub === "string" &&
    typeof p.org === "string" &&
    typeof p.papel === "string" &&
    typeof p.nome === "string" &&
    typeof p.email === "string" &&
    typeof p.iat === "number" &&
    typeof p.exp === "number" &&
    typeof p.jti === "string"
  );
}

/** Verifica assinatura, formato e expiração. Nunca lança. */
export function validarSessao(
  token: string | null,
  segredo: string | null,
  agoraMs: number = Date.now()
): ResultadoSessao {
  if (!segredo) return { ok: false, motivo: "segredo_ausente" };
  if (!token) return { ok: false, motivo: "ausente" };

  const partes = token.split(".");
  if (partes.length !== 3 || partes[0] !== "v1") {
    return { ok: false, motivo: "formato_invalido" };
  }
  const [versao, corpo, assinatura] = partes;
  const esperada = assinar(`${versao}.${corpo}`, segredo);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, motivo: "assinatura_invalida" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(deB64url(corpo).toString("utf8"));
  } catch {
    return { ok: false, motivo: "formato_invalido" };
  }
  if (!ehPayload(payload)) return { ok: false, motivo: "formato_invalido" };
  if (payload.exp <= agoraMs) return { ok: false, motivo: "expirada" };

  return { ok: true, payload };
}

/* ------------------------------------------------------------------ */
/* Senhas (autenticação local de e-mail/senha)                         */
/* ------------------------------------------------------------------ */

// Formato: scrypt$N$r$p$salt(base64)$hash(base64). Parâmetros explícitos para
// permitir verificação estável entre ambientes.
export interface ParametrosScrypt {
  N: number;
  r: number;
  p: number;
  keylen: number;
}

export const SCRYPT_PADRAO: ParametrosScrypt = { N: 16384, r: 8, p: 1, keylen: 32 };

export function gerarHashSenha(senha: string, params: ParametrosScrypt = SCRYPT_PADRAO, salt?: Buffer): string {
  const sal = salt ?? Buffer.from(randomUUID().replace(/-/g, "").slice(0, 16), "utf8");
  const derivado = scryptSync(senha, sal, params.keylen, { N: params.N, r: params.r, p: params.p });
  return `scrypt$${params.N}$${params.r}$${params.p}$${b64url(sal)}$${b64url(derivado)}`;
}

/** Verificação em tempo constante. Retorna false para qualquer entrada inválida. */
export function verificarSenha(senha: string, hashArmazenado: string): boolean {
  const partes = hashArmazenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const N = Number(partes[1]);
  const r = Number(partes[2]);
  const p = Number(partes[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  try {
    const sal = deB64url(partes[4]);
    const esperado = deB64url(partes[5]);
    const derivado = scryptSync(senha, sal, esperado.length, { N, r, p });
    return derivado.length === esperado.length && timingSafeEqual(derivado, esperado);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Credenciais locais (fora do cliente) e funções OAuth preparadas     */
/* ------------------------------------------------------------------ */

export type ProvedorOAuth = "google" | "microsoft";

export interface CapacidadeOAuth {
  provedor: ProvedorOAuth;
  configurado: boolean;
  /** Não inventamos URLs: o ponto de autorização é montado só se configurado. */
  autorizacaoConectada: boolean;
  observacao: string;
}

// A autenticação OAuth exige client-id/secret do proprietário. Sem isso, o
// provedor permanece explicitamente "não configurado" — nunca simulamos login.
export function capacidadeOAuth(
  provedor: ProvedorOAuth,
  env: { googleClientId?: string | null; microsoftClientId?: string | null }
): CapacidadeOAuth {
  const clientId = provedor === "google" ? env.googleClientId : env.microsoftClientId;
  const configurado = Boolean(clientId && clientId.trim().length > 0);
  return {
    provedor,
    configurado,
    autorizacaoConectada: false,
    observacao: configurado
      ? "Credencial de cliente presente; fluxo OAuth ainda não conectado nem verificado neste ambiente."
      : "Client ID/secret não configurados pelo proprietário: login OAuth indisponível.",
  };
}
