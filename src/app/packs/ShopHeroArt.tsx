import { AnimatedLogo } from "@/components/AnimatedLogo";

/** Sunburst wedges around the centre of a 200x200 box (the casino thumbnails' look, bigger). */
const RAYS = Array.from({ length: 20 }, (_, i) => {
  const a = (i * Math.PI) / 10, b = a + Math.PI / 20;
  const p = (t: number) => `${(100 + 160 * Math.cos(t)).toFixed(1)} ${(100 + 160 * Math.sin(t)).toFixed(1)}`;
  return `M100 100L${p(a)}L${p(b)}Z`;
}).join("");
const SPARKS: [number, number, number, number][] = [[8, 22, 9, 0], [22, 70, 7, 1.1], [44, 14, 6, .5], [62, 78, 8, 1.8], [76, 26, 10, .9], [90, 64, 7, 2.3], [54, 46, 5, 1.4], [34, 40, 6, 2.7]];

/**
 * Pack Shop banner background, casino style: a slowly turning sunburst with a soft glow, twinkling sparkles, a sheen
 * that sweeps across every few seconds, and the PackDraft logo floating on the right, playing its animation.
 * Transform and opacity only.
 */
export function ShopHeroArt() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute right-[-6%] top-1/2 aspect-square w-[70%] max-w-[760px] -translate-y-1/2">
        <svg viewBox="0 0 200 200" className="casino-rays-spin h-full w-full">
          <path d={RAYS} fill="#fff" opacity=".08" />
        </svg>
        <div className="shop-glow absolute inset-[22%] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,.35), transparent 65%)" }} />
      </div>
      {SPARKS.map(([x, y, s, d], i) => (
        <svg key={i} viewBox="-10 -10 20 20" className="slab-twinkle absolute" style={{ left: `${x}%`, top: `${y}%`, width: s * 2, height: s * 2, animationDelay: `${d}s` }}>
          <path d="M0-10L2.2-2.2L10 0L2.2 2.2L0 10L-2.2 2.2L-10 0L-2.2-2.2Z" fill="#fff" />
        </svg>
      ))}
      <div className="shop-sheen absolute inset-y-0 w-1/3" />
      <div className="logo-play shop-logo absolute right-[5%] top-[37%] hidden w-[170px] sm:block lg:w-[200px]">
        <AnimatedLogo className="w-full drop-shadow-[0_14px_30px_rgba(0,0,0,.45)]" />
      </div>
    </div>
  );
}
