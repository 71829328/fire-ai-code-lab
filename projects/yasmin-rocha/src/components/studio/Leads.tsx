import { useState } from "react";
import { useLocal, uid } from "@/lib/storage";
import { Panel, Btn, Empty, Field, inputCls } from "./ui";

const STAGES = ["Mapeada", "Contato feito", "Em conversa", "Proposta", "Fechada", "Sem retorno"];
type Lead = { id: string; name: string; sector: string; channel: string; owner: string; stage: string; next: string; notes: string };
const blank = (): Omit<Lead, "id"> => ({ name: "", sector: "", channel: "", owner: "", stage: STAGES[0]!, next: "", notes: "" });

export function Leads() {
  const [leads, setLeads] = useLocal<Lead[]>("leads", [], Array.isArray);
  const [f, setF] = useState(blank());
  const [edit, setEdit] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const shown = leads.filter((l) => (l.name + l.sector + l.notes).toLowerCase().includes(q.toLowerCase()));
  const save = () => { if (!f.name.trim()) return; setLeads(edit ? leads.map((l) => (l.id === edit ? { ...f, id: edit } : l)) : [...leads, { ...f, id: uid() }]); setF(blank()); setEdit(null); };
  return (
    <div className="grid gap-5">
      <Panel kicker={`${leads.length} lead(s) cadastrados`} title="Prospecção comercial" actions={<input className={inputCls + " max-w-56"} placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar leads" />}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["name", "sector", "channel", "owner"] as const).map((k) => <Field key={k} label={{ name: "Marca", sector: "Setor", channel: "Canal", owner: "Responsável" }[k]}><input className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
          <Field label="Etapa"><select className={inputCls} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Próximo contato"><input type="date" className={inputCls} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="Notas"><input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
        </div>
        <div className="mt-3 flex gap-2"><Btn onClick={save} disabled={!f.name.trim()}>{edit ? "Salvar" : "Adicionar lead"}</Btn>
          {edit && <><Btn variant="ghost" onClick={() => { setF(blank()); setEdit(null); }}>Cancelar</Btn><Btn variant="danger" onClick={() => { if(window.confirm("Excluir este contato da lista local?")) {setLeads(leads.filter((l) => l.id !== edit)); setF(blank()); setEdit(null);} }}>Excluir</Btn></>}</div>
      </Panel>
      {leads.length === 0 ? <Empty title="Nenhum lead ainda" text="A lista começa vazia de propósito. Adicione apenas marcas reais que a equipe decidir abordar." /> : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((s) => { const items = shown.filter((l) => l.stage === s); return (
            <div key={s} className="w-64 shrink-0 rounded-lg border hairline bg-card p-3">
              <p className="eyebrow mb-3 flex justify-between text-muted-foreground">{s}<span>{items.length}</span></p>
              {items.map((l) => (
                <button key={l.id} onClick={() => { setF(l); setEdit(l.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mb-2 block w-full rounded-md bg-muted p-3 text-left text-sm hover:bg-accent">
                  <b>{l.name}</b><span className="block text-xs text-muted-foreground">{l.sector}{l.next && ` · ${new Date(l.next + "T12:00").toLocaleDateString("pt-BR")}`}</span>
                </button>
              ))}
            </div>); })}
        </div>
      )}
    </div>
  );
}