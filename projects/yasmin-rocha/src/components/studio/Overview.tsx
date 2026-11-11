import { useState } from "react";
import { BASELINE } from "@/lib/athlete";
import { useLocal, uid } from "@/lib/storage";
import { Panel, Empty, Btn, Field, inputCls } from "./ui";

type Snap = { id: string; date: string; followers: number; posts: number; following: number };
type Goal = { id: string; label: string; metric: "followers" | "posts"; target: number; deadline: string };
const isArr = (v: unknown) => Array.isArray(v);
const isCount = (s: string) => /^\\d{1,9}$/.test(s) && Number.isSafeInteger(Number(s));
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const fmt = (n: number) => n.toLocaleString("pt-BR");
const fdate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

export function Overview() {
  const [snaps, setSnaps] = useLocal<Snap[]>("snapshots", [], isArr);
  const [goals, setGoals] = useLocal<Goal[]>("goals", [], isArr);
  const all: Snap[] = [{ id: "base", ...BASELINE }, ...snaps].sort((a, b) => a.date.localeCompare(b.date));
  const latest = all[all.length - 1]!;
  const [f, setF] = useState({ date: "", followers: "", posts: "", following: "" });
  const [g, setG] = useState({ label: "", metric: "followers" as Goal["metric"], target: "", deadline: "" });

  const validSnap = f.date > BASELINE.date && f.date <= todayLocal() && [f.followers,f.posts,f.following].every(isCount);
  const addSnap = () => {
    if (!validSnap) return;
    if (snaps.some(s => s.date === f.date) && !window.confirm("Já existe uma captura nesta data. Substituí-la?")) return;
    setSnaps([...snaps.filter((s) => s.date !== f.date), { id: uid(), date: f.date, followers: Number(f.followers), posts: Number(f.posts), following: Number(f.following) }]);
    setF({ date: "", followers: "", posts: "", following: "" });
  };
  const validGoal = g.label.trim().length > 0 && isCount(g.target) && Number(g.target) > BASELINE[g.metric] && (!g.deadline || g.deadline >= todayLocal());

  return (
    <div className="grid gap-5">
      <div className="grid gap-px overflow-hidden rounded-lg border hairline bg-border sm:grid-cols-3">
        {(["followers", "posts", "following"] as const).map((k) => (
          <div key={k} className="bg-card p-6">
            <p className="eyebrow text-muted-foreground">{({ followers: "Seguidores", posts: "Posts", following: "Seguindo" })[k]}</p>
            <p className="display mt-2 text-6xl">{fmt(latest[k])}</p>
            <p className="mt-2 text-xs text-muted-foreground">Captura manual · {fdate(latest.date)} · não conectado ao Instagram</p>
          </div>
        ))}
      </div>

      <Panel kicker="Evolução" title="Snapshots datados">
        {all.length >= 2 ? <Chart data={all} /> : <Empty title="Apenas 1 ponto real" text="A evolução aparece quando houver pelo menos 2 capturas. Adicione um novo snapshot copiando os números do perfil." />}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          <Field label="Data"><input type="date" min="2026-11-12" max={todayLocal()} className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Seguidores"><input type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={f.followers} onChange={(e) => setF({ ...f, followers: e.target.value })} /></Field>
          <Field label="Posts"><input type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={f.posts} onChange={(e) => setF({ ...f, posts: e.target.value })} /></Field>
          <Field label="Seguindo"><input type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={f.following} onChange={(e) => setF({ ...f, following: e.target.value })} /></Field>
          <div className="flex items-end"><Btn onClick={addSnap} disabled={!validSnap} className="w-full">Adicionar</Btn></div>
        </div>
        <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead><tr className="eyebrow text-left text-muted-foreground"><th className="py-2">Data</th><th>Seguidores</th><th>Posts</th><th>Seguindo</th><th /></tr></thead>
          <tbody>{all.map((s) => (
            <tr key={s.id} className="border-t hairline"><td className="py-2">{fdate(s.date)}{s.id === "base" && <span className="ml-2 text-xs text-primary">baseline</span>}</td><td>{fmt(s.followers)}</td><td>{fmt(s.posts)}</td><td>{fmt(s.following)}</td>
              <td className="text-right">{s.id !== "base" && <button className="text-xs text-destructive" onClick={() => { if(window.confirm("Excluir esta captura manual?")) setSnaps(snaps.filter((x) => x.id !== s.id)); }}>Excluir</button>}</td></tr>
          ))}</tbody>
        </table></div>
      </Panel>

      <Panel kicker="Meta definida manualmente" title="Metas vs. baseline">
        {goals.length === 0 && <Empty title="Nenhuma meta ainda" text="Defina uma meta numérica com prazo. São decisões da equipe, não previsões de crescimento." />}
        <ul className="grid gap-3">
          {goals.map((goal) => {
            const base = BASELINE[goal.metric], cur = latest[goal.metric];
            const pct = goal.target > base ? Math.max(0, Math.min(100, ((cur - base) / (goal.target - base)) * 100)) : 0;
            return (
              <li key={goal.id} className="rounded-md border hairline p-4">
                <div className="flex justify-between gap-3"><span className="font-medium">{goal.label}</span><button className="text-xs text-destructive" onClick={() => { if(window.confirm("Excluir esta meta?")) setGoals(goals.filter((x) => x.id !== goal.id)); }}>Excluir</button></div>
                <p className="mt-1 text-xs text-muted-foreground">Baseline {fmt(base)} → atual {fmt(cur)} → meta {fmt(goal.target)} {goal.deadline && `até ${fdate(goal.deadline)}`} · meta definida manualmente</p>
                <div className="mt-3 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
              </li>
            );
          })}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="col-span-2"><Field label="Descrição"><input className={inputCls} value={g.label} onChange={(e) => setG({ ...g, label: e.target.value })} placeholder="Ex.: chegar a 7 mil seguidores" /></Field></div>
          <Field label="Métrica"><select className={inputCls} value={g.metric} onChange={(e) => setG({ ...g, metric: e.target.value as Goal["metric"] })}><option value="followers">Seguidores</option><option value="posts">Posts</option></select></Field>
          <Field label="Alvo"><input type="number" min="0" step="1" inputMode="numeric" className={inputCls} value={g.target} onChange={(e) => setG({ ...g, target: e.target.value })} /></Field>
          <Field label="Prazo"><input type="date" className={inputCls} value={g.deadline} onChange={(e) => setG({ ...g, deadline: e.target.value })} /></Field>
        </div>
        <Btn className="mt-3" disabled={!validGoal} onClick={() => { if (!validGoal) return; setGoals([...goals, { id: uid(), label: g.label, metric: g.metric, target: Number(g.target), deadline: g.deadline }]); setG({ label: "", metric: "followers", target: "", deadline: "" }); }}>Adicionar meta</Btn>
      </Panel>
    </div>
  );
}

function Chart({ data }: { data: Snap[] }) {
  const W = 600, H = 160, vals = data.map((d) => d.followers);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts: [number,number][] = data.map((d, i) => [(i / (data.length - 1)) * (W - 40) + 20, H - 20 - ((d.followers - min) / span) * (H - 40)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução de seguidores entre capturas reais">
      <polyline fill="none" stroke="var(--primary)" strokeWidth="2.5" points={pts.map((p) => p.join(",")).join(" ")} />
      {pts.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="4" fill="var(--coral)" /><text x={x} y={y - 10} textAnchor="middle" fontSize="11" fill="var(--ink)">{fmt(data[i]!.followers)}</text></g>)}
    </svg>
  );
}