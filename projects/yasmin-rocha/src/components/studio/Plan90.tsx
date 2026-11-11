import { useLocal } from "@/lib/storage";
import { Panel } from "./ui";

const PHASES = [
  { id: "f", name: "Fundação", days: "Dias 1–15", tasks: ["Validar bio nova com a atleta", "Criar 5 destaques com capas consistentes", "Definir paleta e tipografia do grid", "Separar banco de 30 fotos/vídeos autorizados", "Listar competições dos próximos 90 dias"] },
  { id: "c", name: "Consistência", days: "Dias 16–45", tasks: ["Publicar 3 Reels por semana", "Publicar 1 carrossel por semana", "Stories em pelo menos 4 dias da semana", "Fazer 1 collab no período", "Registrar snapshot de números a cada 15 dias"] },
  { id: "p", name: "Parcerias", days: "Dias 46–90", tasks: ["Montar mídia kit com fotos oficiais", "Mapear 15 marcas com afinidade", "Enviar contato para 10 marcas", "Entregar 1 conteúdo-teste com marca/local", "Revisar resultados e ajustar plano"] },
];

export function Plan90() {
  const [done, setDone] = useLocal<Record<string, boolean>>("tasks", {}, (v) => !!v && typeof v === "object");
  const total = PHASES.reduce((a, p) => a + p.tasks.length, 0);
  const count = Object.values(done).filter(Boolean).length;
  return (
    <Panel kicker="Metas de processo, não de números" title="Estratégia 90 dias" actions={<span className="display text-4xl">{count}<span className="text-muted-foreground">/{total}</span></span>}>
      <div className="mb-6 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(count / total) * 100}%` }} /></div>
      <ol className="grid gap-6 md:grid-cols-3">
        {PHASES.map((p, pi) => (
          <li key={p.id} className="relative border-t-2 border-foreground pt-4">
            <span className="display text-6xl text-slate-soft">0{pi + 1}</span>
            <h3 className="display text-3xl">{p.name}</h3><p className="eyebrow text-primary">{p.days}</p>
            <ul className="mt-4 space-y-1">{p.tasks.map((t, i) => {
              const k = `${p.id}${i}`;
              return (
                <li key={k}><label className="flex cursor-pointer gap-3 rounded-md p-2 text-sm hover:bg-muted">
                  <input type="checkbox" className="mt-0.5 accent-[var(--primary)]" checked={!!done[k]} onChange={() => setDone({ ...done, [k]: !done[k] })} />
                  <span className={done[k] ? "text-muted-foreground line-through" : ""}>{t}</span>
                </label></li>
              );
            })}</ul>
          </li>
        ))}
      </ol>
    </Panel>
  );
}