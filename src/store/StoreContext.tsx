import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { AppState } from "../types";
import { initialState, reducer, type Action } from "./reducer";
import { parseStoredState, type ValidationIssue } from "../domain/validation";

// v2 — o esquema muda (origem/conexão/missões/integrações) e a chave sobe de versão
// para não confundir um estado antigo com o novo formato.
export const STORAGE_KEY = "fire-agent-command-center:state:v2";

export interface Persistencia {
  status: "ok" | "falha" | "indisponivel";
  mensagem: string;
}

export interface CargaInfo {
  migrado: boolean;
  descartados: number;
  issues: ValidationIssue[];
  aviso: string | null;
}

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  persistencia: Persistencia;
  carga: CargaInfo;
  limparAvisoCarga: () => void;
}

const okPersistencia: Persistencia = { status: "ok", mensagem: "Dados salvos neste navegador." };

function ehStorageDisponivel(): boolean {
  try {
    const chave = `${STORAGE_KEY}:teste`;
    window.localStorage.setItem(chave, "1");
    window.localStorage.removeItem(chave);
    return true;
  } catch {
    return false;
  }
}

// Lê e valida integralmente o estado armazenado, reportando migração/descartes/falhas.
export function carregarEstado(): { state: AppState; carga: CargaInfo; persistencia: Persistencia } {
  const semAviso: CargaInfo = { migrado: false, descartados: 0, issues: [], aviso: null };

  if (typeof window === "undefined") {
    return { state: initialState(), carga: semAviso, persistencia: okPersistencia };
  }

  if (!ehStorageDisponivel()) {
    return {
      state: initialState(),
      carga: {
        ...semAviso,
        aviso: "Armazenamento local indisponível: as alterações não serão salvas ao fechar a página.",
      },
      persistencia: {
        status: "indisponivel",
        mensagem: "Armazenamento local indisponível neste navegador.",
      },
    };
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {
      state: initialState(),
      carga: { ...semAviso, aviso: "Falha ao ler o armazenamento local." },
      persistencia: { status: "falha", mensagem: "Não foi possível ler o armazenamento local." },
    };
  }

  if (!raw) {
    return { state: initialState(), carga: semAviso, persistencia: okPersistencia };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      state: initialState(),
      carga: {
        ...semAviso,
        aviso: "O conteúdo salvo estava corrompido e foi substituído pelos dados demonstrativos.",
      },
      persistencia: { status: "falha", mensagem: "Backup local ilegível; dados demonstrativos restaurados." },
    };
  }

  const resultado = parseStoredState(parsed);
  if (!resultado.state) {
    return {
      state: initialState(),
      carga: {
        ...semAviso,
        issues: resultado.issues,
        aviso: "Os dados salvos não puderam ser validados e foram substituídos pelos demonstrativos.",
      },
      persistencia: { status: "falha", mensagem: "Estado armazenado inválido; dados demonstrativos restaurados." },
    };
  }

  const partes: string[] = [];
  if (resultado.migrado) partes.push("formato anterior migrado para o atual");
  if (resultado.descartados > 0) partes.push(`${resultado.descartados} registro(s) inválido(s) descartado(s)`);

  return {
    state: resultado.state,
    carga: {
      migrado: resultado.migrado,
      descartados: resultado.descartados,
      issues: resultado.issues,
      aviso: partes.length > 0 ? `Estado carregado com ajustes: ${partes.join("; ")}.` : null,
    },
    persistencia: okPersistencia,
  };
}

export function salvarEstado(state: AppState): Persistencia {
  if (typeof window === "undefined") return okPersistencia;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return okPersistencia;
  } catch {
    return {
      status: "falha",
      mensagem:
        "Falha ao salvar no navegador (armazenamento cheio ou bloqueado). As alterações podem ser perdidas ao fechar a página.",
    };
  }
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [carregado] = useState(() => carregarEstado());
  const [state, dispatch] = useReducer(reducer, carregado.state);
  const [persistencia, setPersistencia] = useState<Persistencia>(carregado.persistencia);
  const [carga, setCarga] = useState<CargaInfo>(carregado.carga);

  useEffect(() => {
    setPersistencia(salvarEstado(state));
  }, [state]);

  const limparAvisoCarga = useCallback(() => {
    setCarga((atual) => ({ ...atual, aviso: null, issues: [] }));
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, persistencia, carga, limparAvisoCarga }),
    [state, persistencia, carga, limparAvisoCarga]
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore precisa estar dentro de <StoreProvider>.");
  return context;
}
