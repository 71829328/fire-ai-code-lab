import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "fire",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  accent?: "fire" | "cyan" | "violet" | "emerald";
}) {
  const accents = {
    fire: "text-fire shadow-glow border-fire/30 bg-fire/10",
    cyan: "text-cyan-300 shadow-glow-cyan border-cyan-400/30 bg-cyan-400/10",
    violet: "text-violet-300 shadow-glow-violet border-violet-400/30 bg-violet-400/10",
    emerald: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  } as const;

  return (
    <article className={`glass glass-hover fire-stat fire-stat-${accent} flex items-start gap-4 p-4`}>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${accents[accent]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-50">{value}</p>
        <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
      </div>
    </article>
  );
}
