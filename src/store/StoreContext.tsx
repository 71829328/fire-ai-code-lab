import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { AppState } from "../types";
import { initialState, reducer, type Action } from "./reducer";

export const STORAGE_KEY = "fire-agent-command-center:state:v1";

function isState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppState>;
  return (
    Array.isArray(candidate.agentes) &&
    Array.isArray(candidate.projetos) &&
    Array.isArray(candidate.tarefas) &&
    Array.isArray(candidate.atividades)
  );
}

export function loadState(): AppState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed: unknown = JSON.parse(raw);
    return isState(parsed) ? parsed : initialState();
  } catch {
    return initialState();
  }
}

export function persistState(state: AppState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistência silenciosa: se o armazenamento estiver indisponível,
    // a aplicação continua funcionando em memória.
  }
}

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    persistState(state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore precisa estar dentro de <StoreProvider>.");
  return context;
}
