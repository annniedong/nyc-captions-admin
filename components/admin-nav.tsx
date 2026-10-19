"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartIcon,
  ImageIcon,
  UsersIcon,
  VoteIcon,
} from "@/components/icons";

const ITEMS = [
  { href: "/", label: "Overview", icon: ChartIcon },
  { href: "/media", label: "Media", icon: ImageIcon },
  { href: "/users", label: "Users", icon: UsersIcon },
  { href: "/votes", label: "Votes", icon: VoteIcon },
];

export function AdminNav({ layout }: { layout: "sidebar" | "bar" }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin"
      className={
        layout === "sidebar"
          ? "flex flex-col gap-1.5"
          : "flex gap-2 overflow-x-auto"
      }
    >
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide transition-colors ${
              active
                ? "bg-white/15 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
