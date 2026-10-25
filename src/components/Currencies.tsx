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
 * One kind of move a team has left: `free` of the league's `cap` per matchup (null = no limit), plus `bought` from the
 * League Shop. The two are shown apart (Update 4.2): matchup ones as pips that refill every week, bought ones as a gold
 * "+N" chip that never expires and is only used once the pips run out.
 */
export type MoveLeft = { free: number | null; cap: number | null; bought: number };
export type WalletLeague = { id: number; acq: MoveLeft; trades: MoveLeft };

/** The gold "+N" chip for bought Acquisitions or Trades. */
export function BoughtChip({ n, label, className = "" }: { n: number; label?: boolean; className?: string }) {
  if (n <= 0) return null;
  return (
    <span title={`${n} bought in the League Shop (never expire)`}
      className={`inline-flex items-center gap-1 rounded-full bg-coin/15 px-1.5 font-mono text-[0.85em] font-black leading-[1.5] text-coin ring-1 ring-coin/50 ${className}`}>
      +{n}{label && <span className="font-sans text-[0.8em] font-bold uppercase tracking-wider">bought</span>}
    </span>
  );
}

/** Matchup pips: one per move the league gives each matchup, lit while unused. Big caps fall back to "3/12". */
export function MatchupPips({ free, cap, color }: { free: number; cap: number; color: string }) {
  if (cap > 8 || cap === 0) return <span className="font-mono font-black">{free}<span className="text-white/40">/{cap}</span></span>;
  return (
    <span className="inline-flex items-center gap-1" title={`${free} of ${cap} left this matchup (refills every matchup)`}>
      {Array.from({ length: cap }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < free ? `${color} bg-current shadow-[0_0_6px_currentColor]` : "ring-1 ring-inset ring-white/30"}`} />
      ))}
    </span>
  );
}

/**
 * The three currencies, top right on every page: Fantasy Coins (yours everywhere), and the Acquisitions and Trades your
 * team has left this matchup in the league you're looking at (or your newest league elsewhere). Tapping it opens that
 * League Shop.
 */
export function Wallet({ coins: initial, leagues, compact }: { coins: number; leagues: WalletLeague[]; compact?: boolean }) {
  const coins = useLiveBalance(initial);
  const path = usePathname() ?? "";
  const here = Number(/^\/league\/(\d+)/.exec(path)?.[1]) || null;
  const lg = leagues.find((l) => l.id === here) ?? leagues[0] ?? null;
  const href = lg ? `/league/${lg.id}/shop` : "/leagues";
  const gap = compact ? "gap-1" : "gap-1.5";
  return (
    <Link href={href} title="Fantasy Coins, Acquisitions and Trades · open the League Shop"
      className={`pointer-events-auto inline-flex items-center rounded-full border border-line bg-panel/95 font-bold text-zinc-900 backdrop-blur transition hover:border-brand/60 ${compact ? "gap-2.5 px-3 py-1.5 text-xs" : "gap-4 px-4 py-2 text-sm shadow-lg shadow-black/20"}`}>
      <span className={`inline-flex items-center ${gap}`} title="Fantasy Coins">
        <LiveNumber value={Math.round(coins)} kind="pp" icon={<CoinIcon />} className={gap} />
        {!compact && <span className="text-xs font-semibold text-zinc-500">Coins</span>}
      </span>
      {lg && (
        <>
          <span className={`inline-flex items-center ${gap}`} title="Acquisitions: left this matchup, plus bought">
            <AcqIcon className={ACQ_COLOR} />{lg.acq.free ?? "∞"}<BoughtChip n={lg.acq.bought} />
          </span>
          <span className={`inline-flex items-center ${gap}`} title="Trades: left this matchup, plus bought">
            <TradeIcon className={TRADE_COLOR} />{lg.trades.free ?? "∞"}<BoughtChip n={lg.trades.bought} />
          </span>
        </>
      )}
    </Link>
  );
}
