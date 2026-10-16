"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const I = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  leagues: "M8 21h8M12 17v4M6 3h12v5a6 6 0 0 1-12 0zM6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3",
  packs: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10",
  collection: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  dfs: "M4 19V9M10 19V5M16 19v-7M22 19H2",
  mock: "M4 6h16M4 12h16M4 18h10",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H4V3h8",
};
function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function Sidebar({
  user, packs, leagues, logout,
}: {
  user: { name: string; color: string; coins: string };
  packs: number;
  leagues: { id: number; name: string; live: boolean }[];
  logout: () => Promise<void>;
}) {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const items = [
    { href: "/", label: "Home", icon: I.home, exact: true },
    { href: "/leagues", label: "Leagues", icon: I.leagues },
    { href: "/packs", label: "Packs", icon: I.packs, badge: packs },
    { href: "/collection", label: "Collection", icon: I.collection },
    { href: "/dfs", label: "Daily Fantasy", icon: I.dfs },
    { href: "/mock-draft", label: "Mock Draft", icon: I.mock },
  ];
  const isActive = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`) || (href === "/leagues" && path.startsWith("/league/")));

  const nav = (
    <div className="flex h-full flex-col">
      <Link href="/" className="block px-5 pb-6 pt-6" aria-label="PackDraft home">
        <Logo color="white" height={64} />
      </Link>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 scrollbar-thin">
        {items.map((it) => {
          const active = isActive(it.href, it.exact);
          return (
            <Link key={it.href} href={it.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? "bg-white text-brand shadow-sm" : "text-white/90 hover:bg-white/15 hover:text-white"}`}>
              <Icon d={it.icon} />
              <span className="flex-1">{it.label}</span>
              {!!it.badge && <span className={`rounded-full px-2 text-xs font-black ${active ? "bg-brand text-white" : "bg-white text-brand"}`}>{it.badge}</span>}
            </Link>
          );
        })}
        {leagues.length > 0 && (
          <div className="pt-6">
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-widest text-white/60">My leagues</p>
            {leagues.map((l) => {
              const active = path.startsWith(`/league/${l.id}`);
              return (
                <Link key={l.id} href={`/league/${l.id}`}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${active ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
                  <span className={`h-2 w-2 rounded-full ${l.live ? "bg-white" : "bg-white/40"}`} />
                  <span className="truncate">{l.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </nav>
      <div className="m-3 rounded-2xl bg-white/10 p-3 text-white">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-full ring-2 ring-white" style={{ background: user.color }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user.name}</p>
            <p className="text-xs text-white/75">{user.coins} PackBucks</p>
          </div>
          <form action={logout}>
            <button title="Log out" className="rounded-lg p-1.5 text-white/75 hover:bg-white/15 hover:text-white"><Icon d={I.logout} /></button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-brand lg:block">{nav}</aside>
      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-40 flex items-center justify-between bg-brand px-4 py-2.5 lg:hidden">
        <Link href="/" aria-label="PackDraft home"><Logo color="white" height={34} /></Link>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-brand">{user.coins}</span>
          <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-white hover:bg-white/15" aria-label="Open menu">
            <Icon d="M4 6h16M4 12h16M4 18h16" />
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-brand shadow-2xl">{nav}</aside>
        </div>
      )}
    </>
  );
}
