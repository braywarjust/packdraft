import { LiveNumber } from "./LiveNumber";

/** The Fantasy Coins icon, always in the Fantasy Points blue (pass a background class to tint it otherwise). */
export function CoinIcon({ className = "" }: { className?: string }) {
  const mask = "url(/fantasy-coin.svg) center / contain no-repeat";
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 align-[-0.12em] ${className}`}
      style={{ width: "1em", height: "1em", mask, WebkitMask: mask, background: "var(--coin-ink, var(--color-fpts))" }}
    />
  );
}

/** Fantasy Coins amount with the coin icon. live: animate when the amount changes (count up, icon pop, floating +N). */
export function Coins({ n, className = "", live, from }: { n: number; className?: string; live?: boolean; from?: number }) {
  if (live) return <LiveNumber value={Math.round(n)} from={from} kind="pp" icon={<CoinIcon />} className={`gap-[0.3em] ${className}`} />;
  return (
    <span className={`inline-flex items-center gap-[0.3em] whitespace-nowrap ${className}`} title={`${Math.round(n).toLocaleString("en-US")} Fantasy Coins`}>
      <CoinIcon />
      {Math.round(n).toLocaleString("en-US")}
    </span>
  );
}
