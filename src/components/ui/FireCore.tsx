import { useState } from "react";
import {
  Bot, Brain, Flame, Orbit, Radar, Shapes, Sparkles, Workflow, type LucideIcon,
} from "lucide-react";
import { AGENT_CONEXAO_LABEL, AGENT_STATUS_LABEL } from "../../types";
import { useStore } from "../../store/StoreContext";
import { FireGlobe } from "./FireGlobe";

const AGENT_SIGILS: Record<string, { icon: LucideIcon; tone: string; code: string }> = {
  Aurora: { icon: Sparkles, tone: "aurora", code: "AU" },
  Vulcano: { icon: Flame, tone: "vulcano", code: "VU" },
  Nebula: { icon: Orbit, tone: "nebula", code: "NE" },
  Prisma: { icon: Shapes, tone: "prisma", code: "PR" },
  Orion: { icon: Radar, tone: "orion", code: "OR" },
};
const fallbackSigils = [
  { icon: Brain, tone: "aurora", code: "01" },
  { icon: Workflow, tone: "vulcano", code: "02" },
  { icon: Bot, tone: "nebula", code: "03" },
  { icon: Sparkles, tone: "prisma", code: "04" },
  { icon: Radar, tone: "orion", code: "05" },
];

export function FireCore() {
  const { state } = useStore();
  const agents = state.agentes.slice(0, 6);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = agents.find((agent) => agent.id === selectedId);
  const selectedSigil = selected
    ? AGENT_SIGILS[selected.nome] ?? fallbackSigils[agents.indexOf(selected) % fallbackSigils.length]
    : null;
  const verifiedCount = agents.filter((agent) => agent.conexao === "verificado").length;

  return (
    <section className="fire-core fire-core--holographic" aria-labelledby="fire-core-title">
      <div className="fire-core-heading">
        <div className="fire-core-title-wrap">
          <span className="fire-core-live-mark" aria-hidden="true" />
          <p className="fire-eyebrow">FIRE INTELLIGENCE <span>/</span> NÚCLEO DE COMANDO</p>
          <h2 id="fire-core-title">Núcleo de inteligência</h2>
          <p className="fire-core-subtitle">Topologia conceitual dos agentes cadastrados</p>
        </div>
        <div className="fire-core-readout">
          <span className="fire-core-readout-label">REGISTROS LOCAIS</span>
          <strong>{String(agents.length).padStart(2, "0")}</strong>
          <span className="fire-core-readout-divider" aria-hidden />
          <span className="fire-core-verified"><i aria-hidden />{verifiedCount} verificados</span>
        </div>
      </div>
      <div className="fire-core-instrument">
        <div className="fire-core-stage">
          <div className="fire-core-backdrop" aria-hidden="true" />
          <FireGlobe />
          <svg viewBox="0 0 600 420" className="fire-orbit" aria-hidden="true">
            <defs>
              <linearGradient id="fireOrbitGradient" x1="0" x2="1" y1="0" y2="1">
                <stop stopColor="#ff6b2c" stopOpacity=".8" />
                <stop offset=".46" stopColor="#6be2f5" stopOpacity=".55" />
                <stop offset="1" stopColor="#ff6b2c" stopOpacity=".25" />
              </linearGradient>
            </defs>
            <ellipse className="fire-orbit-orbital" cx="300" cy="210" rx="174" ry="145" />
            <ellipse className="fire-orbit-orbital fire-orbit-orbital--secondary" cx="300" cy="210" rx="202" ry="111" />
            {agents.map((agent, index) => {
              const angle = index * (Math.PI * 2 / Math.max(agents.length, 1)) - Math.PI / 2;
              const x = 300 + 218 * Math.cos(angle);
              const y = 210 + 166 * Math.sin(angle);
              return <g key={agent.id}>
                <path d={"M300 210 Q" + ((300 + x) / 2) + " " + ((210 + y) / 2 - 18) + " " + x + " " + y} className="fire-orbit-link" />
                <circle cx={x} cy={y} r="2.5" className="fire-orbit-anchor" />
              </g>;
            })}
          </svg>
          <div className="fire-core-center" aria-hidden="true">
            <span className="fire-core-center-ring" />
            <img src="/brand/fire-phoenix-symbol.webp" alt="" className="fire-core-phoenix" />
            <span className="fire-core-center-word">FIRE</span>
          </div>
          {agents.map((agent, index) => {
            const angle = index * (Math.PI * 2 / Math.max(agents.length, 1)) - Math.PI / 2;
            const x = 50 + 36.3 * Math.cos(angle);
            const y = 50 + 39.2 * Math.sin(angle);
            const sigil = AGENT_SIGILS[agent.nome] ?? fallbackSigils[index % fallbackSigils.length];
            const Icon = sigil.icon;
            const selectedNode = selectedId === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                aria-pressed={selectedNode}
                aria-label={agent.nome + ", " + agent.papel + ", " + AGENT_STATUS_LABEL[agent.status] + ", " + (agent.origem === "demonstrativo" ? "demonstrativo" : "cadastrado localmente")}
                onClick={() => setSelectedId(selectedNode ? null : agent.id)}
                className={"fire-agent-node fire-agent-node--" + sigil.tone + (selectedNode ? " is-selected" : "")}
                style={{ left: x + "%", top: y + "%" }}
              >
                <span className="fire-agent-avatar"><Icon size={18} aria-hidden="true" /></span>
                <span className="fire-agent-node-copy">
                  <span className="fire-agent-node-code">{sigil.code}</span>
                  <span className="fire-agent-node-name">{agent.nome}</span>
                </span>
              </button>
            );
          })}
          <div className="fire-core-axis-label fire-core-axis-label--top">ORBITAL / LOCAL</div>
          <div className="fire-core-axis-label fire-core-axis-label--bottom">ESTADO DE CONEXÃO NÃO COMPROVADO</div>
        </div>
        <aside className={"fire-core-inspector" + (selected ? " has-selection" : "")} aria-live="polite">
          {selected && selectedSigil ? (
            <>
              <div className={"fire-inspector-avatar fire-inspector-avatar--" + selectedSigil.tone}>
                {(() => { const Icon = selectedSigil.icon; return <Icon size={22} aria-hidden="true" />; })()}
              </div>
              <p className="fire-inspector-overline">FICHA DO AGENTE</p>
              <h3>{selected.nome}</h3>
              <p className="fire-inspector-role">{selected.papel}</p>
              <dl className="fire-inspector-facts">
                <div><dt>Estado</dt><dd>{AGENT_STATUS_LABEL[selected.status]}</dd></div>
                <div><dt>Origem</dt><dd>{selected.origem === "demonstrativo" ? "Demonstração" : "Cadastro local"}</dd></div>
                <div><dt>Conexão</dt><dd>{AGENT_CONEXAO_LABEL[selected.conexao]}</dd></div>
              </dl>
            </>
          ) : (
            <>
              <span className="fire-inspector-orbit-icon"><Orbit size={19} aria-hidden="true" /></span>
              <p className="fire-inspector-overline">CAMADA DE AGENTES</p>
              <h3>Registros em órbita</h3>
              <p className="fire-inspector-copy">Selecione um nó para consultar o perfil e o estado registrado.</p>
              <div className="fire-inspector-foot">
                <span className="fire-inspector-key"><i aria-hidden />Demonstração ou cadastro local</span>
                <span className="fire-inspector-key"><i className="is-muted" aria-hidden />Conexão externa não verificada</span>
              </div>
            </>
          )}
        </aside>
      </div>
      <p className="fire-core-note">
        <span className="fire-core-note-mark" aria-hidden="true">i</span>
        Visualização ilustrativa. Posições, órbitas e ligações não representam atividade ou conexões em tempo real.
      </p>
    </section>
  );
}
