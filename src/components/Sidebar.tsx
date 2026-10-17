"use client";

import { TeamBadge, type BrandLite } from "./TeamBadge";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { CoinIcon, Coins } from "./Coins";

import { NAV_ICONS as I, NavIcon as Icon } from "./NavIcons";

const STORE_KEY = "pd-sidebar";

export function Sidebar({
  user, packs, leagues, logout,
}: {
  user: { name: string; color: string; coins: number; tester?: boolean };
  packs: number;
  leagues: { id: number; name: string; live: boolean; brand?: BrandLite }[];
  logout: () => Promise<void>;
}) {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => setCollapsed(document.documentElement.dataset.sidebar === "collapsed"), []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.dataset.sidebar = next ? "collapsed" : "open";
    try { localStorage.setItem(STORE_KEY, next ? "collapsed" : "open"); } catch {}
  };

  const items = [
    { href: "/", label: "Home", icon: I.home, exact: true },
    { href: "/leagues", label: "Leagues", icon: I.leagues },
    { href: "/teams", label: "Team Studio", icon: I.studio },
    { href: "/packs", label: "Packs", icon: I.packs, badge: packs },
    { href: "/collection", label: "Collection", icon: I.collection },
    { href: "/bets", label: "Sportsbook", icon: I.bets },
    { href: "/mock-draft", label: "Mock Draft", icon: I.mock },
  ];
  const isActive = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`) || (href === "/leagues" && path.startsWith("/league/")));

  // `mini` = icon-only rail (desktop collapsed). The mobile drawer always shows the full menu.
  const nav = (mini: boolean) => (
    <div className="flex h-full flex-col">
      <Link href="/" className={`block ${mini ? "px-3 pb-6 pt-6" : "px-6 pb-8 pt-7"}`} aria-label="PackDraft home">
        <Logo height={mini ? 26 : 70} className={mini ? "mx-auto" : ""} />
      </Link>
      <nav className={`flex-1 space-y-1.5 overflow-y-auto scrollbar-thin ${mini ? "px-2.5" : "px-4"}`}>
        {items.map((it) => {
          const active = isActive(it.href, it.exact);
          return (
            <Link key={it.href} href={it.href} title={mini ? it.label : undefined}
              className={`relative flex items-center rounded-lg border bg-white text-sm font-medium transition ${mini ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} ${active ? "border-brand/30 text-brand shadow-sm" : "border-zinc-200/70 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"}`}>
              {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-accent" />}
              <Icon d={it.icon} box={28} />
              {!mini && <span className="flex-1">{it.label}</span>}
              {!!it.badge && (
                mini
                  ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
                  : <span className="rounded-full bg-accent px-2 text-xs font-bold text-white">{it.badge}</span>
              )}
            </Link>
          );
        })}
        {!mini && leagues.length > 0 && (
          <div className="pt-6">
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">My leagues</p>
            <div className="space-y-1">
              {leagues.map((l) => {
                const active = path.startsWith(`/league/${l.id}`);
                return (
                  <Link key={l.id} href={`/league/${l.id}`}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-white font-medium text-brand shadow-sm" : "text-zinc-600 hover:bg-white hover:text-zinc-900"}`}>
                    {l.brand ? <TeamBadge brand={l.brand} size={20} /> : <span className={`h-2 w-2 rounded-full ${l.live ? "bg-accent" : "bg-zinc-300"}`} />}
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate font-bold tracking-wide">{l.brand?.abbr ?? l.name}</span>
                      {l.brand && <span className="block truncate text-[11px] font-normal text-zinc-400">{l.name}</span>}
                    </span>
                    {l.live && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" title="Live" />}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>
      <div className={mini ? "space-y-2 p-2.5" : "m-4 space-y-2"}>
        <div className={`rounded-lg border border-zinc-200 bg-white ${mini ? "p-2" : "p-3"}`}>
          <div className={`flex items-center gap-2 ${mini ? "flex-col" : ""}`}>
            <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: user.color }} title={mini ? `${user.name} · ${user.tester ? "Unlimited" : user.coins.toLocaleString()} Pack Points` : undefined} />
            {!mini && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="text-xs text-zinc-500">{user.tester ? <span className="inline-flex items-center gap-1"><CoinIcon />Unlimited</span> : <Coins n={user.coins} />}</p>
              </div>
            )}
            <form action={logout}>
              <button title="Log out" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"><Icon d={I.logout} /></button>
            </form>
          </div>
        </div>
        <button onClick={toggle} title={mini ? "Expand menu" : "Collapse menu"}
          className={`hidden w-full items-center rounded-lg py-2 text-xs font-medium text-zinc-500 hover:bg-white hover:text-zinc-900 lg:flex ${mini ? "justify-center" : "gap-2 px-3"}`}>
          <Icon d={mini ? I.expand : I.collapse} />
          {!mini && "Collapse menu"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail: width follows the --sb variable set on <html> (see layout.tsx). */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden border-r border-zinc-200 bg-zinc-100 transition-[width] duration-200 lg:block" style={{ width: "var(--sb)" }}>
        {nav(collapsed)}
      </aside>
      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-2.5 lg:hidden">
        <Link href="/" aria-label="PackDraft home"><Logo height={34} /></Link>
        <div className="flex items-center gap-3">
          <Link href="/packs" className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700"><span className="text-emerald-600">{user.tester ? <span className="inline-flex items-center gap-1"><CoinIcon />Unlimited</span> : <Coins n={user.coins} />}</span></Link>
          <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-zinc-700 hover:bg-zinc-100" aria-label="Open menu">
            <Icon d="M4 6h16M4 12h16M4 18h16" />
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-zinc-100 shadow-2xl">{nav(false)}</aside>
        </div>
      )}
    </>
  );
}
