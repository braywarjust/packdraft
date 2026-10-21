import { CoinIcon } from "./Coins";
import { PP_PER_POINT } from "@/lib/economy-rate";
import { LiveNumber } from "./LiveNumber";

/**
 * Fantasy points (what players score in league matchups), shown with the Fantasy Points logo so they're never
 * confused with Pack Points (the currency, CoinIcon in Coins.tsx). 1 fantasy point pays 0.5 Pack Points.
 */
/**
 * Blue on the app's dark panels by default. Any container can switch it for its own background by setting the
 * CSS variable --fpts-ink (see fptsInk() in lib/color: black on light colours, white on dark ones), or pass tone.
 */
export function FptIcon({ className = "", tone }: { className?: string; tone?: "blue" | "white" | "black" }) {
  const mask = "url(/fantasy-points.svg) center / contain no-repeat";
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 align-[-0.1em] ${className}`}
      style={{ width: "0.95em", height: "0.95em", mask, WebkitMask: mask,
        background: tone === "white" ? "#fff" : tone === "black" ? "#0b0f17" : tone === "blue" ? "var(--color-fpts)" : "var(--fpts-ink, var(--color-fpts))" }}
    />
  );
}

/** live: animate when the points change (count up, icon pop, floating +N). Use it for scores that move during games. */
export function Fpts({ n, digits = 1, className = "", iconClass = "", tone, live }: { n: number; digits?: number; className?: string; iconClass?: string; tone?: "blue" | "white" | "black"; live?: boolean }) {
  if (live) return <LiveNumber value={+n.toFixed(digits)} digits={digits} kind="fp" icon={<FptIcon className={iconClass} tone={tone} />} className={`gap-[0.25em] ${className}`} />;
  const s = n.toFixed(digits);
  return (
    <span className={`inline-flex items-center gap-[0.25em] whitespace-nowrap ${className}`} title={`${s} fantasy points`}>
      <FptIcon className={iconClass} tone={tone} />
      {s}
    </span>
  );
}

/** Explains the two kinds of points side by side. */
export function PointsKey({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`grid gap-2 text-xs ${compact ? "" : "sm:grid-cols-2"} ${className}`}>
      <div className="flex items-start gap-2 rounded-lg bg-black/20 p-2.5 ring-1 ring-white/5">
        <FptIcon className="mt-0.5 text-base" />
        <p className="text-zinc-400"><b className="text-fpts">Fantasy points</b> win your matchups.</p>
      </div>
      <div className="flex items-start gap-2 rounded-lg bg-black/20 p-2.5 ring-1 ring-white/5">
        <CoinIcon className="mt-0.5 text-base text-emerald-500" />
        <p className="text-zinc-400"><b className="text-white">Pack Points</b> buy packs. Each fantasy point your starters score pays {PP_PER_POINT}.</p>
      </div>
    </div>
  );
}
