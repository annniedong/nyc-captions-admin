type Tone = "green" | "red" | "yellow" | "blue" | "gray";

const TONES: Record<Tone, string> = {
  green: "bg-primary/15 text-primary",
  red: "bg-danger/15 text-danger",
  yellow: "bg-yellow/25 text-foreground",
  blue: "bg-blue/15 text-blue",
  gray: "bg-surface-2 text-muted",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function ActiveBadge({ active }: { active: unknown }) {
  return active ? <Badge tone="green">Active</Badge> : <Badge>Off</Badge>;
}
