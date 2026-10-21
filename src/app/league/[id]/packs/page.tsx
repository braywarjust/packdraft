import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getLeague, userTeam } from "@/lib/league";
import { unopenedPacks } from "@/lib/packs-server";
import { PACKS, RARITIES, RARITY_BLURB, RARITY_HEX, RARITY_ORDER, fmtOdds } from "@/lib/packs";
import { packFeatures } from "@/lib/slabs";
import { leaguePool, lootRules } from "@/lib/slab-cards";
import { slabPlayerPhoto } from "@/lib/nba/photos";
import { leagueBrand } from "@/lib/branding";
import { VendingMachine } from "@/app/packs/VendingMachine";
import { ShopHeroArt } from "@/app/packs/ShopHeroArt";
import { buyPack, ripPack } from "../../../actions";
import { Slab, SlabCover } from "@/components/Slab";
import { Coins } from "@/components/Coins";
import { OddsBar } from "@/components/OddsBar";
import { PackThumb } from "@/components/PackThumb";
import { TeamBadge } from "@/components/TeamBadge";

export const metadata = { title: "League Packs" };

/**
 * League Packs: this league's pack shop. Every slab in these packs is a player on one of the league's rosters (the
 * league pack pool), so ripping here means chasing slabs of your own guys and your rivals'.
 */
