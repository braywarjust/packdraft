import { CoinIcon } from "./Coins";
import { PP_PER_POINT } from "@/lib/economy-rate";

/**
 * Fantasy points (what players score in league matchups), shown with the Fantasy Points logo so they're never
 * confused with Pack Points (the currency, CoinIcon in Coins.tsx). 1 fantasy point pays 0.5 Pack Points.
 */
export function FptIcon({ className = "" }: { className?: string }) {
  const mask = "url(/fantasy-points.svg) center / contain no-repeat";
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current align-[-0.1em] ${className}`}
      style={{ width: "0.95em", height: "0.95em", mask, WebkitMask: mask }}
    />
  );
}

export function Fpts({ n, digits = 1, className = "", iconClass = "" }: { n: number; digits?: number; className?: string; iconClass?: string }) {
  const s = n.toFixed(digits);
  return (
    <span className={`inline-flex items-center gap-[0.25em] whitespace-nowrap ${className}`} title={`${s} fantasy points`}>
      <FptIcon className={iconClass} />
      {s}
    </span>
  );
}

/** Explains the two kinds of points side by side. */
export function PointsKey({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`grid gap-2 text-xs ${compact ? "" : "sm:grid-cols-2"} ${className}`}>
      <div className="flex items-start gap-2 rounded-lg bg-black/20 p-2.5 ring-1 ring-white/5">
        <FptIcon className="mt-0.5 text-base text-sky-400" />
        <p className="text-zinc-400"><b className="text-white">Fantasy points</b> are what your players score in league games. They decide your matchups and standings.</p>
      </div>
      <div className="flex items-start gap-2 rounded-lg bg-black/20 p-2.5 ring-1 ring-white/5">
        <CoinIcon className="mt-0.5 text-base text-emerald-500" />
        <p className="text-zinc-400"><b className="text-white">Pack Points</b> are the currency you spend on packs. Every fantasy point your starters score pays you {PP_PER_POINT} Pack Points.</p>
      </div>
    </div>
  );
}
