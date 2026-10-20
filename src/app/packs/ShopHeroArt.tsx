/** Sunburst wedges around the centre of a 200x200 box (the casino thumbnails' look, bigger). */
const RAYS = Array.from({ length: 20 }, (_, i) => {
  const a = (i * Math.PI) / 10, b = a + Math.PI / 20;
  const p = (t: number) => `${(100 + 160 * Math.cos(t)).toFixed(1)} ${(100 + 160 * Math.sin(t)).toFixed(1)}`;
  return `M100 100L${p(a)}L${p(b)}Z`;
}).join("");
const SPARKS: [number, number, number, number][] = [[8, 22, 9, 0], [22, 70, 7, 1.1], [44, 14, 6, .5], [62, 78, 8, 1.8], [76, 26, 10, .9], [90, 64, 7, 2.3], [54, 46, 5, 1.4], [34, 40, 6, 2.7]];

/**
 * Pack Shop banner background, casino style: a slowly turning sunburst with a soft glow, twinkling sparkles, a sheen
 * that sweeps across every few seconds.
 * Transform and opacity only.
 */
export function ShopHeroArt() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* A square well wider than the banner, centred on it, so the turning rays always reach every edge and corner. */}
      <div className="absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2">
        <svg viewBox="0 0 200 200" className="casino-rays-spin h-full w-full overflow-visible">
          <path d={RAYS} fill="#fff" opacity=".08" />
        </svg>
        <div className="shop-glow absolute inset-[38%] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,.35), transparent 65%)" }} />
      </div>
      {SPARKS.map(([x, y, s, d], i) => (
        <svg key={i} viewBox="-10 -10 20 20" className="slab-twinkle absolute" style={{ left: `${x}%`, top: `${y}%`, width: s * 2, height: s * 2, animationDelay: `${d}s` }}>
          <path d="M0-10L2.2-2.2L10 0L2.2 2.2L0 10L-2.2 2.2L-10 0L-2.2-2.2Z" fill="#fff" />
        </svg>
      ))}
      <div className="shop-sheen absolute inset-y-0 w-1/3" />
    </div>
  );
}
