export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="display text-[1.35rem] leading-[0.8] tracking-tight">
        Yasmin<span className="text-primary">/</span>
        {!compact && <br />}Rocha
      </span>
      <span className="eyebrow hidden rounded-full border hairline px-2 py-0.5 text-[0.55rem] text-muted-foreground sm:inline">
        Karate <span className="text-coral">•</span> Brasil
      </span>
    </span>
  );
}