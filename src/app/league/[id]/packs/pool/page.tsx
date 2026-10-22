import { QueryArea } from "@/components/NavShell";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getLeague, leagueTeams } from "@/lib/league";
import { RARITIES, RARITY_ORDER, type Rarity } from "@/lib/packs";
import { ensureSlabCards, leaguePool, lootRules } from "@/lib/slab-cards";
import { slabPlayerPhoto } from "@/lib/nba/photos";
import { teamBrand } from "@/lib/branding";
import { Slab } from "@/components/Slab";
import { TeamBadge } from "@/components/TeamBadge";
import { PlayerButton } from "@/components/PlayerInspector";

export const metadata = { title: "League Pack Pool" };

/**
 * The league pack pool: every player League Packs here can drop, which is everyone on a roster in this league, grouped
 * by fantasy team. It's read straight from the rosters, so it's always current.
 */
export default async function LeaguePackPool({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tier?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const me = await requireUser();
  ensureSlabCards();
  const l = getLeague(Number(id))!;
  const tier = (RARITY_ORDER.includes(sp.tier as Rarity) ? sp.tier : "rare") as Rarity;
  const rules = lootRules(tier);
  const pool = leaguePool(l.id);
  const info = new Map(all<{ id: number; jersey: string | null; headshot: string | null; color: string | null; alt: string | null; team_name: string }>(
    `SELECT p.id, p.jersey, p.headshot, t.color, t.alt, t.name team_name FROM roster r JOIN players p ON p.id = r.player_id JOIN nba_teams t ON t.abbr = p.team
     WHERE r.league_id = ?`, l.id).map((r) => [r.id, r]));
  const owned = new Map(all<{ player_id: number; n: number }>(
    "SELECT player_id, COUNT(*) n FROM cards WHERE user_id = ? AND sold = 0 AND kind = 'slab' GROUP BY player_id", me.id).map((r) => [r.player_id, r.n]));
  const teams = leagueTeams(l.id)
    .map((t) => ({ t, players: pool.filter((p) => p.team_id === t.id) }))
    .sort((a, b) => Number(b.t.user_id === me.id) - Number(a.t.user_id === me.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">League Packs</p>
          <h2 className="text-2xl font-black tracking-tight">Pack pool</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Every {l.name} rostered player ({pool.length}): the only slabs these packs drop. Updates with every roster move and draft.
          </p>
        </div>
        <Link href={`/league/${l.id}/packs`} className="btn-ghost">Back to League Packs</Link>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {RARITY_ORDER.map((r) => <Link key={r} href={`?tier=${r}`} className={`tab ${tier === r ? "tab-active" : ""} ${RARITIES[r].text}`}>{RARITIES[r].label}</Link>)}
        </div>
        <p className="text-xs text-zinc-500">
          Best {RARITIES[tier].label} roll shown. Boost {rules.boostPct}% (<b className="text-orange-500">{rules.boost}</b>){rules.multPct ? <> · Multiplier {rules.multPct}% (<b className="text-fpts">{rules.mult}</b>)</> : ""}{rules.bothPct ? <> · Both {rules.bothPct}%</> : ""}
        </p>
      </div>

      <QueryArea className="space-y-5">
      {pool.length === 0 && <p className="card p-6 text-center text-sm text-zinc-500">The pool is empty until the draft fills the rosters.</p>}

      {teams.filter((x) => x.players.length).map(({ t, players }) => {
        const brand = teamBrand(t);
        return (
          <section key={t.id} className="space-y-3">
            <h3 className="flex items-center gap-2 border-b border-line pb-2 font-black">
              <TeamBadge brand={brand} size={28} />
              <span className="truncate">{t.name}</span>
              {t.user_id === me.id && <span className="shrink-0 whitespace-nowrap rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand">Your team</span>}
              <span className="ml-auto shrink-0 whitespace-nowrap text-xs font-semibold text-zinc-500">{players.length} players</span>
            </h3>
            <div className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {players.map((p) => {
                const x = info.get(p.id);
                return (
                  <div key={p.id} className="flex flex-col items-center">
                    <Slab size={150} s={{ name: p.name, team: p.team, team_name: x?.team_name, pos: p.pos, rarity: tier, jersey: x?.jersey, color: x?.color, alt: x?.alt, photo: slabPlayerPhoto(p.name) ?? x?.headshot, ...rules.best }} />
                    <PlayerButton id={p.id} league={l.id} className="mt-2 text-xs font-semibold text-fpts">Player stats</PlayerButton>
                    <p className="text-xs text-zinc-500">{owned.get(p.id) ? <b className="text-emerald-600">You own {owned.get(p.id)}</b> : "Not collected"}</p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      </QueryArea>
    </div>
  );
}
