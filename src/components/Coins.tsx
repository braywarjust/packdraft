/** PackBucks amount with the PackDraft currency icon (tinted to the surrounding text colour). */
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

export function Coins({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.3em] whitespace-nowrap ${className}`} title={`${Math.round(n).toLocaleString("en-US")} PackBucks`}>
      <CoinIcon />
      {Math.round(n).toLocaleString("en-US")}
    </span>
  );
}
