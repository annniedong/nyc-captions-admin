"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartIcon,
  ImageIcon,
  UsersIcon,
  VoteIcon,
} from "@/components/icons";

type Item = { href: string; label: string; icon?: typeof ChartIcon };

const SECTIONS: { title?: string; items: Item[] }[] = [
  {
    items: [
      { href: "/", label: "Overview", icon: ChartIcon },
      { href: "/media", label: "Media", icon: ImageIcon },
      { href: "/users", label: "Users", icon: UsersIcon },
      { href: "/votes", label: "Votes", icon: VoteIcon },
    ],
  },
  {
    title: "AI pipeline",
    items: [
      { href: "/data/chains", label: "Prompt chains" },
      { href: "/data/steps", label: "Chain steps" },
      { href: "/data/mix", label: "Chain mix" },
      { href: "/data/terms", label: "Terms" },
      { href: "/data/examples", label: "Examples" },
      { href: "/data/providers", label: "LLM providers" },
      { href: "/data/models", label: "LLM models" },
    ],
  },
  {
    title: "Activity",
    items: [
      { href: "/data/requests", label: "Requests" },
      { href: "/data/responses", label: "LLM responses" },
    ],
  },
  {
    title: "Access",
    items: [
      { href: "/data/domains", label: "Signup domains" },
      { href: "/data/emails", label: "Whitelisted emails" },
    ],
  },
];

export function AdminNav({ layout }: { layout: "sidebar" | "bar" }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  if (layout === "bar") {
    return (
      <nav aria-label="Admin" className="flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.flatMap((s) => s.items).map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={`shrink-0 rounded-2xl px-3.5 py-2 text-xs font-extrabold uppercase tracking-wide transition-colors ${
              isActive(href) ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {SECTIONS.map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-1">
          {section.title && (
            <p className="px-4 pb-1 text-[11px] font-black uppercase tracking-widest text-white/40">
              {section.title}
            </p>
          )}
          {section.items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-2xl px-4 text-sm font-extrabold uppercase tracking-wide transition-colors ${
                Icon ? "py-2.5" : "py-1.5 text-[13px]"
              } ${
                isActive(href)
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {Icon && <Icon className="h-5 w-5" />}
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
