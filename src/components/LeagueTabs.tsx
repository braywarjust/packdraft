"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The league's tab bar (Update 4.2): one blue pill slides (with a little spring) to the tab you tap the moment you tap
 * it, the tab squeezes under your finger. The page loader covers the wait for the page itself.
 * Update 4.3: four tabs that fit an iPhone with no sideways scroll. League holds Chat, Draft and Settings, Roster holds
 * Trades and the Shop; those show as a small row under the bar.
 */
export function LeagueTabs({ id, hasTeam, drafting }: { id: number; hasTeam: boolean; drafting: boolean }) {
  const path = usePathname() ?? "";
  const base = `/league/${id}`;
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [path]);
  const groups: { href: string; label: string; subs?: { href: string; label: string; live?: boolean }[] }[] = [
    { href: base, label: "League", subs: [
      { href: base, label: "Home" },
      { href: `${base}/chat`, label: "Chat" },
      { href: `${base}/draft`, label: "Draft", live: drafting },
      { href: `${base}/settings`, label: "Settings" },
    ] },
    { href: hasTeam ? `${base}/team` : `${base}/trades`, label: "Roster", subs: [
      ...(hasTeam ? [{ href: `${base}/team`, label: "Lineup" }] : []),
      { href: `${base}/trades`, label: "Trades" },
      { href: `${base}/shop`, label: "Shop" },
    ] },
    { href: `${base}/matchups`, label: "Matchups" },
    { href: `${base}/players`, label: "Players" },
  ];
  const onPage = (href: string) => (href === base ? path === base
    : href === `${base}/matchups` ? path.startsWith(`${base}/matchup`)
    : path.startsWith(href));
  const isActive = (href: string) => (tapped ? tapped === href : onPage(href));
  // A tab is on when you're on any of its pages (or just tapped one of them).
  const group = groups.find((g) => (g.subs ?? [g]).some((x) => isActive(x.href)) || isActive(g.href));
  const active = group?.href ?? null;
  const subActive = group?.subs?.find((x) => isActive(x.href))?.href ?? null;
  const nav = useRef<HTMLElement>(null);
  const refs = useRef(new Map<string, HTMLAnchorElement>());
  const [pill, setPill] = useState<{ x: number; w: number; ready: boolean } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = active ? refs.current.get(active) : null;
      if (!el) return setPill(null);
      setPill((p) => ({ x: el.offsetLeft, w: el.offsetWidth, ready: !!p }));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active, drafting, hasTeam]);

  return (
    <div>
    <nav ref={nav} className="relative flex gap-1 border-b border-line pb-2">
      {pill && (
        <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-10 rounded-lg bg-brand shadow-[0_4px_14px_rgba(31,99,181,.45)]"
          style={{ width: pill.w, transform: `translateX(${pill.x}px)`,
            transition: pill.ready ? "transform 320ms cubic-bezier(.3,1.35,.5,1), width 320ms cubic-bezier(.3,1.35,.5,1)" : "none" }} />
      )}
      {groups.map((t) => {
        const on = t.href === active;
        return (
          <Link key={t.href} href={t.href} ref={(el) => { if (el) refs.current.set(t.href, el); else refs.current.delete(t.href); }}
            onClick={() => setTapped(t.href)}
            className={`relative z-10 inline-flex min-h-10 flex-1 touch-manipulation select-none items-center justify-center whitespace-nowrap rounded-lg px-2 sm:flex-none sm:px-4 text-sm font-semibold transition-[color,transform] duration-150 active:scale-90 ${
              on ? "text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"} ${!pill && on ? "bg-brand" : ""}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
    {group?.subs && (
      <nav className="mt-2 flex gap-1.5">
        {group.subs.map((x) => {
          const on = x.href === subActive;
          return (
            <Link key={x.href} href={x.href} onClick={() => setTapped(x.href)}
              className={`press inline-flex min-h-8 touch-manipulation select-none items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-bold transition-colors ${
                on ? "bg-white/15 text-white ring-1 ring-white/20" : "text-zinc-500 hover:text-zinc-300"}`}>
              {x.live && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}{x.label}
            </Link>
          );
        })}
      </nav>
    )}
    </div>
  );
}
