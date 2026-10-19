import Link from "next/link";
import { SubwayBullet } from "@/components/subway-bullet";

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 whitespace-nowrap"
      aria-label="NYC Captions admin home"
    >
      <SubwayBullet line="C" size={34} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-black tracking-tight">
          NYC Captions
        </span>
        <span
          className={`mt-1 text-[10px] font-black uppercase tracking-[0.2em] ${
            inverted ? "text-yellow" : "text-muted"
          }`}
        >
          Admin
        </span>
      </span>
    </Link>
  );
}
