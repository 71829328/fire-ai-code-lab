import { toast } from "sonner";
import { Panel, Btn } from "./ui";

const BIO = "Atleta de karatê · Seleção Brasileira\nKumite −68 kg · SESI-SP Cubatão\nPrata Open Portugal · Bronze Pan\nCristã\nParcerias: via DM";
const BLOCKS = [
  { t: "Forças", c: "text-primary", items: ["Prova social clara: medalhas e Seleção Brasileira", "Perfil verificado", "Fotos com rosto e ação real de competição", "Bastidores de viagem geram identificação"] },
  { t: "Oportunidades", c: "text-coral", items: ["Bio extensa e confusa para quem não conhece o karatê", "Não há CTA comercial aparente", "Grid pouco consistente visualmente", "Narrativa pouco estruturada entre posts"] },
  { t: "Limitações", c: "text-muted-foreground", items: ["Engajamento e alcance não medidos", "Stories e Reels não auditados", "Sem acesso a dados de público (Insights)", "Captura única: sem histórico"] },
];
const HIGHLIGHTS = ["Conquistas", "Treinos", "Competição", "Minha história", "Parcerias"];

export function Audit() {
  const copy = async () => { try { await navigator.clipboard.writeText(BIO); toast.success("Bio copiada"); } catch { toast.error("Não foi possível copiar"); } };
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        {BLOCKS.map((b) => (
          <section key={b.t} className="rounded-lg border hairline bg-card p-5">
            <h2 className={`display text-3xl ${b.c}`}>{b.t}</h2>
            <ul className="mt-4 space-y-2 text-sm">{b.items.map((i) => <li key={i} className="border-t hairline pt-2">{i}</li>)}</ul>
          </section>
        ))}
      </div>
      <Panel kicker="Sugestão · a validar com a atleta" title="Nova bio" actions={<Btn onClick={copy}>Copiar bio</Btn>}>
        <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 font-sans text-sm">{BIO}</pre>
        <p className={`mt-2 text-xs ${BIO.length > 150 ? "text-destructive" : "text-muted-foreground"}`}>{BIO.length}/150 caracteres</p>
      </Panel>
      <Panel kicker="Destaques sugeridos" title="Organização dos stories fixos">
        <div className="flex flex-wrap gap-4">{HIGHLIGHTS.map((h, i) => (
          <div key={h} className="flex w-20 flex-col items-center gap-2 text-center text-xs">
            <span className={`display flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl ${i === 4 ? "border-coral" : "border-primary"}`}>{h.slice(0, 2)}</span>{h}
          </div>
        ))}</div>
      </Panel>
    </div>
  );
}