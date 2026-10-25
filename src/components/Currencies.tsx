"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CoinIcon } from "./Coins";
import { LiveNumber } from "./LiveNumber";
import { useLiveBalance } from "./useLiveBalance";

/** Placeholder icon for Acquisitions: a player with a plus. */
export function AcqIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`inline-block h-[1em] w-[1em] shrink-0 align-[-0.12em] ${className}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M19 8v6M16 11h6" />
    </svg>
  );
}

/** Placeholder icon for Trades: two arrows swapping. */
export function TradeIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`inline-block h-[1em] w-[1em] shrink-0 align-[-0.12em] ${className}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h14l-4-4M20 16H6l4 4" />
    </svg>
  );
}

export const ACQ_COLOR = "text-emerald-400";
export const TRADE_COLOR = "text-amber-400";

/**
 * One kind of move a team has: `free` left of the league's `cap` per matchup (null = no limit), plus `bought` from the
 * League Shop. Shown as one count (Update 4.2), e.g. 6/6, with bought ones added to both sides: 2 bought makes it 8/8.
 */
export type MoveLeft = { free: number | null; cap: number | null; bought: number };

/** "5/8" (left / this matchup's total), or ∞ when the league has no limit. */
export function MoveCount({ m, className = "" }: { m: MoveLeft; className?: string }) {
  if (m.free == null || m.cap == null) return <span className={`font-mono font-black ${className}`}>∞</span>;
  return <span className={`font-mono font-black ${className}`}>{m.free + m.bought}<span className="opacity-50">/{m.cap + m.bought}</span></span>;
}

/**
 * Your Fantasy Coins, top right on every page. Acquisitions and Trades belong to one league each, so they live on
 * My Team, Players and the League Shop instead (Update 4.2). Tapping it opens the League Shop of the league you're in,
 * or the Sportsbook elsewhere.
 */
export function Wallet({ coins: initial, compact }: { coins: number; compact?: boolean }) {
  const coins = useLiveBalance(initial);
  const path = usePathname() ?? "";
  const here = Number(/^\/league\/(\d+)/.exec(path)?.[1]) || null;
  const href = here ? `/league/${here}/shop` : "/bets";
  const gap = compact ? "gap-1" : "gap-1.5";
  return (
    <Link href={href} title="Fantasy Coins"
      className={`pointer-events-auto inline-flex items-center rounded-full border border-line bg-panel/95 font-bold text-zinc-900 backdrop-blur transition hover:border-brand/60 ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm shadow-lg shadow-black/20"}`}>
      <span className={`inline-flex items-center ${gap}`}>
        <LiveNumber value={Math.round(coins)} kind="pp" icon={<CoinIcon />} className={gap} />
        {!compact && <span className="text-xs font-semibold text-zinc-500">Coins</span>}
      </span>
    </Link>
  );
}
