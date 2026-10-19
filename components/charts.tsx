import type { DailyRow, HourRow } from "@/lib/stats";

function shortDay(day: string) {
  const [, month, date] = day.split("-");
  return `${Number(month)}/${Number(date)}`;
}

const SERIES = [
  { key: "votes", label: "Votes", color: "var(--primary)" },
  { key: "photos", label: "Photos", color: "var(--blue)" },
  { key: "signups", label: "Sign-ups", color: "var(--yellow)" },
] as const;

export function DailyChart({ rows }: { rows: DailyRow[] }) {
  const width = 720;
  const height = 240;
  const pad = { top: 16, right: 8, bottom: 32, left: 32 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const max = Math.max(1, ...rows.flatMap((r) => [r.votes, r.photos, r.signups]));
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const groupW = innerW / rows.length;
  const barW = Math.min(14, (groupW - 8) / SERIES.length);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceMax * t));

  return (
    <figure>
      <div className="mb-3 flex flex-wrap gap-4">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-2 text-xs font-extrabold">
            <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Daily votes, photos, and sign-ups for the last 14 days"
        className="w-full"
      >
        {ticks.map((t) => {
          const y = pad.top + innerH - (t / niceMax) * innerH;
          return (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--border)" strokeWidth="2" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--muted)">
                {t}
              </text>
            </g>
          );
        })}
        {rows.map((row, i) => {
          const gx = pad.left + i * groupW + (groupW - barW * SERIES.length) / 2;
          return (
            <g key={row.day}>
              {SERIES.map((s, j) => {
                const value = row[s.key];
                const h = (value / niceMax) * innerH;
                return (
                  <rect
                    key={s.key}
                    x={gx + j * barW}
                    y={pad.top + innerH - h}
                    width={barW - 2}
                    height={Math.max(h, value > 0 ? 2 : 0)}
                    rx="3"
                    fill={s.color}
                  >
                    <title>{`${shortDay(row.day)}: ${value} ${s.label.toLowerCase()}`}</title>
                  </rect>
                );
              })}
              {(i % 2 === 0 || rows.length < 8) && (
                <text
                  x={pad.left + i * groupW + groupW / 2}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--muted)"
                >
                  {shortDay(row.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function hourLabel(hr: number) {
  if (hr === 0) return "12a";
  if (hr === 12) return "12p";
  return hr < 12 ? `${hr}a` : `${hr - 12}p`;
}

export function HourChart({ rows }: { rows: HourRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.vote_total));
  const peak = rows.reduce((best, r) => (r.vote_total > best.vote_total ? r : best), rows[0]);
  const total = rows.reduce((sum, r) => sum + r.vote_total, 0);

  return (
    <figure>
      <div className="flex h-40 items-end gap-1" role="img" aria-label="Votes by hour of day, New York time">
        {rows.map((row) => {
          const isPeak = total > 0 && row.hr === peak.hr;
          return (
            <div key={row.hr} className="flex h-full flex-1 flex-col justify-end" title={`${hourLabel(row.hr)}: ${row.vote_total} votes`}>
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${Math.max((row.vote_total / max) * 100, row.vote_total > 0 ? 4 : 1.5)}%`,
                  background: isPeak ? "var(--yellow)" : row.vote_total > 0 ? "var(--blue)" : "var(--border)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-bold text-muted">
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h}>{hourLabel(h)}</span>
        ))}
      </div>
      <figcaption className="mt-3 text-sm font-bold text-muted">
        {total > 0
          ? `Peak voting hour: ${hourLabel(peak.hr)} (${peak.vote_total} votes). New York time.`
          : "No votes yet."}
      </figcaption>
    </figure>
  );
}

export function RatioBar({ up, down }: { up: number; down: number }) {
  const total = up + down;
  const upPct = total === 0 ? 0 : Math.round((up / total) * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-4xl font-black text-primary">
          {total === 0 ? "-" : `${upPct}%`}
        </p>
        <p className="text-sm font-bold text-muted">of votes are upvotes</p>
      </div>
      <div
        className="mt-3 flex h-5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`${up} upvotes and ${down} downvotes`}
      >
        <div className="bg-primary transition-[width]" style={{ width: `${upPct}%` }} />
        <div className="bg-danger" style={{ width: total === 0 ? 0 : `${100 - upPct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-extrabold">
        <span className="text-primary">{up} up</span>
        <span className="text-danger">{down} down</span>
      </div>
    </div>
  );
}
