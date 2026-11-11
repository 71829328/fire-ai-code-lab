import { Link } from "react-router-dom";
import { SiteHeader, SiteFooter, PhotoSlot } from "@/components/site/SiteHeader";
import { ACHIEVEMENTS, BASELINE, IG_DM, IG_URL } from "@/lib/athlete";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";



const TIMELINE = [
  { k: "Base", t: "Karatê e competições", d: "Medalhas em campeonatos estaduais e nacionais (anos a confirmar com a atleta)." },
  { k: "Clube", t: "SESI-SP Cubatão", d: "Atuação como atleta do SESI-SP Cubatão, kumite −68 kg." },
  { k: "2024/25", t: "Seleção Brasileira", d: "Trajetória na Seleção, com resultados internacionais e pan-americanos." },
  { k: "2025", t: "Ranking CBK", d: "Liderança no ranking da Confederação Brasileira de Karatê em 2025." },
  { k: "Próximo", t: "História em construção", d: "Este capítulo será escrito com a Yasmin." },
];

const BUILD = [
  { n: "01", t: "Narrativa real", d: "Treino, viagem e competição mostram valores que uma marca não consegue encenar." },
  { n: "02", t: "Presença local e nacional", d: "Uma atleta de Cubatão (SP) que veste a camisa do Brasil conecta comunidade e alcance." },
  { n: "03", t: "Conteúdo com propósito", d: "Disciplina, fé e superação como temas — sem promessas de números." },
  { n: "04", t: "Associação de longo prazo", d: "Acompanhar uma temporada constrói lembrança mais do que um post isolado." },
];

const FAQ = [
  { q: "Os números do Instagram são atualizados?", a: "Não. Os dados exibidos são uma captura manual de 11/11/2026 (6.090 seguidores, 200 posts) e não são sincronizados automaticamente." },
  { q: "Como falar sobre parceria?", a: "Pela mensagem direta do Instagram oficial @yasmin_karate_. Não há formulário nem e-mail neste site." },
  { q: "A Yasmin já tem patrocinadores?", a: "Este site não lista marcas parceiras. Qualquer informação sobre apoios atuais deve ser confirmada diretamente com a atleta." },
  { q: "Em qual categoria ela compete?", a: "Kumite (luta), categoria −68 kg, segundo o mídia kit preliminar." },
];

