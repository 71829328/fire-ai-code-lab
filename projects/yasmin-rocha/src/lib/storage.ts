import { useEffect, useState } from "react";

const PREFIX = "yr-studio:";
export const STORE_KEYS = ["snapshots", "tasks", "posts", "leads", "pending", "goals", "brief"] as const;

export function useLocal<T>(key: string, initial: T, validate: (v: unknown) => boolean = () => true) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw) { const p = JSON.parse(raw); if (validate(p)) setValue(p); }
    } catch { /* ignore corrupt */ }
    setReady(true);
    const h = () => { try { const raw = localStorage.getItem(PREFIX + key); setValue(raw ? JSON.parse(raw) : initial); } catch { /* */ } };
    window.addEventListener("yr-import", h);
    return () => window.removeEventListener("yr-import", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { if (ready) localStorage.setItem(PREFIX + key, JSON.stringify(value)); }, [key, value, ready]);
  return [value, setValue] as const;
}

export function exportAll() {
  const data: Record<string, unknown> = { app: "yasmin-rocha-studio", version: 1, exportedAt: new Date().toISOString() };
  for (const k of STORE_KEYS) { const r = localStorage.getItem(PREFIX + k); if (r) data[k] = JSON.parse(r); }
  return data;
}
export function importAll(json: unknown) {
  if (!json || typeof json !== "object" || (json as { app?: string }).app !== "yasmin-rocha-studio") throw new Error("Arquivo inválido: não é uma exportação do Studio.");
  for (const k of STORE_KEYS) { const v = (json as Record<string, unknown>)[k]; if (Array.isArray(v) || (v && typeof v === "object")) localStorage.setItem(PREFIX + k, JSON.stringify(v)); }
  window.dispatchEvent(new Event("yr-import"));
}
export const uid = () => Math.random().toString(36).slice(2, 10);