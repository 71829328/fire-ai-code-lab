import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
  Clock,
  Info,
  KeyRound,
  Loader2,
  PlugZap,
  PowerOff,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  api,
  type EstadoPublicoConexoes,
  type Resultado,
  type ResultadoTesteProvedor,
  type UsuarioAutenticado,
} from "../app/apiClient";
import {
  ESTADO_CONEXAO_LABEL,
  type CategoriaConexao,
  type ConexaoProvedor,
  type EstadoConexao,
} from "../server/conexoes";
import { PAPEL_LABEL, PERMISSOES_POR_PAPEL, type Papel } from "../platform/types";

const fmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const ESTADO_ESTILO: Record<EstadoConexao, string> = {
  nao_configurado: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  configurado: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  autorizado: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  conectado_verificado: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  indisponivel: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  erro: "border-rose-400/40 bg-rose-500/10 text-rose-200",
  bloqueado_por_custo: "border-rose-400/40 bg-rose-500/10 text-rose-200",
};

const CATEGORIA_LABEL: Record<CategoriaConexao, string> = {
  backend: "Backend",
  repositorio: "Repositório",
  deploy: "Deploy",
  agente: "Agente",
};

const ORDEM_ESTADOS: EstadoConexao[] = [
  "nao_configurado",
  "configurado",
  "autorizado",
  "conectado_verificado",
  "indisponivel",
  "erro",
  "bloqueado_por_custo",
];

// Provedores que possuem um adaptador de verificação REAL (chamada de rede).
const PROVEDORES_TESTAVEIS = new Set(["supabase", "github", "vercel"]);

const VARIAVEIS_AMBIENTE: { nome: string; finalidade: string }[] = [
  { nome: "FIRE_SESSION_SECRET", finalidade: "Habilita sessões assinadas (login de e-mail/senha)." },
  { nome: "SUPABASE_URL", finalidade: "Endereço do projeto Supabase autorizado." },
  { nome: "SUPABASE_ANON_KEY", finalidade: "Autenticação Supabase (GoTrue)." },
  { nome: "SUPABASE_SERVICE_ROLE_KEY", finalidade: "Operações administrativas no servidor (nunca no frontend)." },
  { nome: "GITHUB_TOKEN", finalidade: "Leitura do repositório autorizado (escopo mínimo)." },
  { nome: "FIRE_GITHUB_REPO", finalidade: "Repositório autorizado (padrão: 71829328/fire-ai-code-lab)." },
  { nome: "VERCEL_TOKEN", finalidade: "Leitura do projeto autorizado." },
  { nome: "FIRE_VERCEL_PROJECT", finalidade: "Projeto autorizado (padrão: fire-agent-command-center)." },
  { nome: "VERCEL_TEAM_ID", finalidade: "Escopo de time da Vercel, quando aplicável." },
  { nome: "FIRE_GOOGLE_CLIENT_ID", finalidade: "Login via Google OAuth (quando fornecido)." },
  { nome: "FIRE_MICROSOFT_CLIENT_ID", finalidade: "Login via Microsoft OAuth (quando fornecido)." },
];

function EstadoBadge({ estado }: { estado: EstadoConexao }) {
  return <span className={`chip ${ESTADO_ESTILO[estado]}`}>{ESTADO_CONEXAO_LABEL[estado]}</span>;
}

