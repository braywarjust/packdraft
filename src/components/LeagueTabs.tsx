"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The league's tab bar (Update 4.2): one blue pill slides (with a little spring) to the tab you tap the moment you tap
 * it, the tab squeezes under your finger, and on phones the bar scrolls the picked tab into view. The page loader
 * covers the wait for the page itself.
 */
export function LeagueTabs({ id, hasTeam, drafting }: { id: number; hasTeam: boolean; drafting: boolean }) {
  const path = usePathname() ?? "";
  const base = `/league/${id}`;
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [path]);
  const tabs = [
    { href: base, label: "League" },
    ...(hasTeam ? [{ href: `${base}/team`, label: "My Team" }] : []),
    { href: `${base}/shop`, label: "Shop" },
    { href: `${base}/matchups`, label: "Matchups" },
    { href: `${base}/players`, label: "Players" },
    { href: `${base}/trades`, label: "Trades" },
    { href: `${base}/draft`, label: drafting ? "Draft Room (live)" : "Draft" },
    { href: `${base}/chat`, label: "Chat" },
    { href: `${base}/settings`, label: "Settings" },
  ];
  const isActive = (href: string) => (tapped ? tapped === href : href === base ? path === base
    : href === `${base}/matchups` ? path.startsWith(`${base}/matchup`)
    : path.startsWith(href));
  const active = tabs.find((t) => isActive(t.href))?.href ?? null;

  const nav = useRef<HTMLElement>(null);
  const refs = useRef(new Map<string, HTMLAnchorElement>());
  const [pill, setPill] = useState<{ x: number; w: number; ready: boolean } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = active ? refs.current.get(active) : null;
      if (!el) return setPill(null);
      setPill((p) => ({ x: el.offsetLeft, w: el.offsetWidth, ready: !!p }));
      const n = nav.current;
      if (n && (el.offsetLeft < n.scrollLeft || el.offsetLeft + el.offsetWidth > n.scrollLeft + n.clientWidth)) {
        n.scrollTo({ left: el.offsetLeft - n.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
      }
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active, drafting, hasTeam]);

  return (
    <nav ref={nav} className="relative flex gap-1 overflow-x-auto border-b border-line pb-2 scrollbar-thin">
      {pill && (
        <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-10 rounded-lg bg-brand shadow-[0_4px_14px_rgba(31,99,181,.45)]"
          style={{ width: pill.w, transform: `translateX(${pill.x}px)`,
            transition: pill.ready ? "transform 320ms cubic-bezier(.3,1.35,.5,1), width 320ms cubic-bezier(.3,1.35,.5,1)" : "none" }} />
      )}
      {tabs.map((t) => {
        const on = t.href === active;
        return (
          <Link key={t.href} href={t.href} ref={(el) => { if (el) refs.current.set(t.href, el); else refs.current.delete(t.href); }}
            onClick={() => setTapped(t.href)}
            className={`relative z-10 inline-flex min-h-10 touch-manipulation select-none items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-[color,transform] duration-150 active:scale-90 ${
              on ? "text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"} ${!pill && on ? "bg-brand" : ""}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
