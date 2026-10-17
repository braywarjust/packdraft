"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LeagueTabs({ id, isCommish, hasTeam, drafting }: { id: number; isCommish: boolean; hasTeam: boolean; drafting: boolean }) {
  const path = usePathname() ?? "";
  const base = `/league/${id}`;
  const tabs = [
    { href: base, label: "League" },
    ...(hasTeam ? [{ href: `${base}/team`, label: "My Team" }] : []),
    { href: `${base}/matchups`, label: "Matchups" },
    { href: `${base}/players`, label: "Players" },
    { href: `${base}/trades`, label: "Trades" },
    { href: `${base}/draft`, label: drafting ? "Draft Room (live)" : "Draft" },
    { href: `${base}/chat`, label: "Chat" },
    ...(isCommish ? [{ href: `${base}/settings`, label: "Commish" }] : []),
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line pb-2 scrollbar-thin">
      {tabs.map((t) => {
        const active = t.href === base ? path === base
          : t.href === `${base}/matchups` ? path.startsWith(`${base}/matchup`)
          : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`tab ${active ? "tab-active" : ""}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
