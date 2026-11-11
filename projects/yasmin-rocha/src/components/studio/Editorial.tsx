import { useMemo, useState } from "react";
import { FORMATS, IDEAS, PILLARS, STATUSES, type PillarId } from "@/lib/athlete";
import { useLocal, uid } from "@/lib/storage";
import { Panel, Btn, Empty, Field, inputCls } from "./ui";

type Post = { id: string; date: string; title: string; format: string; pillar: PillarId; status: (typeof STATUSES)[number] };
const blank = (): Omit<Post, "id"> => ({ date: "", title: "", format: "Reel", pillar: "tecnica", status: "ideia" });
const pLabel = (id: string) => PILLARS.find((p) => p.id === id)?.label ?? id;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function Editorial() {
  const [posts, setPosts] = useLocal<Post[]>("posts", [], Array.isArray);
  const [filter, setFilter] = useState<PillarId | "all">("all");
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const week = useMemo(() => {
    const now = new Date(); const day = (now.getDay() + 6) % 7;
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + offset * 7);
    return Array.from({ length: 7 }, (_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
  }, [offset]);
  const wk = week.map(iso);
  const weekPosts = posts.filter((p) => wk.includes(p.date) && (filter === "all" || p.pillar === filter));
  const cnt = (f: string) => posts.filter((p) => wk.includes(p.date) && p.format === f).length;

  const save = () => {
    if (!form.title.trim() || !form.date) return;
    if (editing) setPosts(posts.map((p) => (p.id === editing ? { ...form, id: editing } : p)));
    else setPosts([...posts, { ...form, id: uid() }]);
    setForm(blank()); setEditing(null);
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por pilar">
        {[{ id: "all", label: "Todos" }, ...PILLARS].map((p) => (
          <button key={p.id} onClick={() => setFilter(p.id as PillarId | "all")} aria-pressed={filter === p.id} className={`rounded-full border px-3 py-1.5 text-sm transition ${filter === p.id ? "border-primary bg-primary text-primary-foreground" : "hairline hover:border-foreground"}`}>{p.label}</button>
        ))}
      </div>

      <Panel kicker="Meta semanal sugerida: 3 Reels · 1 carrossel · 1 collab · stories adaptáveis" title="Calendário semanal" actions={
        <div className="flex items-center gap-2"><Btn variant="ghost" onClick={() => setOffset(offset - 1)} aria-label="Semana anterior">←</Btn><Btn variant="ghost" onClick={() => setOffset(0)}>Hoje</Btn><Btn variant="ghost" onClick={() => setOffset(offset + 1)} aria-label="Próxima semana">→</Btn></div>
      }>
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          {[["Reel", 3], ["Carrossel", 1], ["Collab", 1]].map(([f, t]) => <span key={f} className={cnt(f as string) >= (t as number) ? "text-primary" : "text-muted-foreground"}>{f}: <b>{cnt(f as string)}/{t}</b></span>)}
        </div>
        <div className="grid gap-2 md:grid-cols-7">
          {week.map((d, i) => {
            const items = weekPosts.filter((p) => p.date === wk[i]);
            const today = wk[i] === iso(new Date());
            return (
              <div key={wk[i]} className={`min-h-28 rounded-md border p-2 ${today ? "border-primary" : "hairline"}`}>
                <button className="eyebrow mb-2 w-full text-left text-muted-foreground hover:text-primary" onClick={() => { setEditing(null); setForm({ ...blank(), date: wk[i]! }); }} aria-label={`Adicionar post em ${d.toLocaleDateString("pt-BR")}`}>
                  {d.toLocaleDateString("pt-BR", { weekday: "short" })} {d.getDate()} <span className="float-right">+</span>
                </button>
                {items.map((p) => (
                  <button key={p.id} onClick={() => { setForm(p); setEditing(p.id); }} className="mb-1 block w-full rounded bg-muted p-2 text-left text-xs transition hover:bg-accent">
                    <span className="font-semibold">{p.format}</span> · {p.title}<span className="block text-[0.65rem] text-muted-foreground">{p.status}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel kicker={editing ? "Editando" : "Novo post"} title={editing ? "Editar post" : "Adicionar post"}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="col-span-2"><Field label="Título"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field></div>
          <Field label="Data"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Formato"><select className={inputCls} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>{FORMATS.map((f) => <option key={f}>{f}</option>)}</select></Field>
          <Field label="Pilar"><select className={inputCls} value={form.pillar} onChange={(e) => setForm({ ...form, pillar: e.target.value as PillarId })}>{PILLARS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></Field>
          <Field label="Status"><select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Post["status"] })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <div className="mt-3 flex gap-2">
          <Btn onClick={save} disabled={!form.title.trim() || !form.date}>{editing ? "Salvar" : "Adicionar"}</Btn>
          {editing && <><Btn variant="ghost" onClick={() => { setForm(blank()); setEditing(null); }}>Cancelar</Btn><Btn variant="danger" onClick={() => { setPosts(posts.filter((p) => p.id !== editing)); setForm(blank()); setEditing(null); }}>Excluir</Btn></>}
        </div>
        {posts.length === 0 && <div className="mt-4"><Empty title="Calendário vazio" text="Clique num dia ou use uma das ideias abaixo para começar." /></div>}
      </Panel>

      <Panel kicker="Exemplos editoriais" title="10 ideias com gancho e roteiro">
        <div className="grid gap-3 md:grid-cols-2">
          {IDEAS.filter((i) => filter === "all" || i.pillar === filter).map((i, n) => (
            <article key={i.title} className="rounded-md border hairline p-4">
              <div className="flex items-baseline justify-between gap-2"><span className="eyebrow text-primary">{i.format} · {pLabel(i.pillar)}</span><span className="display text-2xl text-slate-soft">{String(n + 1).padStart(2, "0")}</span></div>
              <h3 className="display mt-1 text-2xl">{i.title}</h3>
              <p className="mt-2 text-sm"><b>Gancho:</b> “{i.hook}”</p>
              <p className="mt-1 text-sm text-muted-foreground"><b className="text-foreground">Roteiro:</b> {i.script}</p>
              <p className="mt-1 text-sm text-muted-foreground"><b className="text-foreground">CTA:</b> {i.cta}</p>
              <button className="mt-3 text-sm font-medium text-primary hover:underline" onClick={() => { setEditing(null); setForm({ ...blank(), title: i.title, format: i.format, pillar: i.pillar, date: wk[0]! }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Usar no calendário →</button>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}