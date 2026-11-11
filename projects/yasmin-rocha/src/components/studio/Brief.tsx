import { useLocal } from "@/lib/storage";
import { Panel, inputCls } from "./ui";
const ITEMS = ["Foto real oficial da atleta", "Bio autorizada pela atleta", "Anos/datas de cada resultado", "Contatos para patrocínio", "Informações de projeto social", "Permissão de uso de imagem"];
export function Brief() {
  const [done, setDone] = useLocal<Record<string, boolean>>("pending", {}, (v) => !!v && typeof v === "object");
  const [brief, setBrief] = useLocal<{ text: string }>("brief", { text: "" }, (v) => !!v && typeof v === "object");
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Panel kicker={`${ITEMS.filter((i) => done[i]).length}/${ITEMS.length} confirmados`} title="Pendências para confirmar">
        {ITEMS.map((i) => <label key={i} className="flex cursor-pointer gap-3 border-t hairline py-3 text-sm"><input type="checkbox" checked={!!done[i]} onChange={() => setDone({ ...done, [i]: !done[i] })} /><span className={done[i] ? "line-through text-muted-foreground" : ""}>{i}</span></label>)}
      </Panel>
      <Panel kicker="Salvo neste navegador" title="Briefing">
        <textarea className={inputCls + " min-h-64"} value={brief.text} onChange={(e) => setBrief({ text: e.target.value })} placeholder="Anotações da conversa com a atleta…" aria-label="Briefing" />
      </Panel>
    </div>
  );
}