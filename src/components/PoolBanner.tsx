import Link from "next/link";
import { RARITY_HEX, RARITY_ORDER } from "@/lib/packs";

export type PoolFace = { id: number; name: string; team: string; photo: string | null };

/**
 * League Packs' pack pool banner: the league's rostered players drift past in rarity rings behind the title, a shine
 * sweeps across, and the whole banner opens the pool. Transform and opacity only; still for reduced motion.
 */
export function PoolBanner({ href, faces, count, color, alt }: { href: string; faces: PoolFace[]; count: number; color: string; alt: string }) {
  // Two copies side by side so the row loops seamlessly at -50%.
  const row = faces.length ? [...faces, ...faces] : [];
  const secs = Math.max(24, faces.length * 2.4);
  return (
    <Link href={href} aria-label={`View the pack pool, ${count} players`}
      className="pool-banner group relative block overflow-hidden rounded-2xl border border-white/10 shadow-xl"
      style={{ background: `linear-gradient(110deg, ${color} 0%, ${color} 40%, ${alt} 130%)` }}>
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)" }} />
      {/* Faces drifting past */}
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center opacity-60 transition-opacity duration-300 group-hover:opacity-90 [mask-image:linear-gradient(90deg,transparent,#000_35%,#000_85%,transparent)]">
        <div className="pool-marquee flex w-max gap-3 pl-3" style={{ animationDuration: `${secs}s` }}>
          {row.map((f, i) => {
            const ring = RARITY_HEX[RARITY_ORDER[i % RARITY_ORDER.length]];
            return (
              <div key={`${f.id}-${i}`} className="pool-face relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-black/30 ring-[3px] sm:h-20 sm:w-20"
                style={{ ["--tw-ring-color" as string]: ring, animationDelay: `${(i % 7) * -0.45}s` }}>
                {f.photo
                  ? <img src={f.photo} alt="" loading="lazy" className="h-full w-full object-cover object-top" />
                  : <span className="flex h-full w-full items-center justify-center text-xs font-black text-white/80">{f.team}</span>}
              </div>
            );
          })}
        </div>
      </div>
      {/* Shine */}
      <div className="pool-shine pointer-events-none absolute inset-0" />
      {/* Copy */}
      <div className="relative flex min-h-[112px] items-center gap-4 bg-gradient-to-r from-black/70 via-black/40 to-transparent p-4 sm:min-h-[132px] sm:p-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">League Packs</p>
          <p className="text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">The pack pool</p>
          <p className="mt-0.5 text-sm text-white/80"><b className="font-mono text-white">{count}</b> rostered players. Every slab comes from here.</p>
        </div>
        <span className="pool-cta shrink-0 rounded-full bg-[#fff] px-4 py-2 text-sm font-black text-black shadow-lg transition group-hover:scale-105">
          View pool <span className="pool-arrow inline-block">→</span>
        </span>
      </div>
    </Link>
  );
}