export default async function LeaguePacks({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  const me = userTeam(l.id, u.id);
  const b = leagueBrand(l);
  const pool = leaguePool(l.id);
  const inventory = me ? unopenedPacks(u.id, l.id) : [];
  const info = new Map(all<{ id: number; jersey: string | null; headshot: string | null; color: string | null; alt: string | null; team_name: string }>(
    `SELECT p.id, p.jersey, p.headshot, t.color, t.alt, t.name team_name FROM roster r JOIN players p ON p.id = r.player_id JOIN nba_teams t ON t.abbr = p.team
     WHERE r.league_id = ?`, l.id).map((r) => [r.id, r]));
  const top = pool.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Hero, in the league's colours */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl" style={{ background: `linear-gradient(115deg, ${b.color} 0%, ${b.color} 50%, ${b.alt} 140%)` }}>
        <ShopHeroArt />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)" }} />
        <div className="relative flex flex-wrap items-center gap-3 p-4 sm:gap-5 sm:p-7">
          <div className="hidden shrink-0 sm:block"><TeamBadge brand={b} size={64} className="drop-shadow-xl" /></div>
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">{b.abbr} · League Pack Shop</p>
            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">League Packs</h2>
            <p className="mt-2 hidden max-w-xl text-sm text-white/80 sm:block">
              Every slab is a player on a {l.name} roster. Pull your guys, or your rivals&apos;.
            </p>
          </div>
          <Link href={`/league/${l.id}/packs/pool`} className="btn-primary shrink-0 max-sm:px-3 max-sm:py-1.5 max-sm:text-sm">See the pack pool</Link>
        </div>
        <div className="relative grid grid-cols-3 gap-px bg-black/20">
          {([
            ["Your Pack Points", <Coins key="c" n={u.coins} live />],
            ["Unopened here", String(inventory.length)],
            ["Players in the pool", String(pool.length)],
          ] as [string, React.ReactNode][]).map(([k, v]) => (
            <div key={k} className="bg-black/25 px-4 py-3 backdrop-blur sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{k}</p>
              <p className="truncate font-mono text-base font-black text-white sm:text-xl">{v}</p>
            </div>
          ))}
        </div>
      </section>

      {!me ? (
        <div className="card p-6 text-center text-sm text-zinc-500">Join {l.name} to buy and open its League Packs.</div>
      ) : pool.length === 0 ? (
        <div className="card border-l-4 border-l-amber-400 p-5">
          <p className="font-bold">The pack pool is empty until the draft</p>
          <p className="text-sm text-zinc-500">The shop opens once the draft fills the rosters.</p>
        </div>
      ) : (
        <VendingMachine features={packFeatures(PACKS)} coins={u.coins} inventory={inventory}
          buy={buyPack.bind(null, l.id)} rip={ripPack.bind(null, l.id)} />
      )}

      {/* Pool preview */}
      {pool.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold">In the pack pool</h2>
              <p className="text-sm text-zinc-500">Every rostered player ({pool.length}). Updates with every roster move.</p>
            </div>
            <Link href={`/league/${l.id}/packs/pool`} className="btn-ghost">Browse the whole pool</Link>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-thin">
            {top.map((p) => {
              const x = info.get(p.id);
              return <Slab key={p.id} size={150} s={{ name: p.name, team: p.team, team_name: x?.team_name, pos: p.pos, rarity: "epic", jersey: x?.jersey, color: x?.color, alt: x?.alt, photo: slabPlayerPhoto(p.name) ?? x?.headshot }} />;
            })}
          </div>
        </section>
      )}

      {/* What each tier rolls */}
      <section id="rarity" className="scroll-mt-36 space-y-3">
        <div>
          <h2 className="text-lg font-bold">Rarity tiers and rolls</h2>
          <p className="text-sm text-zinc-500">
            Each slab rolls an orange <b className="text-orange-500">stat boost</b>, a blue <b className="text-fpts">multiplier</b>, or rarely both. Rarer tier, bigger rolls.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {RARITY_ORDER.map((r, i) => {
            const rules = lootRules(r);
            return (
              <div key={r} className="card relative h-full overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: RARITY_HEX[r], color: r === "grail" ? "#000" : "#fff" }}>
                  <span className="text-sm font-black uppercase tracking-wider">{RARITIES[r].label}</span>
                  <span className="text-[10px] font-bold opacity-80">Tier {i + 1}</span>
                </div>
                {/* Phones: small slab beside the rolls, so the five tiers don't take five screens. */}
                <div className="flex items-center gap-3 p-3 text-sm sm:flex-col sm:p-4">
                  <div className="shrink-0 sm:hidden"><SlabCover size={84} rarity={r} /></div>
                  <div className="hidden sm:block"><SlabCover size={130} rarity={r} /></div>
                  <div className="min-w-0 flex-1 space-y-2 sm:w-full">
                  <p className="text-xs text-zinc-500 max-sm:hidden sm:text-center">{RARITY_BLURB[r]}</p>
                  <dl className="w-full space-y-1 text-xs">
                    <div className="flex justify-between gap-2"><dt className="text-zinc-500">Stat boost {rules.boostPct}%</dt><dd className="text-right font-bold text-orange-500">{rules.boost}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-zinc-500">Multiplier {rules.multPct}%</dt><dd className="text-right font-bold text-fpts">{rules.multPct ? rules.mult : "Never"}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-zinc-500">Both</dt><dd className="text-right font-bold">{rules.bothPct ? `${rules.bothPct}%` : "Never"}</dd></div>
                  </dl>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Odds */}
      <section id="odds" className="scroll-mt-36 space-y-3">
        <div>
          <h2 className="text-lg font-bold">Odds per slab</h2>
          <p className="text-sm text-zinc-500">Chance per slab. Prices are set against a typical week (~1,800 Pack Points): GOAT ≈ one week.</p>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-xs text-zinc-500">
                <th className="px-4 py-3 text-left">Pack</th>
                {RARITY_ORDER.map((r) => (
                  <th key={r} className="px-2 py-3"><span className="inline-block rounded-full px-1.5 py-px text-[8.5px] font-black uppercase leading-tight" style={{ background: RARITY_HEX[r], color: r === "grail" ? "#000" : "#fff" }}>{RARITIES[r].label}</span></th>
                ))}
                <th className="px-4 py-3 text-right">Mix</th>
              </tr>
            </thead>
            <tbody>
              {PACKS.map((p) => (
                <tr key={p.id} className="border-t border-line/60">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-3">
                      <PackThumb id={p.id} height={44} showName={false} />
                      <span>
                        <span className="block font-bold">{p.name}</span>
                        <span className="flex items-center gap-2 text-xs text-zinc-500"><Coins n={p.price} /> · {p.cards} slab{p.cards > 1 ? "s" : ""}</span>
                      </span>
                    </span>
                  </td>
                  {RARITY_ORDER.map((r) => (
                    <td key={r} className="px-2 py-2 text-center font-mono">
                      {p.odds[r] ? <span className="font-bold" style={{ color: p.odds[r] >= 20 ? RARITY_HEX[r] : undefined }}>{fmtOdds(p.odds[r])}</span> : <span className="text-zinc-400">-</span>}
                    </td>
                  ))}
                  <td className="w-40 px-4 py-2"><OddsBar odds={p.odds} height={10} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* How it works */}
      <section id="scoring" className="scroll-mt-36 card space-y-4 p-5 text-sm">
        <h2 className="text-lg font-bold">How League Packs work</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["The pool", `Only players on ${l.name}'s rosters (${pool.length} right now). It follows the league by itself: adds, drops, trades, keepers and every new draft.`],
            ["Earning packs", "Win, lose, top score or title: you earn packs here."],
            ["Stat boosts", "Orange stamp. Added to his PTS, REB and AST when his game ends."],
            ["Multipliers", "Blue stamp. Multiplies his fantasy points for one game, boost included. Used up after."],
          ] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-ink/40 p-3">
              <p className="mb-1 text-xs font-black uppercase tracking-wider text-brand">{k}</p>
              <p className="text-zinc-600">{v}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
