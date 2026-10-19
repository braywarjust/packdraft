import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { RARITIES, RARITY_ORDER, type Rarity } from "@/lib/packs";
import { MULT_RANGE, ensureSlabCards, slabPool } from "@/lib/slab-cards";
import { slabPrice } from "@/lib/slab-market";
import { slabPlayerPhoto } from "@/lib/nba/photos";
import { PageHeader } from "@/components/PageHeader";
import { Slab, SlabCover } from "@/components/Slab";
import { Coins } from "@/components/Coins";
import { PlayerButton } from "@/components/PlayerInspector";

export const metadata = { title: "Slab Pool" };

/** Every Slab you could pull: every active NBA player, shown at any tier. Your own collection is marked. */
export default async function SlabPool({ searchParams }: { searchParams: Promise<{ tier?: string; team?: string; mine?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser();
  ensureSlabCards();
  const tier = (RARITY_ORDER.includes(sp.tier as Rarity) ? sp.tier : "common") as Rarity;
  const info = new Map(all<{ id: number; jersey: string | null; headshot: string | null; color: string | null; alt: string | null; team_name: string }>(
    "SELECT p.id, p.jersey, p.headshot, t.color, t.alt, t.name team_name FROM players p JOIN nba_teams t ON t.abbr = p.team").map((r) => [r.id, r]));
  const owned = new Map(all<{ player_id: number; n: number }>(
    "SELECT player_id, COUNT(*) n FROM cards WHERE user_id = ? AND sold = 0 AND kind = 'slab' GROUP BY player_id", me.id).map((r) => [r.player_id, r.n]));
  const rostered = new Set(all<{ player_id: number }>(
    "SELECT r.player_id FROM roster r JOIN teams t ON t.id = r.team_id JOIN leagues l ON l.id = r.league_id WHERE t.user_id = ? AND l.champion_team_id IS NULL", me.id).map((r) => r.player_id));
  const all_ = slabPool();
  const teams = [...new Set(all_.map((p) => p.team))].sort();
  const team = sp.team && teams.includes(sp.team) ? sp.team : sp.mine ? "" : teams[0];
  let pool = sp.mine ? all_.filter((p) => rostered.has(p.id)) : all_.filter((p) => p.team === team);
  pool = [...pool].sort((a, b) => b.proj - a.proj);
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tier: sp.tier, team: sp.team, mine: sp.mine, ...o })) if (v) p.set(k, v);
    return `?${p}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader icon="packs" eyebrow="Pack Shop" title="Slab pool"
        description={<>Every active NBA player can come out of a pack ({all_.length} players). Pick a tier to see how each one looks at it. Each slab rolls its own multiplier stamp: {RARITIES[tier].label} rolls {MULT_RANGE[tier][0].toFixed(2)}x to {MULT_RANGE[tier][1].toFixed(2)}x (shown at its best here), leaning low, and lower on stars.</>}>
        <Link href="/packs" className="btn-ghost">Back to packs</Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {RARITY_ORDER.map((r) => <Link key={r} href={qs({ tier: r })} className={`tab ${tier === r ? "tab-active" : ""} ${RARITIES[r].text}`}>{RARITIES[r].label}</Link>)}
        <span className="mx-2 h-5 w-px bg-line" />
        <Link href={qs({ mine: sp.mine ? undefined : "1", team: undefined })} className={`tab ${sp.mine ? "tab-active" : ""}`}>My fantasy players</Link>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {teams.map((t) => <Link key={t} href={qs({ team: t, mine: undefined })} className={`tab px-2 py-1 text-xs ${!sp.mine && t === team ? "tab-active" : ""}`}>{t}</Link>)}
      </div>

      <div className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        <div className="flex flex-col items-center">
          <SlabCover size={176} rarity={tier} />
          <p className="mt-2 text-xs font-semibold">Back</p>
        </div>
        {pool.map((p) => {
          const x = info.get(p.id);
          return (
            <div key={p.id} className="flex flex-col items-center">
              <Slab size={176} s={{ name: p.name, team: p.team, team_name: x?.team_name, pos: p.pos, rarity: tier, jersey: x?.jersey, color: x?.color, alt: x?.alt, photo: slabPlayerPhoto(p.name) ?? x?.headshot, mult: MULT_RANGE[tier][1] }} />
              <PlayerButton id={p.id} className="mt-2 text-xs font-semibold text-fpts">Price &amp; stats</PlayerButton>
              <p className="text-xs text-zinc-500">{owned.get(p.id) ? <b className="text-emerald-600">You own {owned.get(p.id)}</b> : rostered.has(p.id) ? "On your fantasy team" : "Not collected"}</p>
              <p className="font-mono text-xs font-bold text-emerald-600"><Coins n={slabPrice(tier, p.idx)} /></p>
            </div>
          );
        })}
      </div>
      {pool.length === 0 && <p className="card p-6 text-center text-sm text-zinc-500">Nobody here yet.</p>}
    </div>
  );
}
