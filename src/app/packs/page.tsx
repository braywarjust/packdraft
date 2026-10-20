import { requireUser } from "@/lib/auth";
import { unopenedPacks } from "@/lib/packs-server";
import { PACKS, RARITIES, RARITY_BLURB, RARITY_HEX, RARITY_ORDER, fmtOdds } from "@/lib/packs";
import { VendingMachine } from "./VendingMachine";
import { buyPack, ripPack } from "../actions";
import { packFeatures } from "@/lib/slabs";
import Link from "next/link";
import { MULT_RANGE, slabPool } from "@/lib/slab-cards";
import { SlabCover } from "@/components/Slab";
import { Coins } from "@/components/Coins";
import { Logo } from "@/components/Logo";
import { OddsBar } from "@/components/OddsBar";
import { PackThumb } from "@/components/PackThumb";
import { NAV_ICONS, NavIcon } from "@/components/NavIcons";

export const metadata = { title: "Pack Shop" };

export default async function PacksPage() {
  const u = await requireUser();
  const inventory = unopenedPacks(u.id);
  const poolSize = slabPool().length;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl" style={{ background: "linear-gradient(115deg, #0253a4 0%, #0253a4 50%, #cc2b31 140%)" }}>
        <div className="pointer-events-none absolute -right-10 top-1/2 -translate-y-1/2 opacity-15"><Logo height={260} color="white" /></div>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)" }} />
        <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-8">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur"><NavIcon d={NAV_ICONS.packs} size={36} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">Mystery packs · NBA Slabs</p>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Pack Shop</h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Every pack holds Slabs: animated cards of active NBA players, from Common to Immortal. Rip it, collect your favourites, and trade five up for a rarer one.
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


      <VendingMachine features={packFeatures(PACKS)} coins={u.coins} inventory={inventory} buy={buyPack} rip={ripPack} />

      {/* Rarity tiers */}
      <section id="rarity" className="scroll-mt-36 space-y-3">
        <div>
          <h2 className="text-lg font-bold">Rarity tiers</h2>
          <p className="text-sm text-zinc-500">Every Slab is one active NBA player at one of five tiers. The rarer the tier, the more it moves. <Link href="/packs/pool" className="text-brand underline">Browse every player in the pool</Link>.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {RARITY_ORDER.map((r, i) => (
            <Link key={r} href={`/packs/pool?tier=${r}`} className="card relative h-full overflow-hidden transition hover:-translate-y-0.5 hover:brightness-110">
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: RARITY_HEX[r], color: r === "grail" ? "#000" : "#fff" }}>
                <span className="text-sm font-black uppercase tracking-wider">{RARITIES[r].label}</span>
                <span className="text-[10px] font-bold opacity-80">Tier {i + 1}</span>
              </div>
              <div className="flex flex-col items-center gap-3 p-4 text-sm">
                <SlabCover size={150} rarity={r} />
                <p className="text-center text-zinc-500">{RARITY_BLURB[r]}</p>
                <p className="flex w-full justify-between text-xs"><span className="text-zinc-500">Multiplier stamp</span><b className="text-fpts">{MULT_RANGE[r][0].toFixed(2)}x–{MULT_RANGE[r][1].toFixed(2)}x</b></p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Odds */}
      <section id="odds" className="scroll-mt-36 space-y-3">
        <div>
          <h2 className="text-lg font-bold">Odds per slab</h2>
          <p className="text-sm text-zinc-500">The chance each slab you pull lands in each tier. Every pack is built to return roughly 90% of its price in slab value on average, so the fun is in the swings.</p>
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
        <h2 className="text-lg font-bold">How Slabs work</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["The pool", `Every active NBA player (${poolSize} of them), with his photo, team logo and team colours. Better players come up a little more often.`],
            ["Tiers", "Common, Rare, Epic, Mythic and Immortal. Each step up adds motion: a turning sunburst and shimmer, twinkling stars, a fuller star field, and an icy-blue frame and frost sheen for Immortal."],
            ["Value", "Tier price × the player's price index: his ESPN fantasy points per game (last season, then this season as he plays) plus popularity. Prices move with his stats; injured players hold steady."],
            ["Equip and collect", "Every slab has a multiplier stamp from 1.10x to 2.00x (a 2.00x Immortal is the rarest, rarest of all on a star). If the player is on your fantasy team, equip his slab on one of his games for that many times his fantasy points; it's used up when the game ends. Slabs can't be sold back, but five of a rarity trade up for a rarer one."],
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
