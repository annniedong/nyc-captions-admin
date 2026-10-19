export function StatCard({
  label,
  value,
  hint,
  accent = "var(--foreground)",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-3xl border-2 border-border bg-surface p-5">
      <p className="text-xs font-black uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl font-black leading-none" style={{ color: accent }}>
        {value}
      </p>
      {hint && <p className="mt-2 text-sm font-bold text-muted">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border-2 border-border bg-surface p-5 sm:p-6 ${className}`}>
      <h2 className="font-display text-xl font-black">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm font-semibold text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
