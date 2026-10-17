/** The slab mark (same as the Collection nav icon), tinted with the text colour. */
export function SlabIcon({ className = "" }: { className?: string }) {
  const mask = "url(/collection-icon.svg) center / contain no-repeat";
  return <span aria-hidden className={`inline-block shrink-0 bg-current ${className}`} style={{ width: "1.07em", height: "1em", mask, WebkitMask: mask }} />;
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
