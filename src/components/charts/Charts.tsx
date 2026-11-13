interface Slice {
  label: string;
  value: number;
  color: string;
}

// Gráfico de rosca em SVG puro — sem dependências externas.
export function DonutChart({
  data,
  size = 168,
  thickness = 18,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label="Distribuição de tarefas por status"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.12)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          data.map((slice) => {
            const length = (slice.value / total) * circumference;
            const segment = (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                style={{ transition: "stroke-dasharray 0.6s ease" }}
              />
            );
            offset += length;
            return segment;
          })}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="rotate-90 fill-slate-100"
          style={{ transformOrigin: "center", fontSize: 26, fontWeight: 700 }}
        >
          {total}
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {data.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2 text-slate-300">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: slice.color }}
              aria-hidden
            />
            <span className="w-24">{slice.label}</span>
            <span className="font-semibold text-slate-100">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Gráfico de barras horizontal em SVG puro.
export function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <ul className="space-y-3">
      {data.map((item, index) => (
        <li key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">{item.label}</span>
            <span className="font-semibold text-slate-100">{item.value} tarefas</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full animate-shimmer"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundImage:
                  "linear-gradient(90deg, rgba(255,122,26,0.9), rgba(34,211,238,0.9), rgba(168,85,247,0.9))",
                backgroundSize: "200% 100%",
                animationDelay: `${index * 0.12}s`,
                transition: "width 0.6s ease",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Barra de progresso genérica com gradiente FIRE.
export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/5" aria-hidden>
      <div
        className="h-full rounded-full bg-fire-gradient"
        style={{ width: `${clamped}%`, transition: "width 0.6s ease" }}
      />
    </div>
  );
}
