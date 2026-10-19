import { lineColors } from "@/lib/subway";

export function SubwayBullet({
  line,
  size = 28,
  className = "",
}: {
  line: string;
  size?: number;
  className?: string;
}) {
  const { background, color } = lineColors(line);

  return (
    <span
      role="img"
      aria-label={`${line} train`}
      style={{
        background,
        color,
        width: size,
        height: size,
        fontSize: size * 0.56,
      }}
      className={`inline-grid shrink-0 place-items-center rounded-full font-black leading-none ${className}`}
    >
      {line}
    </span>
  );
}
