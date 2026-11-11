import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Wordmark } from "@/components/site/Wordmark";
import { Overview } from "@/components/studio/Overview";
import { Audit } from "@/components/studio/Audit";
import { Plan90 } from "@/components/studio/Plan90";
import { Editorial } from "@/components/studio/Editorial";
import { Leads } from "@/components/studio/Leads";
import { Brief } from "@/components/studio/Brief";
import { Btn } from "@/components/studio/ui";
import { exportAll, importAll } from "@/lib/storage";



const TABS = [["overview", "Visão geral", Overview], ["audit", "Auditoria", Audit], ["plan", "90 dias", Plan90], ["editorial", "Editorial", Editorial], ["leads", "Parcerias", Leads], ["brief", "Pendências", Brief]] as const;

export function Studio() {
  const [tab, setTab] = useState<string>("overview");
  const fileRef = useRef<HTMLInputElement>(null);
  const Comp = TABS.find((t) => t[0] === tab)![2];
  const doExport = () => { const b = new Blob([JSON.stringify(exportAll(), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "yasmin-studio.json"; a.click(); };
  const doImport = async (f?: File) => { if (!f) return; try { importAll(JSON.parse(await f.text())); toast.success("Dados importados"); } catch (e) { toast.error((e as Error).message); } };
  return (
    <div className="min-h-screen">
      <header className="border-b hairline bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3"><Link to="/"><Wordmark compact /></Link><span className="eyebrow rounded-full bg-coral/15 px-2 py-1 text-coral">Studio</span></div>
          <div className="flex gap-2"><Btn variant="ghost" onClick={doExport}>Exportar JSON</Btn><Btn variant="ghost" onClick={() => fileRef.current?.click()}>Importar</Btn>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ""; }} /></div>
        </div>
        <p className="mx-auto max-w-6xl px-5 pb-3 text-xs text-muted-foreground">Rascunho local neste navegador — nada é enviado a servidor nem sincronizado. Use Exportar para backup. Não é uma área privada segura.</p>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5" role="tablist">
          {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm transition ${tab === id ? "border-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8"><Comp /></main>
    </div>
  );
}