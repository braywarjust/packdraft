/** The slab mark (same as the Collection nav icon), tinted with the text colour. */
export function SlabIcon({ className = "" }: { className?: string }) {
  const mask = "url(/collection-icon.svg) center / contain no-repeat";
  return <span aria-hidden className={`inline-block shrink-0 bg-current ${className}`} style={{ width: "1.07em", height: "1em", mask, WebkitMask: mask }} />;
}

/** Next to a player's name: he has a slab equipped (pulses while that game is live). */
export function SlabOn({ boost }: { boost: { state: string } | null | undefined }) {
  if (!boost) return null;
  return (
    <span title={boost.state === "pre" ? "Slab equipped for his next game" : "Slab equipped"}
      className={`inline-grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md bg-fpts text-[11px] text-black ${boost.state === "in" ? "animate-pulse" : ""}`}>
      <SlabIcon />
    </span>
  );
}

/** "▰ 1 slab" / "▰ 5 slabs" label. */
export function SlabCount({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      <SlabIcon />
      {n} slab{n === 1 ? "" : "s"}
    </span>
  );
}
