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
import {
  createOpsSeed,
  opsReducer,
  podeFazer as podeFazerEm,
  usuarioAtivo as usuarioAtivoDe,
  type OpsAction,
  type OpsState,
} from "./ops";
import { carregarOpsLocal, salvarOpsLocal } from "./persistence";
import type { Permissao, Usuario } from "./types";

// Contexto React do núcleo operacional (LAB-003).
//
// Camada SEPARADA do estado demonstrativo (StoreContext, v2). Persiste em
// localStorage sob uma chave própria e nunca guarda tokens/segredos: apenas o
// estado lógico (organizações, usuários, runs, aprovações, auditoria, consumo,
// evidências).

export interface OpsPersistencia {
  status: "ok" | "falha";
  mensagem: string;
}

interface OpsValue {
  state: OpsState;
  dispatch: Dispatch<OpsAction>;
  persistencia: OpsPersistencia;
  avisoCarga: string | null;
  limparAvisoCarga: () => void;
  usuarioAtivo: Usuario | null;
  podeFazer: (permissao: Permissao) => boolean;
}

const okPersistencia: OpsPersistencia = {
  status: "ok",
  mensagem: "Núcleo operacional salvo neste navegador.",
};

function carregarInicial(): { state: OpsState; aviso: string | null } {
  const carregado = carregarOpsLocal();
  if (carregado.state) return { state: carregado.state, aviso: carregado.aviso };
  return { state: createOpsSeed(), aviso: carregado.aviso };
}

const OpsContext = createContext<OpsValue | null>(null);

export function OpsProvider({ children }: { children: ReactNode }) {
  const [carregado] = useState(() => carregarInicial());
  const [state, dispatch] = useReducer(opsReducer, carregado.state);
  const [persistencia, setPersistencia] = useState<OpsPersistencia>(okPersistencia);
  const [avisoCarga, setAvisoCarga] = useState<string | null>(carregado.aviso);

  useEffect(() => {
    const resultado = salvarOpsLocal(state);
    setPersistencia(
      resultado.ok ? okPersistencia : { status: "falha", mensagem: resultado.mensagem }
    );
  }, [state]);

  const limparAvisoCarga = useCallback(() => setAvisoCarga(null), []);

  const usuarioAtivo = useMemo(() => usuarioAtivoDe(state), [state]);
  const podeFazer = useCallback((permissao: Permissao) => podeFazerEm(state, permissao), [state]);

  const value = useMemo<OpsValue>(
    () => ({
      state,
      dispatch,
      persistencia,
      avisoCarga,
      limparAvisoCarga,
      usuarioAtivo,
      podeFazer,
    }),
    [state, persistencia, avisoCarga, limparAvisoCarga, usuarioAtivo, podeFazer]
  );

  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}

export function useOps(): OpsValue {
  const context = useContext(OpsContext);
  if (!context) throw new Error("useOps precisa estar dentro de <OpsProvider>.");
  return context;
}