function ListaInformacao({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
      <ul className="mt-1 space-y-0.5 text-sm text-slate-300">
        {itens.map((item, i) => (
          <li key={`${item}-${i}`} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-500" aria-hidden />
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Conexoes() {
  const [saude, setSaude] = useState<Resultado<{ ok: boolean; ambiente: string; hora: string }> | null>(null);
  const [publico, setPublico] = useState<Resultado<EstadoPublicoConexoes> | null>(null);
  const [carregando, setCarregando] = useState(false);

  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [erroLogin, setErroLogin] = useState<string | null>(null);

  const [testando, setTestando] = useState<string | null>(null);
  const [testes, setTestes] = useState<Record<string, ResultadoTesteProvedor>>({});
  const [alternando, setAlternando] = useState<string | null>(null);
  const [avisoAcao, setAvisoAcao] = useState<string | null>(null);

  const carregarPublico = useCallback(async () => {
    setCarregando(true);
    const [resultadoSaude, resultadoPublico] = await Promise.all([api.saude(), api.conexoesPublicas()]);
    setSaude(resultadoSaude);
    setPublico(resultadoPublico);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregarPublico();
  }, [carregarPublico]);

  const conexoes = publico?.ok ? publico.dados.conexoes : null;
  const servidorAlcancavel = saude?.ok === true;

  const podeAutorizar = useMemo(() => {
    if (!usuario) return false;
    const papel = usuario.papel as Papel;
    const permissoes = PERMISSOES_POR_PAPEL[papel];
    return Array.isArray(permissoes) && permissoes.includes("integracao:autorizar");
  }, [usuario]);

  const contagemEstados = useMemo(() => {
    const base = new Map<EstadoConexao, number>();
    for (const provedor of conexoes?.provedores ?? []) {
      base.set(provedor.estado, (base.get(provedor.estado) ?? 0) + 1);
    }
    return base;
  }, [conexoes]);

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    setEntrando(true);
    setErroLogin(null);
    const resultado = await api.login(email.trim(), senha);
    setEntrando(false);
    if (!resultado.ok) {
      setErroLogin(resultado.mensagem);
      return;
    }
    setUsuario(resultado.dados.usuario);
    setSenha("");
  }

  async function sair() {
    await api.logout();
    api.limparToken();
    setUsuario(null);
    setTestes({});
    setAvisoAcao(null);
  }

  async function testar(provedor: ConexaoProvedor) {
    setTestando(provedor.id);
    setAvisoAcao(null);
    const resultado = await api.testarProvedor(provedor.id);
    setTestando(null);
    if (!resultado.ok) {
      if (resultado.motivo === "nao_autenticado") setUsuario(null);
      setAvisoAcao(`Não foi possível testar “${provedor.nome}”: ${resultado.mensagem}`);
      return;
    }
    setTestes((atual) => ({ ...atual, [provedor.id]: resultado.dados }));
    await carregarPublico();
  }

  async function alternar(provedor: ConexaoProvedor) {
    const reativar = Boolean(provedor.desativadoPeloOperador);
    setAlternando(provedor.id);
    setAvisoAcao(null);
    const resultado = await api.definirAtivacaoProvedor(provedor.id, reativar);
    setAlternando(null);
    if (!resultado.ok) {
      if (resultado.motivo === "nao_autenticado") setUsuario(null);
      setAvisoAcao(`Falha ao ${reativar ? "reativar" : "desativar"} “${provedor.nome}”: ${resultado.mensagem}`);
      return;
    }
    setPublico((atual) =>
      atual && atual.ok
        ? {
            ...atual,
            dados: { ...atual.dados, geradoEm: new Date().toISOString(), conexoes: resultado.dados.conexoes },
          }
        : atual
    );
  }

  return (
    <div className="space-y-5">
      <div className="glass flex items-start gap-3 border-sky-400/30 bg-sky-400/[0.06] p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-200" />
        <div>
          <h2 className="text-sm font-semibold text-sky-100">
            A Central de Conexões mostra o estado REAL do servidor — um adaptador existir não significa conexão
          </h2>
          <p className="mt-1 text-sm text-sky-200/80">
            Nenhum provedor aparece como “conectado” sem uma chamada real bem-sucedida. Estados refletem a
            configuração no servidor (variáveis de ambiente), nunca valores digitados no navegador. Segredos
            permanecem exclusivamente no servidor.
          </p>
        </div>
      </div>

      {/* Status do backend */}
      <section className="glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <PlugZap className="h-4 w-4 text-fire-soft" />
            Backend e persistência
          </h3>
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => void carregarPublico()} disabled={carregando}>
            {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="glass-soft p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Servidor</p>
            <p className="mt-1 text-sm font-medium">
              {saude === null ? (
                <span className="text-slate-400">verificando…</span>
              ) : servidorAlcancavel ? (
                <span className="text-emerald-200">alcançável</span>
              ) : (
                <span className="text-rose-200">inacessível</span>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {saude?.ok ? `Ambiente: ${saude.dados.ambiente}` : "Sem resposta da API. Nada é presumido."}
            </p>
          </div>

          <div className="glass-soft p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Repositório de dados</p>
            <p className="mt-1 text-sm font-medium text-slate-100">{conexoes?.backend.modo ?? "—"}</p>
            <p className="mt-1 text-xs text-slate-400">
              {conexoes ? (conexoes.backend.persistente ? "persistente" : "em memória (não persistente)") : "—"}
            </p>
          </div>

          <div className="glass-soft p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Sessão</p>
            <p className="mt-1 text-sm font-medium text-slate-100">
              {usuario ? `autenticado · ${PAPEL_LABEL[usuario.papel as Papel] ?? usuario.papel}` : "não autenticado"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {usuario ? usuario.email : "Token mantido apenas em memória."}
            </p>
          </div>

          <div className="glass-soft p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Estado público consultado em</p>
            <p className="mt-1 text-sm font-medium text-slate-100">
              {publico?.ok ? fmt.format(new Date(publico.dados.geradoEm)) : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {publico?.ok ? `Gerado pelo servidor (${publico.dados.ambiente}).` : publico && !publico.ok ? publico.mensagem : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Autenticação */}
      <section className="glass p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <KeyRound className="h-4 w-4 text-fire-soft" />
          Autenticação para operações sensíveis
        </h3>
        {usuario ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-300">
              Conectado como <span className="font-semibold text-slate-100">{usuario.nome}</span> · organização{" "}
              <span className="font-mono text-xs text-slate-400">{usuario.organizacaoId}</span>
            </p>
            <button type="button" className="btn-ghost" onClick={() => void sair()}>
              <XCircle className="h-4 w-4" />
              Encerrar sessão
            </button>
          </div>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={entrar}>
            <p className="text-sm text-slate-400">
              Ler o estado é público. Testar conexões e ativar/desativar provedores exigem sessão autenticada —
              a decisão é sempre do servidor. Sem <code className="text-slate-300">FIRE_SESSION_SECRET</code>{" "}
              configurado, o login permanece indisponível.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-slate-400">E-mail</span>
                <input
                  type="email"
                  className="field mt-1"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-400">Senha</span>
                <input
                  type="password"
                  className="field mt-1"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
            </div>
            {erroLogin && <p className="text-sm text-rose-200">{erroLogin}</p>}
            <button type="submit" className="btn-primary" disabled={entrando}>
              {entrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Entrar
            </button>
          </form>
        )}
      </section>

      {/* Falha de carregamento */}
      {publico && !publico.ok && (
        <div className="glass flex items-start gap-3 border-rose-400/30 bg-rose-400/[0.06] p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
          <div>
            <p className="text-sm font-semibold text-rose-100">Não foi possível consultar a Central de Conexões</p>
            <p className="mt-1 text-sm text-rose-200/80">{publico.mensagem}</p>
          </div>
        </div>
      )}

      {/* Legenda de estados */}
      <section className="glass p-4">
        <h3 className="text-sm font-semibold text-slate-100">Estados possíveis</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {ORDEM_ESTADOS.map((estado) => (
            <span key={estado} className="inline-flex items-center gap-2">
              <EstadoBadge estado={estado} />
              <span className="text-xs text-slate-500">{contagemEstados.get(estado) ?? 0}</span>
            </span>
          ))}
        </div>
      </section>

      {/* Provedores */}
      {conexoes && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 stagger">
          {conexoes.provedores.map((provedor) => {
            const teste = testes[provedor.id];
            const desativado = Boolean(provedor.desativadoPeloOperador);
            const testavel = PROVEDORES_TESTAVEIS.has(provedor.id);
            const podeTestar = testavel && !desativado && podeAutorizar;
            return (
              <article key={provedor.id} className="glass glass-hover flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-slate-50">{provedor.nome}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="chip border-white/10 bg-white/5 text-slate-400">
                        {CATEGORIA_LABEL[provedor.categoria]}
                      </span>
                      <span className="chip border-white/10 bg-white/5 text-slate-400" title="Adaptador implementado; não indica conexão">
                        Adaptador: {provedor.adaptadorImplementado ? "implementado" : "ausente"}
                      </span>
                      {desativado && (
                        <span className="chip border-amber-400/30 bg-amber-400/10 text-amber-200">
                          <PowerOff className="h-3 w-3" />
                          Desativado pelo operador
                        </span>
                      )}
                    </div>
                  </div>
                  <EstadoBadge estado={provedor.estado} />
                </div>

                <p className="mt-3 text-sm text-slate-300">{provedor.observacao}</p>

                <div className="mt-3 space-y-3">
                  <ListaInformacao titulo="Permissões concedidas" itens={provedor.permissoes} />
                  <ListaInformacao titulo="Requisitos" itens={provedor.requerimentos} />

                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <p className="text-slate-300">
                      <span className="text-slate-500">Última comunicação: </span>
                      {provedor.ultimaComunicacao ? fmt.format(new Date(provedor.ultimaComunicacao)) : "nenhuma verificada"}
                    </p>
                    <p className="text-slate-300">
                      <span className="text-slate-500">Limites: </span>
                      {provedor.limites}
                    </p>
                    <p className="text-slate-300">
                      <span className="text-slate-500">Consumo: </span>
                      {provedor.consumo}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Falhas observadas</p>
                    {provedor.falhas.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-500">Nenhuma falha registrada.</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5 text-sm text-rose-200">
                        {provedor.falhas.map((falha, i) => (
                          <li key={`${falha}-${i}`}>{falha}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {teste && (
                    <div
                      className={`glass-soft p-3 text-sm ${
                        teste.ok ? "border-emerald-400/30 text-emerald-100" : "border-amber-400/30 text-amber-100"
                      }`}
                    >
                      <p className="flex items-center gap-2 font-medium">
                        {teste.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        Resultado do teste: {teste.ok ? "sucesso real" : "sem conexão"}
                      </p>
                      <p className="mt-1 text-slate-200/90">{teste.mensagem}</p>
                      <p className="mt-1 text-xs text-slate-400">Estado relatado pelo servidor: {teste.estado}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  {testavel && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => void testar(provedor)}
                      disabled={testando === provedor.id || !podeTestar || !usuario}
                      title={
                        !usuario
                          ? "Entre para executar um teste real de conexão."
                          : desativado
                            ? "Provedor desativado pelo operador."
                            : "Executa uma chamada real de verificação no servidor."
                      }
                    >
                      {testando === provedor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Testar conexão
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => void alternar(provedor)}
                    disabled={alternando === provedor.id || !usuario}
                    title={!usuario ? "Entre para alterar a ativação deste provedor." : undefined}
                  >
                    {alternando === provedor.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : desativado ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <CircleSlash className="h-4 w-4" />
                    )}
                    {desativado ? "Reativar" : "Desativar"}
                  </button>

                  {usuario && !podeAutorizar && (
                    <span className="self-center text-xs text-slate-500">
                      Seu papel ({PAPEL_LABEL[usuario.papel as Papel] ?? usuario.papel}) não permite operações de integração.
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {avisoAcao && (
        <div className="glass flex items-start gap-3 border-amber-400/30 bg-amber-400/[0.06] p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
          <p className="text-sm text-amber-100">{avisoAcao}</p>
        </div>
      )}

      {/* OAuth + configuração */}
      <section className="glass p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Clock className="h-4 w-4 text-fire-soft" />
          Configuração necessária (servidor)
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          Nenhum segredo é exibido ou armazenado no navegador. Configure as variáveis no ambiente do servidor
          (Vercel) e reimplante. Uma conexão só é declarada “conectada e verificada” após uma chamada real.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-1.5 pr-4 font-semibold">Variável</th>
                <th className="py-1.5 font-semibold">Finalidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {VARIAVEIS_AMBIENTE.map((item) => (
                <tr key={item.nome}>
                  <td className="py-1.5 pr-4 font-mono text-xs text-slate-300">{item.nome}</td>
                  <td className="py-1.5 text-slate-400">{item.finalidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
