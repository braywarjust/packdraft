import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { GENERIC_MULT, PLAYER_MULT, RARITIES, RARITY_ORDER, fmtMult, type Rarity } from "@/lib/packs";
import { ensureSlabCards, slabValue, starterPool } from "@/lib/slab-cards";
import { slabPlayerPhoto } from "@/lib/nba/photos";
import { PageHeader } from "@/components/PageHeader";
import { SlabFace, SlabMult } from "@/components/SlabFace";
import { Coins } from "@/components/Coins";

export const metadata = { title: "Slab Pool" };

/** Every Slab you could pull: the starters of all 30 NBA teams, plus the generic slabs. Your own players come first. */
export default async function SlabPool({ searchParams }: { searchParams: Promise<{ tier?: string; team?: string; imm?: string; mine?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser();
  ensureSlabCards();
  const tier = (RARITY_ORDER.includes(sp.tier as Rarity) ? sp.tier : "common") as Rarity;
  const immortal = sp.imm === "1";
  const info = new Map(all<{ id: number; jersey: string | null; headshot: string | null; color: string | null; alt: string | null; team_name: string }>(
    "SELECT p.id, p.jersey, p.headshot, t.color, t.alt, t.name team_name FROM players p JOIN nba_teams t ON t.abbr = p.team").map((r) => [r.id, r]));
  const rostered = new Set(all<{ player_id: number }>(
    "SELECT r.player_id FROM roster r JOIN teams t ON t.id = r.team_id JOIN leagues l ON l.id = r.league_id WHERE t.user_id = ? AND l.champion_team_id IS NULL", me.id).map((r) => r.player_id));
  const owned = new Map(all<{ player_id: number; n: number }>(
    "SELECT player_id, COUNT(*) n FROM cards WHERE user_id = ? AND sold = 0 AND kind = 'player' GROUP BY player_id", me.id).map((r) => [r.player_id, r.n]));
  const teams = [...new Set(starterPool().map((p) => p.team))];
  let pool = starterPool();
  if (sp.team) pool = pool.filter((p) => p.team === sp.team);
  if (sp.mine === "1") pool = pool.filter((p) => rostered.has(p.id));
  pool.sort((a, b) => Number(rostered.has(b.id)) - Number(rostered.has(a.id)) || a.team.localeCompare(b.team) || b.proj - a.proj);

  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tier: sp.tier, team: sp.team, imm: sp.imm, mine: sp.mine, ...o })) if (v) p.set(k, v);
    return `?${p}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader icon="packs" eyebrow="Pack Shop" title="Slab pool"
        description={<>Every Slab you can pull: the five starters on each NBA team ({starterPool().length} players), plus generic slabs that boost anyone. Your rostered players are marked and listed first.</>}>
        <Link href="/packs" className="btn-ghost">Back to packs</Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {RARITY_ORDER.map((r) => (
          <Link key={r} href={qs({ tier: r })} className={`tab ${tier === r ? "tab-active" : ""} ${RARITIES[r].text}`}>{fmtMult(PLAYER_MULT[r])} {RARITIES[r].label}</Link>
        ))}
        <span className="mx-2 h-5 w-px bg-line" />
        <Link href={qs({ imm: immortal ? undefined : "1" })} className={`tab ${immortal ? "tab-active" : ""}`}>Immortal</Link>
        <Link href={qs({ mine: sp.mine === "1" ? undefined : "1" })} className={`tab ${sp.mine === "1" ? "tab-active" : ""}`}>My players</Link>
        <form className="ml-auto">
          {sp.tier && <input type="hidden" name="tier" value={sp.tier} />}
          {sp.imm && <input type="hidden" name="imm" value={sp.imm} />}
          <select name="team" defaultValue={sp.team ?? ""} className="input w-40 py-1.5 text-sm">
            <option value="">All teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn-ghost ml-2 px-3 py-1.5 text-sm">Go</button>
        </form>
      </div>

      {!sp.team && sp.mine !== "1" && GENERIC_MULT[tier] && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Generic</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col items-center">
              <SlabFace height={230} s={{ kind: "generic", name: "Any Player", team: "", pos: "", rarity: tier, mult: GENERIC_MULT[tier]!, immortal, serial: 1 }} />
              <SlabMult mult={GENERIC_MULT[tier]!} size={14} className="mt-2" />
              <p className="mt-1 text-xs font-semibold">Works on anyone</p>
              <p className="font-mono text-xs font-bold text-emerald-600"><Coins n={slabValue("generic", tier, 0, immortal)} /></p>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Player slabs</h2>
        <div className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {pool.map((p) => {
            const x = info.get(p.id);
            return (
              <div key={p.id} className="flex flex-col items-center">
                <div className="relative">
                  <SlabFace height={230} s={{
                    kind: "player", name: p.name, team: p.team, team_name: x?.team_name, pos: p.pos, rarity: tier, mult: PLAYER_MULT[tier], immortal, serial: 1,
                    jersey: x?.jersey, color: x?.color, alt: x?.alt, photo: slabPlayerPhoto(p.name) ?? x?.headshot,
                  }} />
                  {rostered.has(p.id) && <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 px-1.5 text-[9px] font-black text-black">ON YOUR TEAM</span>}
                </div>
                <SlabMult mult={PLAYER_MULT[tier]} size={14} className="mt-2" />
                <p className="mt-1 text-xs text-zinc-500">{owned.get(p.id) ? <b className="text-emerald-600">You own {owned.get(p.id)}</b> : "Not collected"}</p>
                <p className="font-mono text-xs font-bold text-emerald-600"><Coins n={slabValue("player", tier, p.proj, immortal)} /></p>
              </div>
            );
          })}
        </div>
        {pool.length === 0 && <p className="card p-6 text-center text-sm text-zinc-500">Nobody here yet.</p>}
      </section>
    </div>
  );
}
