import { useEffect, useState } from "react";

const PREFIX = "yr-studio:";
export const STORE_KEYS = ["snapshots", "tasks", "posts", "leads", "pending", "goals", "brief"] as const;
export type StoreKey = (typeof STORE_KEYS)[number];
type Bag = Record<string, unknown>;
const record = (v: unknown): v is Bag => v !== null && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const str = (v: unknown): v is string => typeof v === "string";
const isoDate = (v: unknown) => str(v) && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v + "T12:00:00").valueOf());
const flagMap = (v: unknown) => record(v) && Object.values(v).every(x => typeof x === "boolean");
const arrayOf = (v: unknown, fn: (a: unknown) => boolean) => Array.isArray(v) && v.length <= 1000 && v.every(fn);
const postStatuses = ["ideia","roteiro","gravado","publicado"];
const postPillars = ["tecnica","bastidor","rotina","conquista","comunidade"];
const postFormats = ["Reel","Carrossel","Foto","Stories","Collab"];
export const isValidValue = (key: StoreKey, v: unknown): boolean => {
  switch (key) {
    case "snapshots": return arrayOf(v, x => record(x) && str(x.id) && isoDate(x.date) && finite(x.followers) && finite(x.posts) && finite(x.following));
    case "goals": return arrayOf(v, x => record(x) && str(x.id) && str(x.label) && (x.metric === "followers" || x.metric === "posts") && finite(x.target) && (x.deadline === "" || isoDate(x.deadline)));
    case "posts": return arrayOf(v, x => record(x) && str(x.id) && isoDate(x.date) && str(x.title) && postFormats.includes(String(x.format)) && postPillars.includes(String(x.pillar)) && postStatuses.includes(String(x.status)));
    case "leads": return arrayOf(v, x => record(x) && ["id","name","sector","channel","owner","stage","next","notes"].every(k => str(x[k])) && (x.next === "" || isoDate(x.next)));
    case "tasks":
    case "pending": return flagMap(v);
    case "brief": return record(v) && str(v.text) && v.text.length <= 200000;
  }
};
function getLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (isValidValue(key as StoreKey, value)) return value as T;
    }
  } catch { /* storage unavailable or corrupt */ }
  return fallback;
}
export function useLocal<T>(key: StoreKey, initial: T, _validate?: (v: unknown) => boolean) {
  const [value, setValue] = useState<T>(() => getLocal(key, initial));
  useEffect(() => {
    const onImport = () => setValue(getLocal(key, initial));
    const onCrossTab = (e: StorageEvent) => {
      if (e.key === PREFIX + key || e.key === null) onImport();
    };
    window.addEventListener("yr-import", onImport);
    window.addEventListener("storage", onCrossTab);
    return () => {
      window.removeEventListener("yr-import", onImport);
      window.removeEventListener("storage", onCrossTab);
    };
  }, [key, initial]);
  useEffect(() => {
    if (!isValidValue(key, value)) return;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* private mode, quota or disabled storage */ }
  }, [key, value]);
  return [value, setValue] as const;
}
export function exportAll() {
  const data: Record<string, unknown> = { app: "yasmin-rocha-studio", version: 1, exportedAt: new Date().toISOString() };
  for (const key of STORE_KEYS) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isValidValue(key, parsed)) data[key] = parsed;
      }
    } catch { /* skip invalid data */ }
  }
  return data;
}
export function importAll(json: unknown): number {
  if (!record(json) || json.app !== "yasmin-rocha-studio" || json.version !== 1)
    throw new Error("Arquivo inválido ou incompatível com este Studio.");
  const updates: Array<[StoreKey, string]> = [];
  for (const key of STORE_KEYS) {
    if (!(key in json)) continue;
    if (!isValidValue(key, json[key])) throw new Error("Os dados de " + key + " não são válidos.");
    updates.push([key, JSON.stringify(json[key])]);
  }
  if (updates.length === 0) throw new Error("O backup não contém dados do Studio.");
  if (JSON.stringify(json).length > 1000000) throw new Error("Backup excede 1 MB.");
  const before = updates.map(([key]) => [key, localStorage.getItem(PREFIX + key)] as const);
  try {
    for (const [key, value] of updates) localStorage.setItem(PREFIX + key, value);
  } catch {
    for (const [key, value] of before) {
      try { value === null ? localStorage.removeItem(PREFIX + key) : localStorage.setItem(PREFIX + key, value); } catch { /* unavailable */ }
    }
    throw new Error("Não foi possível salvar o backup neste navegador.");
  }
  window.dispatchEvent(new Event("yr-import"));
  return updates.length;
}
export const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 12));
