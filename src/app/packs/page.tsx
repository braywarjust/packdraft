import { requireUser } from "@/lib/auth";
import { unopenedPacks } from "@/lib/packs-server";
import Link from "next/link";
import { BUYBACK_RATE, GENERIC_MULT, GENERIC_ODDS, PACKS, PLAYER_MULT, RARITIES, RARITY_BLURB, RARITY_HEX, RARITY_ORDER, fmtMult, fmtOdds, type Rarity } from "@/lib/packs";
import { slabValue, starterPool } from "@/lib/slab-cards";
import { VendingMachine } from "./VendingMachine";
import { buyPack, ripPack, sellCards } from "../actions";
import { packFeatures } from "@/lib/slabs";
import { Coins, CoinIcon } from "@/components/Coins";
import { Logo } from "@/components/Logo";
import { OddsBar } from "@/components/OddsBar";
import { PackThumb } from "@/components/PackThumb";
import { NAV_ICONS, NavIcon } from "@/components/NavIcons";

export const metadata = { title: "Pack Shop" };

export default async function PacksPage() {
  const u = await requireUser();
  const inventory = unopenedPacks(u.id);
  const poolSize = starterPool().length;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl" style={{ background: "linear-gradient(115deg, #0253a4 0%, #0253a4 50%, #cc2b31 140%)" }}>
        <div className="pointer-events-none absolute -right-10 top-1/2 -translate-y-1/2 opacity-15"><Logo height={260} color="white" /></div>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)" }} />
        <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-8">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur"><NavIcon d={NAV_ICONS.packs} size={36} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">Mystery packs · player Slabs</p>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Pack Shop</h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Every pack holds Slabs: tarot cards of NBA starters with a fantasy points multiplier up to 10X. Put them on the players you drafted to boost their nights, or sell them back for {Math.round(BUYBACK_RATE * 100)}% of their value.
            </p>
          </div>
          <div className="flex gap-2">
            {PACKS.filter((p) => p.kind !== "case").slice(-3).map((p) => <PackThumb key={p.id} id={p.id} height={96} showName={false} />)}
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-px bg-black/20">
          {([
            ["Your Pack Points", <Coins key="c" n={u.coins} live />],
            ["Unopened packs", String(inventory.length)],
            ["Players in the pool", String(poolSize)],
          ] as [string, React.ReactNode][]).map(([k, v]) => (
            <div key={k} className="bg-black/25 px-5 py-3 backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{k}</p>
              <p className="font-mono text-xl font-black text-white">{v}</p>
            </div>
          ))}
        </div>
      </section>


      <VendingMachine features={packFeatures(PACKS)} coins={u.coins} inventory={inventory} buy={buyPack} rip={ripPack} sell={sellCards} />

      {/* Tiers */}
      <section id="rarity" className="scroll-mt-36 space-y-3">
        <div>
          <h2 className="text-lg font-bold">Multiplier tiers</h2>
          <p className="text-sm text-zinc-500">Every Slab has a fantasy points multiplier set by its tier. Player slabs boost only their own player; generic slabs boost anyone, but top out at 1.5X. <Link href="/packs/pool" className="text-brand underline">Browse the whole pool</Link>.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {RARITY_ORDER.map((r) => (
            <Link key={r} href={`/packs/pool?tier=${r}`} className="card relative h-full overflow-hidden transition hover:-translate-y-0.5 hover:brightness-110">
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: RARITY_HEX[r], color: r === "grail" ? "#000" : "#fff" }}>
                <span className="text-sm font-black uppercase tracking-wider">{RARITIES[r].label}</span>
                <span className="text-xl font-black">{fmtMult(PLAYER_MULT[r])}</span>
              </div>
              <div className="space-y-2 p-4 text-sm">
                <p className="text-zinc-500">{RARITY_BLURB[r]}</p>
                <div className="space-y-1 text-xs">
                  <p className="flex justify-between"><span className="text-zinc-500">Player slab</span><b>{fmtMult(PLAYER_MULT[r])}</b></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Generic slab</span><b>{GENERIC_MULT[r] ? fmtMult(GENERIC_MULT[r]!) : "-"}</b></p>
                  <p className="flex justify-between"><span className="text-zinc-500">Average starter worth</span><b><Coins n={slabValue("player", r, 34.5, false)} /></b></p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Odds */}
      <section id="odds" className="scroll-mt-36 space-y-3">
        <div>
          <h2 className="text-lg font-bold">Odds per slab</h2>
          <p className="text-sm text-zinc-500">First a slab is either generic or a player slab, then it lands in a tier (generics use {Object.entries(GENERIC_ODDS).map(([r, v]) => `${v}% ${RARITIES[r as Rarity].label}`).join(", ")}). Any slab can come Immortal. Every pack is built to return roughly 90% of its price in slab value on average.</p>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-xs text-zinc-500">
                <th className="px-4 py-3 text-left">Pack</th>
                <th className="px-2 py-3">Generic</th>
                {RARITY_ORDER.map((r) => (
                  <th key={r} className="px-2 py-3"><span className="inline-block rounded-full px-1.5 py-px text-[8.5px] font-black uppercase leading-tight" style={{ background: RARITY_HEX[r], color: r === "grail" ? "#000" : "#fff" }}>{fmtMult(PLAYER_MULT[r])}</span></th>
                ))}
                <th className="px-2 py-3">Immortal</th>
                <th className="px-4 py-3 text-right">Player slab mix</th>
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
                  <td className="px-2 py-2 text-center font-mono">{p.generic ? `${p.generic}%` : <span className="text-zinc-400">-</span>}</td>
                  {RARITY_ORDER.map((r) => (
                    <td key={r} className="px-2 py-2 text-center font-mono">
                      {p.odds[r] ? <span className="font-bold" style={{ color: p.odds[r] >= 20 ? RARITY_HEX[r] : undefined }}>{fmtOdds(p.odds[r])}</span> : <span className="text-zinc-400">-</span>}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center font-mono">{fmtOdds(p.immortal)}</td>
                  <td className="w-40 px-4 py-2"><OddsBar odds={p.odds} height={10} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">Tier columns are the odds for player slabs. The bigger the multiplier, the more it leans toward role players: a 10X lands on one of the league&apos;s ten best players only about 1.5% of the time.</p>
      </section>

      {/* How it works */}
      <section id="scoring" className="scroll-mt-36 card space-y-4 p-5 text-sm">
        <h2 className="text-lg font-bold">How Slabs work</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["The pool", "Player slabs are of NBA starters only: the five highest-projected players on every team. Each one shows his photo, team logo and team colours."],
            ["Boosting", "Each night, every player on your fantasy team with a game can carry one slab. His fantasy points for that game, and the Pack Points they pay, are multiplied. It locks at tip-off and only counts if he starts."],
            ["Collect your team", "A player slab only boosts that player, so you want slabs of the guys you drafted. Generic slabs fill the gaps on anyone, at 1.1X to 1.5X."],
            ["Immortal", "A rare stamp on any slab: it glows, gets vibrant colours and is worth five times as much. The multiplier stays the same."],
          ] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-ink/40 p-3">
              <p className="mb-1 text-xs font-black uppercase tracking-wider text-brand">{k}</p>
              <p className="text-zinc-600">{v}</p>
            </div>
          ))}
        </div>
        <p className="flex items-start gap-1.5 text-xs text-zinc-400">
          <CoinIcon className="mt-0.5" />
          A slab&apos;s value is set by its tier and how good the player is, times five for Immortal. Sell any slab back for {Math.round(BUYBACK_RATE * 100)}% of it.
        </p>
      </section>
    </div>
  );
}
