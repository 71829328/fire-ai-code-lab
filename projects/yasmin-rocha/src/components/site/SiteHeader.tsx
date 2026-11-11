import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Wordmark } from "./Wordmark";
import { IG_URL } from "@/lib/athlete";

const NAV = [
  { href: "/#sobre", label: "Sobre" },
  { href: "/#conquistas", label: "Conquistas" },
  { href: "/#conteudo", label: "Conteúdo" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b hairline bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" aria-label="Yasmin Rocha — início"><Wordmark /></Link>
        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Principal">
          {NAV.map((n) => <a key={n.href} href={n.href} className="text-muted-foreground transition hover:text-foreground">{n.label}</a>)}
          <Link to="/parcerias" className="text-muted-foreground transition hover:text-foreground">Para marcas</Link>
          <a href={IG_URL} target="_blank" rel="noreferrer" className="rounded-full bg-foreground px-4 py-2 text-background transition hover:bg-primary">Instagram ↗</a>
        </nav>
        <button className="md:hidden p-2" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <nav className="border-t hairline px-5 pb-6 pt-2 md:hidden" aria-label="Menu móvel">
          {NAV.map((n) => <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="display block border-b hairline py-3 text-3xl">{n.label}</a>)}
          <Link to="/parcerias" onClick={() => setOpen(false)} className="display block border-b hairline py-3 text-3xl">Para marcas</Link>
          <a href={IG_URL} target="_blank" rel="noreferrer" className="display block py-3 text-3xl text-primary">Instagram ↗</a>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <Wordmark compact />
        <p>Dados públicos referentes à captura de 11/11/2026. Conteúdo em revisão com a atleta.</p>
        <a href={IG_URL} target="_blank" rel="noreferrer" className="text-foreground underline-offset-4 hover:underline">@yasmin_karate_</a>
      </div>
    </footer>
  );
}

export function PhotoSlot({ label = "Adicionar foto oficial", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`photo-slot relative flex items-end overflow-hidden rounded-md border hairline p-4 ${className}`} role="img" aria-label={`Espaço reservado: ${label}`}>
      <span className="eyebrow text-muted-foreground">+ {label}</span>
    </div>
  );
}