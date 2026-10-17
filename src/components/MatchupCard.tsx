import { CrownIcon } from "./Icons";
import Link from "next/link";
import { TeamBadge, type BrandLite } from "./TeamBadge";
import { Fpts } from "@/components/Fpts";

export type MatchSide = { id: number; brand: BrandLite; record: string; score: number; proj: number };

/** Links when given an href (cards in lists); a plain block on the matchup page itself. */
function Wrap({ href, className, style, children }: { href?: string; className: string; style: React.CSSProperties; children: React.ReactNode }) {
  return href ? <Link href={href} className={className} style={style}>{children}</Link> : <div className={className} style={style}>{children}</div>;
}

/** A head-to-head card split in the two teams' colours, logos facing off, scores big. */
export function MatchupCard({ href, home, away, status, winProb, mine, big = false }: {
  href?: string; home: MatchSide; away: MatchSide; status: "pre" | "live" | "final"; winProb: number; mine?: boolean; big?: boolean;
}) {
  const hp = Math.round(winProb * 100);
  const winner = status === "final" ? (home.score > away.score ? "home" : away.score > home.score ? "away" : null) : null;
  const side = (s: MatchSide, which: "home" | "away") => {
    const lost = winner && winner !== which;
    return (
      <div className={`flex min-w-0 flex-1 flex-col gap-2 ${which === "away" ? "items-end text-right" : ""} ${lost ? "opacity-55" : ""}`}>
        <div className={`flex min-w-0 items-center gap-3 ${which === "away" ? "flex-row-reverse" : ""}`}>
          <TeamBadge brand={s.brand} size={big ? 76 : 56} />
          <div className="min-w-0">
            <p className={`truncate font-black leading-tight text-white ${big ? "text-xl" : "text-base"}`}>{s.brand.name}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">{s.brand.abbr} · {s.record}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${which === "away" ? "flex-row-reverse" : ""}`}>
          <div className={`rounded-xl bg-black/50 px-3 py-1.5 shadow-lg ring-1 ring-white/10 backdrop-blur ${which === "away" ? "text-right" : ""}`}>
            {status === "pre" && <p className="text-[10px] font-black uppercase tracking-[0.25em] text-fpts">Projected</p>}
            <p className={`font-mono font-black leading-none text-white ${big ? "text-4xl" : "text-3xl"}`}>
              <Fpts n={status === "pre" ? s.proj : s.score} iconClass="text-[0.75em]" />
            </p>
            {status === "live" && <p className="mt-1 font-mono text-xs font-bold text-white/85">proj <Fpts n={s.proj} /></p>}
          </div>
          {winner === which && <CrownIcon className="text-xl text-amber-300" title="Winner" />}
        </div>
      </div>
    );
  };
  return (
    <Wrap href={href} className={`group relative block overflow-hidden rounded-2xl shadow-xl transition hover:-translate-y-0.5 ${mine ? "ring-2 ring-white/70" : "ring-1 ring-white/10"}`}
      style={{ background: away.brand.color }}>
      {/* Both halves are clipped with the same polygon the divider line uses, so colour, logo and line always meet. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ clipPath: "polygon(0 0, 54.4% 0, 45.6% 100%, 0 100%)", background: home.brand.color }}>
        <div className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"><TeamBadge brand={home.brand} size={big ? 260 : 200} ghost /></div>
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ clipPath: "polygon(54.4% 0, 100% 0, 100% 100%, 45.6% 100%)", background: away.brand.color }}>
        <div className="absolute left-3/4 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"><TeamBadge brand={away.brand} size={big ? 260 : 200} ghost /></div>
      </div>
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="54.4" y1="0" x2="45.6" y2="100" stroke="#fff" strokeOpacity=".55" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative flex items-center gap-3 p-4 sm:p-5">
        {side(home, "home")}
        <div className="flex shrink-0 flex-col items-center gap-1 px-1">
          {status === "live" ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">● LIVE</span>
            : status === "final" ? <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-black text-white">FINAL</span>
            : <span className="text-lg font-black italic text-white/80">VS</span>}
          {mine && <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">You</span>}
        </div>
        {side(away, "away")}
      </div>
      {status !== "final" && (
        <div className="relative px-4 pb-3 sm:px-5">
          <div className="flex h-2 overflow-hidden rounded-full bg-black/30 ring-1 ring-black/30">
            <div className="border-r-2 border-white transition-all duration-700" style={{ width: `${hp}%`, background: home.brand.alt }} />
            <div className="flex-1" style={{ background: away.brand.alt }} />
          </div>
          <p className="mt-1 flex justify-between text-[10px] font-bold text-white/70"><span>{hp}%</span><span>Win probability</span><span>{100 - hp}%</span></p>
        </div>
      )}
    </Wrap>
  );
}
