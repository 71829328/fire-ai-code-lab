// Validação de entradas e proteção contra vazamento de segredos.
//
// Objetivo (segurança LAB-003): nenhuma entrada do usuário é aceita sem
// validação, e nenhum token/segredo pode ser persistido no frontend/localStorage.

export interface ResultadoValidacao {
  valido: boolean;
  motivos: string[];
  valor: string;
}

const PADROES_SEGREDO: { nome: string; regex: RegExp }[] = [
  { nome: "chave OpenAI (sk-)", regex: /\bsk-[A-Za-z0-9]{16,}\b/ },
  { nome: "token Bearer", regex: /\bBearer\s+[A-Za-z0-9._-]{12,}/i },
  { nome: "chave AWS (AKIA)", regex: /\bAKIA[0-9A-Z]{12,}\b/ },
  { nome: "cabeçalho de chave privada", regex: /-----BEGIN[ A-Z]*PRIVATE KEY-----/ },
  { nome: "campo de senha/token explícito", regex: /\b(api[_-]?key|secret|password|senha|token)\s*[:=]\s*\S{8,}/i },
  { nome: "JWT", regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
];

// Detecção heurística de segredos. Não substitui um cofre de segredos: serve para
// impedir que um operador cole uma credencial em um campo livre.
export function detectarSegredos(texto: string): { contem: boolean; motivos: string[] } {
  const motivos: string[] = [];
  for (const padrao of PADROES_SEGREDO) {
    if (padrao.regex.test(texto)) motivos.push(`Possível segredo detectado: ${padrao.nome}.`);
  }
  return { contem: motivos.length > 0, motivos };
}

// Varre recursivamente um objeto e retorna todos os caminhos que contêm segredos.
export function varrerSegredos(valor: unknown, caminho = "raiz"): string[] {
  const achados: string[] = [];
  if (typeof valor === "string") {
    if (detectarSegredos(valor).contem) achados.push(caminho);
    return achados;
  }
  if (Array.isArray(valor)) {
    valor.forEach((item, i) => achados.push(...varrerSegredos(item, `${caminho}[${i}]`)));
    return achados;
  }
  if (valor && typeof valor === "object") {
    for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
      achados.push(...varrerSegredos(item, `${caminho}.${chave}`));
    }
  }
  return achados;
}

// Lança se o objeto contiver segredos — usar antes de persistir/exportar.
export function garantirSemSegredos(valor: unknown): void {
  const achados = varrerSegredos(valor);
  if (achados.length > 0) {
    throw new Error(
      `Conteúdo bloqueado: possível segredo em ${achados.join(", ")}. Credenciais não devem ser armazenadas no frontend.`
    );
  }
}

export function sanitizarTexto(valor: unknown, maxComprimento = 2000): string {
  if (typeof valor !== "string") return "";
  // Remove caracteres de controle, exceto quebra de linha e tabulação.
  const limpo = valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  return limpo.slice(0, maxComprimento);
}

export function validarNome(valor: unknown): ResultadoValidacao {
  const texto = sanitizarTexto(valor, 120);
  if (texto.length < 2) return { valido: false, motivos: ["Nome muito curto."], valor: texto };
  if (detectarSegredos(texto).contem) {
    return { valido: false, motivos: ["Nome contém possível credencial."], valor: texto };
  }
  return { valido: true, motivos: [], valor: texto };
}

export function validarEmail(valor: unknown): ResultadoValidacao {
  const texto = sanitizarTexto(valor, 200).toLowerCase();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto);
  return { valido: ok, motivos: ok ? [] : ["E-mail inválido."], valor: texto };
}

export function validarIntervalo(valor: unknown, min: number, max: number): ResultadoValidacao {
  const numero = typeof valor === "number" ? valor : Number.NaN;
  if (!Number.isFinite(numero)) return { valido: false, motivos: ["Valor não numérico."], valor: "" };
  if (numero < min || numero > max) {
    return { valido: false, motivos: [`Valor fora do intervalo [${min}, ${max}].`], valor: String(numero) };
  }
  return { valido: true, motivos: [], valor: String(numero) };
}

// Validação do payload de criação de missão, reutilizada pela UI.
export function validarMissao(payload: {
  titulo?: unknown;
  objetivo?: unknown;
  instrucoes?: unknown;
}): ResultadoValidacao {
  const motivos: string[] = [];
  const titulo = sanitizarTexto(payload.titulo, 160);
  if (titulo.length < 3) motivos.push("Título deve ter ao menos 3 caracteres.");
  if (detectarSegredos(String(payload.objetivo ?? "")).contem) motivos.push("Objetivo contém possível credencial.");
  if (detectarSegredos(String(payload.instrucoes ?? "")).contem) motivos.push("Instruções contêm possível credencial.");
  return { valido: motivos.length === 0, motivos, valor: titulo };
}