export function Home() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        {/* HERO */}
        <section className="relative overflow-hidden border-b hairline">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-14 pt-12 md:grid-cols-12 md:pb-24 md:pt-20">
            <div className="md:col-span-8 rise">
              <p className="eyebrow mb-6 text-primary">Atleta • Kumite −68 kg • Seleção Brasileira</p>
              <h1 className="display text-[4.4rem] sm:text-8xl lg:text-[9.5rem]">
                Força que<br />vai além<br />do <span className="text-primary">tatame.</span>
              </h1>
              <p className="mt-8 max-w-md text-lg text-muted-foreground">
                Yasmin Rocha — atleta brasileira de karatê. Conquistas, disciplina e histórias em movimento.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={IG_DM} target="_blank" rel="noreferrer" className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition hover:bg-foreground">Conversar sobre parceria</a>
                <a href={IG_URL} target="_blank" rel="noreferrer" className="rounded-full border hairline px-6 py-3 font-medium transition hover:border-foreground">@yasmin_karate_ ↗</a>
              </div>
            </div>
            <aside className="relative md:col-span-4">
              <div className="display pointer-events-none absolute -right-6 -top-10 select-none text-[14rem] leading-none text-slate-soft md:text-[18rem]" aria-hidden>空手</div>
              <div className="relative grid grid-cols-2 gap-px overflow-hidden rounded-md border hairline bg-border">
                {[["200", "posts"], ["6.090", "seguidores"], ["−68", "kg kumite"], ["BR", "seleção"]].map(([n, l]) => (
                  <div key={l} className="bg-card p-5">
                    <div className="display text-5xl">{n}</div>
                    <div className="eyebrow mt-2 text-muted-foreground">{l}</div>
                  </div>
                ))}
              </div>
              <p className="relative mt-3 text-xs text-muted-foreground">Instagram: captura manual em 11/11/2026 · não sincronizado.</p>
            </aside>
          </div>
          <div className="h-1.5 w-full bg-primary" /><div className="h-1.5 w-1/4 bg-coral" />
        </section>

        {/* SOBRE */}
        <section id="sobre" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
          <div className="grid gap-12 md:grid-cols-12">
            <div className="md:col-span-5">
              <p className="eyebrow text-coral">Sobre</p>
              <h2 className="display mt-3 text-6xl md:text-7xl">Atleta.<br />Cristã.<br />Brasileira.</h2>
              <p className="mt-6 text-muted-foreground">
                Yasmin Rocha compete no kumite −68 kg pelo SESI-SP Cubatão e tem trajetória na Seleção Brasileira de Karatê. No Instagram, divide medalhas, competições, viagens e bastidores da rotina de atleta.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Bio curta em revisão — aguardando versão autorizada pela atleta.</p>
            </div>
            <ol className="md:col-span-7" aria-label="História em construção">
              <p className="eyebrow mb-4 text-muted-foreground">História em construção</p>
              {TIMELINE.map((s, i) => (
                <li key={s.t} className="grid grid-cols-[5.5rem_1fr] gap-4 border-t hairline py-5">
                  <span className={`display text-2xl ${i === TIMELINE.length - 1 ? "text-coral" : "text-primary"}`}>{s.k}</span>
                  <div><h3 className="font-semibold">{s.t}</h3><p className="text-sm text-muted-foreground">{s.d}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CONQUISTAS */}
        <section id="conquistas" className="scroll-mt-16 bg-ink py-20 text-paper">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="display text-6xl md:text-8xl">Conquistas</h2>
              <p className="max-w-xs text-sm opacity-70">Resultados informados na bio pública e no mídia kit preliminar. Datas a confirmar.</p>
            </div>
            <ul className="mt-10 border-t border-paper/20">
              {ACHIEVEMENTS.map((a, i) => (
                <li key={a.detail} className="group grid grid-cols-[2.5rem_1fr] items-baseline gap-4 border-b border-paper/20 py-6 transition hover:bg-paper/5 md:grid-cols-[4rem_14rem_1fr_12rem]">
                  <span className="display text-xl opacity-50">{String(i + 1).padStart(2, "0")}</span>
                  <span className="display text-4xl transition group-hover:text-coral md:text-5xl">{a.title}</span>
                  <span className="col-start-2 md:col-start-auto text-lg">{a.detail}<span className="block text-xs opacity-60">{a.note}</span></span>
                  <span className="eyebrow col-start-2 opacity-70 md:col-start-auto md:text-right">{a.tag}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CONTEÚDO */}
        <section id="conteudo" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
          <p className="eyebrow text-primary">Conteúdo</p>
          <h2 className="display mt-3 text-6xl md:text-7xl">No tatame e fora dele</h2>
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:grid-rows-2">
            <PhotoSlot label="Foto oficial · competição" className="col-span-2 row-span-2 min-h-80 md:min-h-[28rem]" />
            <PhotoSlot label="Pódio / medalha" className="min-h-40" />
            <PhotoSlot label="Treino SESI" className="min-h-40" />
            <PhotoSlot label="Viagem / bastidor" className="min-h-40" />
            <a href={IG_URL} target="_blank" rel="noreferrer" className="group flex min-h-40 flex-col justify-between rounded-md bg-primary p-4 text-primary-foreground">
              <span className="eyebrow">Ver feed completo</span>
              <span className="display text-3xl transition group-hover:translate-x-1">Instagram ↗</span>
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Galeria aguardando fotos oficiais autorizadas.</p>
        </section>

        {/* MARCAS */}
        <section className="border-y hairline bg-card py-20">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="display max-w-3xl text-5xl md:text-7xl">O que uma marca constrói ao lado de uma atleta</h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-md border hairline bg-border md:grid-cols-4">
              {BUILD.map((b) => (
                <div key={b.n} className="bg-card p-6">
                  <span className="display text-5xl text-primary">{b.n}</span>
                  <h3 className="mt-6 font-semibold">{b.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{b.d}</p>
                </div>
              ))}
            </div>
            <Link to="/parcerias" className="mt-8 inline-block font-medium text-primary underline-offset-4 hover:underline">Ver formatos de parceria →</Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-5 py-20">
          <h2 className="display text-5xl">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="mt-8">
            {FAQ.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left text-base">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* CTA */}
        <section className="bg-primary py-20 text-primary-foreground">
          <div className="mx-auto max-w-6xl px-5">
            <p className="eyebrow opacity-80">{BASELINE.followers.toLocaleString("pt-BR")} pessoas já acompanham · 11/11/2026</p>
            <h2 className="display mt-4 text-6xl md:text-9xl">Acompanhe<br />a próxima luta.</h2>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={IG_URL} target="_blank" rel="noreferrer" className="rounded-full bg-paper px-6 py-3 font-medium text-ink transition hover:bg-ink hover:text-paper">Seguir @yasmin_karate_</a>
              <a href={IG_DM} target="_blank" rel="noreferrer" className="rounded-full border border-primary-foreground/40 px-6 py-3 font-medium transition hover:bg-primary-foreground/10">Conversar sobre parceria</a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}