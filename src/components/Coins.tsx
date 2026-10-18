import { LiveNumber } from "./LiveNumber";

/** Pack Points amount with the PackDraft currency icon (tinted to the surrounding text colour). */
export function CoinIcon({ className = "" }: { className?: string }) {
  const mask = "url(/packbucks.svg) center / contain no-repeat";
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current align-[-0.1em] ${className}`}
      style={{ width: "1.2em", height: "0.88em", mask, WebkitMask: mask }}
    />
  );
}

/** live: animate when the amount changes (count up, icon pop, floating +N). Use it where balances and winnings move. */
export function Coins({ n, className = "", live, from }: { n: number; className?: string; live?: boolean; from?: number }) {
  if (live) return <LiveNumber value={Math.round(n)} from={from} kind="pp" icon={<CoinIcon />} className={`gap-[0.3em] ${className}`} />;
  return (
    <span className={`inline-flex items-center gap-[0.3em] whitespace-nowrap ${className}`} title={`${Math.round(n).toLocaleString("en-US")} Pack Points`}>
      <CoinIcon />
      {Math.round(n).toLocaleString("en-US")}
    </span>
  );
}
