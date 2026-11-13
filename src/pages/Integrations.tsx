import { AlertTriangle, CheckCircle2, Plug, ShieldCheck, XCircle, Zap } from "lucide-react";
import { useStore } from "../store/StoreContext";
import { IntegrationStateBadge } from "../components/ui/badges";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Motivo único e explícito do botão de ativação sempre desabilitado.
const MOTIVO_ATIVACAO =
  "Indisponível: exige acesso real autorizado e validado, o que não ocorre nesta demonstração.";

export function Integrations() {
  const { state, dispatch } = useStore();
  const ativas = state.integracoes.filter((integracao) => integracao.estado === "ativa").length;
  const total = state.integracoes.length;

  return (
    <div className="space-y-5">
      <div className="glass flex items-start gap-3 border-amber-400/30 bg-amber-400/[0.06] p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
        <div>
          <h2 className="text-sm font-semibold text-amber-100">
            As integrações permanecem desativadas até haver acesso real autorizado e validado
          </h2>
          <p className="mt-1 text-sm text-amber-200/80">
            Nenhuma credencial real é utilizada e nenhum gasto é realizado. Solicitar autorização
            apenas registra a intenção — não conecta nenhum serviço externo.
          </p>
        </div>
      </div>

      <div className="glass flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">
            {ativas} de {total} ativas
          </span>{" "}
          · integrações externas permanecem desativadas nesta demonstração.
        </p>
        <span className="chip border-white/10 bg-white/5 text-slate-300">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          Sem credenciais reais
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 stagger">
        {state.integracoes.map((integracao) => (
          <article key={integracao.id} className="glass glass-hover flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-base font-semibold text-slate-50">
                  <Plug className="h-4 w-4 text-fire-soft" />
                  {integracao.nome}
                </h3>
                <p className="mt-1 text-sm text-slate-400">{integracao.descricao}</p>
              </div>
              <IntegrationStateBadge estado={integracao.estado} />
            </div>

            <div className="mt-3 space-y-2 text-sm">
              <p className="text-slate-300">
                <span className="text-slate-500">Requer: </span>
                {integracao.requer}
              </p>
              <p className="text-slate-300">
                <span className="text-slate-500">Última verificação: </span>
                {integracao.ultimaVerificacao
                  ? dateFormatter.format(new Date(integracao.ultimaVerificacao))
                  : "nunca verificada"}
              </p>
              <div className="flex flex-wrap gap-2">
                {integracao.capacidades.map((capacidade) => (
                  <span
                    key={capacidade}
                    className="chip border-white/10 bg-white/5 text-slate-300"
                  >
                    {capacidade}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {integracao.estado === "desativada" && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() =>
                    dispatch({ type: "integracao/solicitar", payload: { id: integracao.id } })
                  }
                >
                  <Zap className="h-4 w-4" />
                  Solicitar autorização
                </button>
              )}
              {integracao.estado === "aguardando_autorizacao" && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() =>
                    dispatch({ type: "integracao/desativar", payload: { id: integracao.id } })
                  }
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar solicitação
                </button>
              )}
              {/* Nunca permite ativar: a ativação exige acesso real autorizado e validado. */}
              <button type="button" className="btn-ghost" disabled title={MOTIVO_ATIVACAO}>
                <CheckCircle2 className="h-4 w-4" />
                Ativar integração
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
