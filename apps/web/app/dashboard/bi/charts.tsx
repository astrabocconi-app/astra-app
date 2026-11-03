// Dependency-free SVG charts. Server-renderable: no state, no JS shipped.

export const PALETTE = ["#1d4ed8", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

export interface Slice {
  label: string;
  value: number;
}

/** Daily series as a line + soft area. `points` must already be gap-filled and in order. */
export function LineChart({ points }: { points: { label: string; value: number }[] }) {
  const W = 640;
  const H = 220;
  const pad = { l: 34, r: 8, t: 10, b: 22 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i: number) => pad.l + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const labelAt = [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Installs per day">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#6b7280">
            {t}
          </text>
        </g>
      ))}
      <path d={area} fill="#1d4ed8" opacity="0.1" />
      <path d={line} fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.label} cx={x(i)} cy={y(p.value)} r={points.length > 60 ? 0 : 2.5} fill="#1d4ed8">
          <title>{`${p.label}: ${p.value}`}</title>
        </circle>
      ))}
      {labelAt.map(
        (i) =>
          points[i] && (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              fontSize="10"
              fill="#6b7280"
            >
              {points[i].label}
            </text>
          ),
      )}
    </svg>
  );
}

/** Donut with a coloured legend. Slices of 0 are dropped. */
export function PieChart({ slices }: { slices: Slice[] }) {
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <p className="py-8 text-center text-sm text-gray-500">No data yet.</p>;
  const R = 15.9155; // circumference 100, so dash lengths are percentages
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 42 42" className="h-40 w-40 shrink-0 -rotate-90" role="img" aria-label="Share breakdown">
        {data.map((s, i) => {
          const pct = (s.value / total) * 100;
          const el = (
            <circle
              key={s.label}
              cx="21"
              cy="21"
              r={R}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="7"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={-offset}
            >
              <title>{`${s.label}: ${s.value} (${pct.toFixed(1)}%)`}</title>
            </circle>
          );
          offset += pct;
          return el;
        })}
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
        {data.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate text-gray-700">{s.label}</span>
            <span className="font-medium text-gray-900">{s.value.toLocaleString()}</span>
            <span className="w-12 text-right text-xs text-gray-500">{((s.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
