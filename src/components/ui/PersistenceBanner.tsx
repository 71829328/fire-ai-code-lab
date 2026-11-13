import { AlertTriangle, HardDriveDownload, Info, X } from "lucide-react";
import { useStore } from "../../store/StoreContext";

// Informa o usuário sobre (a) falhas de persistência e (b) ajustes feitos ao
// carregar/validar dados. Nada falha em silêncio.
export function PersistenceBanner() {
  const { persistencia, carga, limparAvisoCarga } = useStore();

  const temFalhaPersistencia = persistencia.status !== "ok";
  const temAvisoCarga = Boolean(carga.aviso) || carga.issues.length > 0;

  if (!temFalhaPersistencia && !temAvisoCarga) return null;

  return (
    <div className="mb-4 space-y-2">
      {temFalhaPersistencia && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Falha de persistência</p>
            <p className="text-rose-200/90">{persistencia.mensagem}</p>
          </div>
        </div>
      )}

      {temAvisoCarga && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {carga.aviso ?? "Ajustes aplicados aos dados armazenados"}
            </p>
            {carga.issues.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-200/90">
                {carga.issues.slice(0, 6).map((issue, index) => (
                  <li key={`${issue.caminho}-${index}`}>
                    <span className="font-mono text-xs">{issue.caminho}</span>: {issue.mensagem}
                  </li>
                ))}
                {carga.issues.length > 6 && (
                  <li>e mais {carga.issues.length - 6} ocorrência(s).</li>
                )}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={limparAvisoCarga}
            className="rounded-lg p-1 text-amber-200/80 hover:bg-white/10"
            aria-label="Dispensar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <p className="flex items-center gap-2 text-[11px] text-slate-500">
        <HardDriveDownload className="h-3.5 w-3.5" />
        {persistencia.status === "ok"
          ? "Persistência local ativa (localStorage deste navegador)."
          : persistencia.mensagem}
      </p>
    </div>
  );
}
