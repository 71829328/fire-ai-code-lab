
import { SiteHeader, SiteFooter } from "@/components/site/SiteHeader";
import { BASELINE, IG_DM } from "@/lib/athlete";



const MODELS = [
  { n: "A", name: "Marca que acompanha", kind: "Apoio contínuo", items: ["Presença recorrente em conteúdos de treino e rotina", "Menção em bio/destaque 'Parcerias'", "Conteúdo mensal combinado em conjunto", "Uso da marca em uniforme/acessório, se permitido pelo regulamento"] },
  { n: "B", name: "Missão internacional", kind: "Apoio por viagem ou competição", items: ["Série 'diário de viagem' antes, durante e depois", "Agradecimento em post de resultado", "Bastidores exclusivos da missão", "Relato final com aprendizados"] },
  { n: "C", name: "Parceiro de temporada", kind: "Planejamento anual", items: ["Calendário editorial alinhado às competições", "Ações com comunidade/projetos locais", "Conteúdo de marca em datas-chave", "Revisão conjunta a cada trimestre"] },
];
const SECTORS = [
  ["Saúde", "clínicas, fisioterapia, nutrição, odontologia"],
  ["Educação", "escolas, cursos, faculdades, idiomas"],
  ["Esporte", "academias, equipamentos, vestuário esportivo"],
  ["Bem-estar", "suplementação, recuperação, alimentação"],
  ["Comércio regional", "negócios da Baixada Santista e região"],
];

export function Parcerias() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-16 pt-14 md:grid-cols-[1.3fr_0.7fr] md:gap-12 md:pt-24">
          <div><p className="eyebrow text-coral">Proposta editorial · em revisão</p>
          <h1 className="display mt-4 text-[4rem] sm:text-8xl lg:text-9xl rise">Caminhe<br />ao lado de<br /><span className="text-primary">uma atleta.</span></h1>
          <p className="mt-8 max-w-xl text-lg text-muted-foreground">Três formatos de apoio para marcas que valorizam disciplina, fé e representação brasileira. Tudo é ponto de partida para conversa — nada aqui é tabela de preços.</p>
          <div className="mt-8 flex flex-wrap gap-3 print:hidden">
            <a href={IG_DM} target="_blank" rel="noopener noreferrer" className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-foreground">Propor uma parceria ↗</a>
            <button type="button" onClick={() => window.print()} className="rounded-full border hairline px-6 py-3 font-medium hover:border-foreground">Salvar proposta em PDF</button>
          </div>
          </div>
          <figure className="relative overflow-hidden rounded-2xl bg-ink shadow-[0_20px_60px_-35px_rgba(17,25,36,.5)]">
            <img src="/images/yasmin-portrait.webp" alt="Yasmin Rocha em retrato oficial com quimono de karatê" className="aspect-[4/5] w-full object-cover object-[center_20%]" loading="eager" decoding="async"/>
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-5 pt-20 text-paper"><span className="eyebrow">Karatê • Brasil</span><p className="display mt-1 text-3xl">Yasmin Rocha</p></figcaption>
          </figure>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="grid gap-4 md:grid-cols-3">
            {MODELS.map((m, i) => (
              <article key={m.n} className={`flex flex-col rounded-md border p-6 transition hover:-translate-y-1 ${i === 1 ? "border-ink bg-ink text-paper" : "hairline bg-card"}`}>
                <div className="flex items-baseline justify-between">
                  <span className={`display text-7xl ${i === 1 ? "text-coral" : "text-primary"}`}>{m.n}</span>
                  <span className="eyebrow opacity-70">{m.kind}</span>
                </div>
                <h2 className="display mt-6 text-4xl">{m.name}</h2>
                <ul className="mt-5 space-y-2 text-sm">
                  {m.items.map((it) => <li key={it} className="border-t border-current/15 pt-2 opacity-90">{it}</li>)}
                </ul>
                <p className="mt-auto pt-6 text-xs opacity-60">Entregáveis sugeridos — propostas sujeitas a acordo e agenda.</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y hairline bg-card py-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 md:grid-cols-2">
            <div>
              <p className="eyebrow text-primary">Dados públicos · {new Date(BASELINE.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
              <dl className="mt-6 grid grid-cols-3 gap-4">
                {[["Seguidores", BASELINE.followers], ["Posts", BASELINE.posts], ["Seguindo", BASELINE.following]].map(([l, v]) => (
                  <div key={l as string}><dd className="display text-5xl md:text-6xl">{(v as number).toLocaleString("pt-BR")}</dd><dt className="eyebrow mt-1 text-muted-foreground">{l}</dt></div>
                ))}
              </dl>
            </div>
            <div className="text-sm text-muted-foreground">
              <h2 className="display text-3xl text-foreground">Transparência de métricas</h2>
              <p className="mt-3">Os números acima foram copiados manualmente do perfil público em 11/11/2026. Não há integração com o Instagram nem dados de alcance, engajamento ou público.</p>
              <p className="mt-3">Métricas detalhadas (alcance, impressões, demografia) podem ser compartilhadas pela atleta diretamente com a marca, durante a conversa.</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="display text-5xl md:text-6xl">Setores com afinidade</h2>
          <p className="mt-3 max-w-lg text-muted-foreground">Sugestões de segmentos que combinam com a trajetória — não são parceiros atuais.</p>
          <ul className="mt-8">
            {SECTORS.map(([s, d]) => (
              <li key={s} className="flex flex-col justify-between gap-1 border-t hairline py-5 md:flex-row md:items-baseline">
                <span className="display text-4xl">{s}</span><span className="text-muted-foreground">{d}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-ink py-20 text-paper">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="display text-6xl md:text-8xl">Vamos conversar?</h2>
            <p className="mt-4 max-w-md opacity-70">O contato é feito pela mensagem direta do Instagram oficial.</p>
            <a href={IG_DM} target="_blank" rel="noreferrer" className="mt-8 inline-block rounded-full bg-coral px-7 py-3.5 font-medium text-paper transition hover:bg-primary">Enviar mensagem no Instagram ↗</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}