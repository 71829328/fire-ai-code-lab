import { useMemo, useState } from "react";
import {
  Building2,
  Database,
  Gauge,
  History as HistoryIcon,
  Lock,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { useOps } from "../platform/OpsContext";
import {
  PAPEL_LABEL,
  PERMISSOES_POR_PAPEL,
  ORIGEM_DADO_LABEL,
  type Papel,
} from "../platform/types";
import { usuariosDaOrganizacao } from "../platform/authz";
import { listarMigracoes, aplicarMigracoes } from "../platform/migrations";
import { criarRepositorio } from "../platform/persistence";
import { PapelBadge } from "../components/ui/opsBadges";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const resultadoStyle: Record<string, string> = {
  permitido: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  negado: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  info: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

export function Governance() {
  const { state, dispatch, usuarioAtivo } = useOps();
  const [provedorId, setProvedorId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("tokens");
  const [custo, setCusto] = useState("");
  const [moeda, setMoeda] = useState("BRL");

  const orgId = state.platform.organizacaoAtivaId;
  const usuarios = useMemo(() => usuariosDaOrganizacao(state.platform.usuarios, orgId), [state.platform.usuarios, orgId]);
  const auditoria = useMemo(
    () => state.platform.auditoria.filter((a) => a.organizacaoId === orgId).slice(0, 40),
    [state.platform.auditoria, orgId]
  );
  const consumo = useMemo(
    () => state.platform.consumo.filter((c) => c.organizacaoId === orgId),
    [state.platform.consumo, orgId]
  );
  const totalQuantidade = consumo.reduce((s, c) => s + c.quantidade, 0);
  const totalCusto = consumo.reduce((s, c) => s + c.custoEstimado, 0);

  const migracoes = listarMigracoes();
  const bloqueioMigracoes = aplicarMigracoes();
  const repos = useMemo(
    () => (["local", "memoria", "supabase"] as const).map((modo) => criarRepositorio(modo)),
    []
  );

  const permissoes = usuarioAtivo ? PERMISSOES_POR_PAPEL[usuarioAtivo.papel] : [];

  const registrarConsumo = () => {
    const qtd = Number(quantidade);
    if (!provedorId.trim() || !Number.isFinite(qtd) || qtd <= 0) return;
    dispatch({
      type: "consumo/registrar",
      payload: {
        provedorId: provedorId.trim(),
        agenteId: null,
        missaoId: null,
        runId: null,
        unidade: unidade.trim() || "unidades",
        quantidade: qtd,
        custoEstimado: Number.isFinite(Number(custo)) ? Number(custo) : 0,
        moeda: moeda.trim() || "BRL",
        origemDado: "informado_operador",
      },
    });
    setProvedorId("");
    setQuantidade("");
    setCusto("");
  };

  return (
    <div className="fire-page fire-page--governanca space-y-5">
      <div className="glass flex items-start gap-3 border-cyan-400/30 bg-cyan-400/[0.06] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
        <div>
          <h2 className="text-sm font-semibold text-cyan-100">
            Segurança, isolamento entre organizações e auditoria
          </h2>
          <p className="mt-1 text-sm text-cyan-200/80">
            Toda mutação gera registro de auditoria. Operações externas e gastos permanecem bloqueados.
            Nenhum token ou segredo é armazenado no frontend.
          </p>
        </div>
      </div>

      <section className="glass p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Building2 className="h-4 w-4 text-fire-soft" />
          Organização e identidade ativa
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Organização ativa (isolamento)</span>
            <select
              className="field"
              value={orgId}
              onChange={(e) => dispatch({ type: "organizacao/ativar", payload: { id: e.target.value } })}
            >
              {state.platform.organizacoes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome} ({o.ambiente})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Usuário ativo</span>
            <select
              className="field"
              value={state.platform.usuarioAtivoId}
              onChange={(e) => dispatch({ type: "usuario/ativar", payload: { id: e.target.value } })}
            >
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} — {PAPEL_LABEL[u.papel]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 glass-soft p-3">
          <div className="flex flex-wrap items-center gap-2">
            <UserCog className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-200">{usuarioAtivo?.nome ?? "—"}</span>
            {usuarioAtivo && <PapelBadge papel={usuarioAtivo.papel} />}
            <span className="ml-auto text-xs text-slate-500">{usuarioAtivo?.email}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {permissoes.length === 0 ? (
              <span className="text-xs text-slate-500">Sem permissões atribuídas.</span>
            ) : (
              permissoes.map((p) => (
                <span key={p} className="chip border-white/10 bg-white/5 text-slate-300">
                  {p}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Users className="h-4 w-4 text-fire-soft" />
            Usuários desta organização
          </h3>
          <ul className="mt-3 space-y-2">
            {usuarios.map((u) => (
              <li key={u.id} className="glass-soft flex flex-wrap items-center gap-2 p-2.5 text-sm">
                <span className="text-slate-200">{u.nome}</span>
                <PapelBadge papel={u.papel} />
                {!u.ativo && <span className="chip border-slate-500/30 bg-slate-500/10 text-slate-400">Inativo</span>}
                <span className="ml-auto text-xs text-slate-500">{u.email}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Matriz de papéis: {(["proprietario", "administrador", "operador", "revisor", "observador"] as Papel[]).length}{" "}
            níveis com menor privilégio por padrão.
          </p>
        </div>

        <div className="glass p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Database className="h-4 w-4 text-fire-soft" />
            Camada de persistência e migrações
          </h3>
          <ul className="mt-3 space-y-2">
            {repos.map((r) => (
              <li key={r.nome} className="glass-soft flex flex-wrap items-center gap-2 p-2.5 text-sm">
                <span className="font-mono text-xs text-slate-300">{r.nome}</span>
                <span
                  className={`chip ${r.disponivel ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-200"}`}
                >
                  {r.disponivel ? "disponível" : "indisponível"}
                </span>
                <span className="text-xs text-slate-400">{r.disponivelMotivo}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5 text-amber-200" />
              {bloqueioMigracoes.motivo}
            </p>
            <ul className="mt-2 space-y-1">
              {migracoes.map((m) => (
                <li key={m.versao} className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono text-slate-300">
                    {m.versao}_{m.nome}
                  </span>
                  <span className="chip border-slate-500/30 bg-slate-500/10 text-slate-400">não aplicada</span>
                  <span className="text-slate-500">{m.arquivo}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="glass p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Gauge className="h-4 w-4 text-fire-soft" />
          Consumo informado ({consumo.length} registros · {totalQuantidade} un. · {totalCusto.toFixed(2)})
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
          <label className="block sm:col-span-2">
            <span className="label">Provedor</span>
            <input className="field" value={provedorId} onChange={(e) => setProvedorId(e.target.value)} placeholder="ex.: chatgpt" />
          </label>
          <label className="block">
            <span className="label">Unidade</span>
            <input className="field" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Quantidade</span>
            <input className="field" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0" />
          </label>
          <label className="block">
            <span className="label">Custo (opcional)</span>
            <input className="field" value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0.00" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={registrarConsumo}>
            Registrar consumo informado
          </button>
          <label className="inline-flex items-center gap-2 text-xs text-slate-400">
            Moeda
            <input className="field max-w-[80px]" value={moeda} onChange={(e) => setMoeda(e.target.value)} />
          </label>
          <span className="text-xs text-slate-500">
            Origem: {ORIGEM_DADO_LABEL.informado_operador} — nunca medido por API paga.
          </span>
        </div>

        {consumo.length > 0 && (
          <ul className="mt-4 space-y-2">
            {consumo.slice(0, 12).map((c) => (
              <li key={c.id} className="glass-soft flex flex-wrap items-center gap-2 p-2.5 text-sm">
                <span className="font-mono text-xs text-slate-300">{c.provedorId}</span>
                <span className="text-slate-200">
                  {c.quantidade} {c.unidade}
                </span>
                <span className="text-xs text-slate-400">
                  {c.custoEstimado.toFixed(2)} {c.moeda}
                </span>
                <span className="ml-auto text-xs text-slate-500">
                  {dateFormatter.format(new Date(c.timestamp))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <HistoryIcon className="h-4 w-4 text-fire-soft" />
          Auditoria ({auditoria.length})
        </h3>
        {auditoria.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nenhuma operação registrada ainda.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {auditoria.map((a) => (
              <li key={a.id} className="glass-soft flex flex-wrap items-center gap-2 p-2.5 text-xs">
                <span className={`chip ${resultadoStyle[a.resultado]}`}>{a.resultado}</span>
                <ScrollText className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-slate-300">{a.acao}</span>
                <span className="text-slate-500">· {a.recurso}</span>
                {a.detalhe && <span className="text-slate-500">— {a.detalhe}</span>}
                <span className="ml-auto text-slate-500">{dateFormatter.format(new Date(a.timestamp))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
