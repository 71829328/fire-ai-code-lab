import { FireGlobe } from "./FireGlobe";
import { useState } from "react";
import { AGENT_CONEXAO_LABEL, AGENT_STATUS_LABEL } from "../../types";
import { Flame, Bot, Network } from "lucide-react";
import { useStore } from "../../store/StoreContext";

export function FireCore() {
  const { state } = useStore();
  const agents = state.agentes.slice(0, 6);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = agents.find(a => a.id === selectedId);
  return <section className="fire-core glass" aria-label="Mapa conceitual de agentes cadastrados">
    <div className="fire-core-heading"><div><p className="fire-eyebrow">FIRE INTELLIGENCE / COMMAND CORE</p><h2>Núcleo de inteligência</h2></div><span className="chip border-amber-400/30 text-amber-200">Mapa local</span></div>
    <div className="fire-core-stage">
      <FireGlobe />
      <svg viewBox="0 0 600 340" className="fire-orbit" aria-hidden="true">
        <defs><radialGradient id="coreGlow"><stop stopColor="#0e7490" stopOpacity=".6"/><stop offset="1" stopColor="#020617" stopOpacity=".1"/></radialGradient></defs>
        <circle className="fire-orbit-ring" cx="300" cy="170" r="138" fill="none" stroke="#fb923c" strokeWidth="2" strokeDasharray="38 12 3 12"/>
        {agents.map((a,i)=>{const t=i*Math.PI/3-Math.PI/2;return <path key={a.id} d={`M300 170 L${300+225*Math.cos(t)} ${170+132*Math.sin(t)}`} stroke="#64748b" strokeDasharray="4 7" fill="none"/>;})}
      </svg>
      <div className="fire-core-center"><Flame size={48} aria-hidden/><span>FIRE</span></div>
      {agents.map((a,i)=>{const t=i*Math.PI/3-Math.PI/2;return <button type="button" aria-pressed={selectedId === a.id} onClick={() => setSelectedId(selectedId === a.id ? null : a.id)} key={a.id} className="fire-agent-node" style={{left:`${50+37.5*Math.cos(t)}%`,top:`${50+38.8*Math.sin(t)}%`}}><Bot size={18} aria-hidden/><span>{a.nome}</span></button>;})}
    </div>
    {selected && <div className="fire-agent-detail"><strong>{selected.nome}</strong><span>{selected.papel} · {AGENT_STATUS_LABEL[selected.status]}</span><span>{AGENT_CONEXAO_LABEL[selected.conexao]} · {selected.origem === "demonstrativo" ? "Demonstração" : "Cadastro local"}</span></div>}
    <p className="fire-core-note"><Network size={14} aria-hidden/> Topologia ilustrativa dos agentes cadastrados; não representa conexões ativas.</p>
  </section>;
}
