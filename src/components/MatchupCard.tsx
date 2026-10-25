import { CrownIcon } from "./Icons";
import Link from "next/link";
import { TeamBadge, LMBadge, type BrandLite } from "./TeamBadge";
import { Fpts } from "@/components/Fpts";
import { Headshot } from "./Headshot";

export type TopPlayer = { id: number; name: string; headshot: string | null; pts: number };
/** `top`: the side's best scorers this week (ESPN scoreboard's "Top Performers"), shown once the week has points. */
/** lm: this team belongs to the League Manager (shows the LM tag). */
export type MatchSide = { id: number; brand: BrandLite; record: string; score: number; proj: number; top?: TopPlayer[]; lm?: boolean };

/** A team's three best scorers so far this matchup. */
export function topPerformers(players: { id: number; name: string; headshot: string | null; pts: number }[]): TopPlayer[] {
  return players.filter((p) => p.pts > 0).sort((a, b) => b.pts - a.pts).slice(0, 3).map(({ id, name, headshot, pts }) => ({ id, name, headshot, pts }));
}

function Performers({ s, align }: { s: MatchSide; align: "home" | "away" }) {
  if (!s.top?.length) return <div className="flex-1" />;
  return (
    <div className={`flex min-w-0 flex-1 gap-1.5 sm:gap-2 ${align === "away" ? "flex-row-reverse" : ""}`}>
      {s.top.map((p, i) => (
        <div key={p.id} title={`${p.name}: ${Math.round(p.pts * 10) / 10} fantasy points this week (top performer)`} className={`flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg bg-black/35 py-1 pl-1 pr-2 ring-1 ring-white/10 ${align === "away" ? "flex-row-reverse pl-2 pr-1 text-right" : ""} ${i === 2 ? "max-sm:hidden" : ""}`}>
          <Headshot src={p.headshot} name={p.name} size={26} />
          <span className="min-w-0 leading-tight">
            <span className="block max-w-[5.5rem] truncate text-[11px] font-bold text-white max-sm:hidden">{p.name.split(" ").slice(1).join(" ") || p.name}</span>
            <span className="block font-mono text-[10px] font-bold text-white/80">{Math.round(p.pts)}<span className="max-sm:hidden"> pts</span></span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Links when given an href (cards in lists); a plain block on the matchup page itself. */
function Wrap({ href, className, style, children }: { href?: string; className: string; style: React.CSSProperties; children: React.ReactNode }) {
  return href ? <Link href={href} className={className} style={style}>{children}</Link> : <div className={className} style={style}>{children}</div>;
}

/** A head-to-head card split in the two teams' colours, logos facing off, scores big. */
/** `playing`: a game in this matchup is under way right now. The week can be live (scores shown) between game nights; the LIVE badge only shows while someone's playing. */
export function MatchupCard({ href, home, away, status, winProb, mine, big = false, playing = true }: {
  href?: string; home: MatchSide; away: MatchSide; status: "pre" | "live" | "final"; winProb: number; mine?: boolean; big?: boolean; playing?: boolean;
}) {
  const hp = Math.round(winProb * 100);
  const winner = status === "final" ? (home.score > away.score ? "home" : away.score > home.score ? "away" : null) : null;
  const side = (s: MatchSide, which: "home" | "away") => {
    const lost = winner && winner !== which;
    return (
      <div className={`flex min-w-0 flex-1 flex-col gap-2 ${which === "away" ? "items-end text-right" : ""} ${lost ? "opacity-55" : ""}`}>
        {/* Phones: the badge sits above the name so both team names get the full half. */}
        <div className={`flex min-w-0 max-w-full flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 ${which === "away" ? "items-end sm:flex-row-reverse" : "items-start"}`}>
          <TeamBadge brand={s.brand} size={big ? 76 : 56} className="max-sm:!h-11 max-sm:!w-11" />
          <div className="min-w-0 max-w-full">
            <p className={`line-clamp-2 font-black leading-tight text-white sm:truncate ${big ? "text-sm sm:text-xl" : "text-sm sm:text-base"}`}>{s.brand.name}</p>
            <p className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/60 ${which === "away" ? "justify-end" : ""}`}>{s.lm && <LMBadge />}{s.brand.abbr} · {s.record}</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${which === "away" ? "flex-row-reverse" : ""}`}>
          <div className={`rounded-xl bg-black/50 px-2 py-1 shadow-lg sm:px-3 sm:py-1.5 ring-1 ring-white/10 backdrop-blur ${which === "away" ? "text-right" : ""}`}>
            {status === "pre" && <p className="text-[9px] font-black uppercase tracking-[0.2em] text-fpts sm:text-[10px] sm:tracking-[0.25em]">Projected</p>}
            <p className={`font-mono font-black leading-none text-white ${big ? "text-2xl sm:text-4xl" : "text-xl sm:text-3xl"}`}>
              <Fpts n={status === "pre" ? s.proj : s.score} iconClass="text-[0.75em]" live={status === "live"} />
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
      <div className="relative flex items-center gap-2 p-3 sm:gap-3 sm:p-5">
        {side(home, "home")}
        <div className="flex shrink-0 flex-col items-center gap-1 px-1">
          {status === "live" && playing ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white">● LIVE</span>
            : status === "final" ? <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-black text-white">FINAL</span>
            : <span className="text-lg font-black italic text-white/80">VS</span>}
          {mine && <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">You</span>}
        </div>
        {side(away, "away")}
      </div>
      {status !== "pre" && (home.top?.length || away.top?.length) ? (
        <div className="relative flex items-center gap-3 px-3 pb-3 sm:px-5">
          <Performers s={home} align="home" />
          <Performers s={away} align="away" />
        </div>
      ) : null}
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

/**
 * Slim matchup strip for the home page: both teams' badges, names and scores on one split-colour bar, with a thin
 * win probability line along the bottom.
 */
export function MatchupStrip({ href, home, away, status, winProb, playing = true }: {
  href?: string; home: MatchSide; away: MatchSide; status: "pre" | "live" | "final"; winProb: number; playing?: boolean;
}) {
  const hp = Math.round(winProb * 100);
  const val = (s: MatchSide) => (status === "pre" ? s.proj : s.score);
  const winner = status === "final" ? (home.score > away.score ? "home" : away.score > home.score ? "away" : null) : null;
  // Name on top, score under it, so each team name gets its whole half even on a phone.
  const side = (s: MatchSide, which: "home" | "away") => (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${which === "away" ? "flex-row-reverse text-right" : ""} ${winner && winner !== which ? "opacity-55" : ""}`}>
      <TeamBadge brand={s.brand} size={36} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[12px] font-black leading-[1.15] text-white sm:text-[13px]">{s.brand.name}</p>
        <p className={`mt-0.5 flex items-baseline gap-1.5 ${which === "away" ? "flex-row-reverse" : ""}`}>
          <span className="font-mono text-lg font-black leading-none text-white">{Math.round(val(s) * 10) / 10}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/60">{status === "pre" ? "proj" : s.record}</span>
          {s.lm && <LMBadge />}
        </p>
      </div>
    </div>
  );
  return (
    <Wrap href={href} className="relative block overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10 transition hover:-translate-y-0.5"
      style={{ background: `linear-gradient(100deg, ${home.brand.color} 0%, ${home.brand.color} 46%, ${away.brand.color} 54%, ${away.brand.color} 100%)` }}>
      <div className="relative flex items-center gap-2 px-2.5 py-2">
        {side(home, "home")}
        <span className="shrink-0 text-center">
          {status === "live" && playing ? <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white">LIVE</span>
            : status === "final" ? <span className="rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-black text-white">FINAL</span>
            : <span className="text-sm font-black italic text-white/80">VS</span>}
        </span>
        {side(away, "away")}
      </div>
      {status !== "final" && (
        <div className="flex h-1" title={`Win probability ${hp}% – ${100 - hp}%`}>
          <div style={{ width: `${hp}%`, background: home.brand.alt }} className="border-r border-white" />
          <div className="flex-1" style={{ background: away.brand.alt }} />
        </div>
      )}
    </Wrap>
  );
}
