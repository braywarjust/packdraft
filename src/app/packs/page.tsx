import { requireUser } from "@/lib/auth";
import { unopenedPacks } from "@/lib/packs-server";
import { BUYBACK_RATE, PACKS, RARITIES, RARITY_BLURB, RARITY_HEX, RARITY_ORDER } from "@/lib/packs";
import { VendingMachine } from "./VendingMachine";
import { buyPack, ripPack, sellCards } from "../actions";
import { catalogStats, ensureCatalog, packFeatures } from "@/lib/slabs";
import { marketConfigured } from "@/lib/market";
import { Coins, CoinIcon } from "@/components/Coins";
import { Logo } from "@/components/Logo";
import { OddsBar } from "@/components/OddsBar";
import { PackThumb } from "@/components/PackThumb";
import { SlabIcon } from "@/components/SlabIcon";
import { NAV_ICONS, NavIcon } from "@/components/NavIcons";

export const metadata = { title: "Pack Shop" };

export default async function PacksPage() {
  const u = await requireUser();
  const inventory = unopenedPacks(u.id);
  ensureCatalog();
  const stats = new Map(catalogStats().map((r) => [r.rarity, r]));
  const vaultTotal = [...stats.values()].reduce((s, r) => s + r.n, 0) || 1;
  const market = marketConfigured();

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl" style={{ background: "linear-gradient(115deg, #0253a4 0%, #0253a4 50%, #cc2b31 140%)" }}>
        <div className="pointer-events-none absolute -right-10 top-1/2 -translate-y-1/2 opacity-15"><Logo height={260} color="white" /></div>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)" }} />
        <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-8">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur"><NavIcon d={NAV_ICONS.packs} size={36} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">Mystery packs · real graded slabs</p>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Pack Shop</h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Every pack holds real graded slabs from the vault. Rip it, keep what you love, or sell it straight back for {Math.round(BUYBACK_RATE * 100)}% of its market value.
            </p>
          </div>
          <div className="flex gap-2">
            {PACKS.filter((p) => p.kind !== "case").slice(-3).map((p) => <PackThumb key={p.id} id={p.id} height={96} showName={false} />)}
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-px bg-black/20">
          {([
            ["Your Pack Points", u.is_tester ? "Unlimited" : <Coins key="c" n={u.coins} />],
            ["Unopened packs", String(inventory.length)],
            ["Slabs in the vault", vaultTotal.toLocaleString()],
          ] as [string, React.ReactNode][]).map(([k, v]) => (
            <div key={k} className="bg-black/25 px-5 py-3 backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{k}</p>
              <p className="font-mono text-xl font-black text-white">{v}</p>
            </div>
          ))}
        </div>
      </section>


      <VendingMachine features={packFeatures(PACKS)} coins={u.is_tester ? 1_000_000_000 : u.coins} tester={!!u.is_tester} inventory={inventory} buy={buyPack} rip={ripPack} sell={sellCards} />

      {/* Rarity tiers */}
      <section id="rarity" className="scroll-mt-36 space-y-3">
        <div>
          <h2 className="text-lg font-bold">Rarity tiers</h2>
          <p className="text-sm text-zinc-500">Every slab in the vault sits in one of five tiers, from the most common to the rarest.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {RARITY_ORDER.map((r, i) => {
            const st = stats.get(r);
            const share = st ? (st.n / vaultTotal) * 100 : 0;
            return (
              <div key={r} className="card relative overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5" style={{ background: RARITY_HEX[r], color: r === "grail" ? "#000" : "#fff" }}>
                  <span className="text-sm font-black uppercase tracking-wider">{RARITIES[r].label}</span>
                  <span className="text-[10px] font-bold opacity-80">Tier {i + 1}</span>
                </div>
                <div className="space-y-2 p-4 text-sm">
                  <p className="text-zinc-500">{RARITY_BLURB[r]}</p>
                  <div className="space-y-1 text-xs">
                    <p className="flex justify-between"><span className="text-zinc-500">Share of vault</span><b>{share < 2 ? share.toFixed(1) : Math.round(share)}%</b></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Slabs</span><b className="inline-flex items-center gap-1"><SlabIcon />{(st?.n ?? 0).toLocaleString()}</b></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Typical value</span><b>{st ? <Coins n={Math.round(st.avg)} /> : "-"}</b></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Range</span><span>{st ? <><Coins n={st.lo} />–<Coins n={st.hi} /></> : "-"}</span></p>
                    <p className="flex justify-between"><span className="text-zinc-500">Pulled so far</span><b>{st?.owned ?? 0}</b></p>
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
          <p className="text-sm text-zinc-500">The chance each slab you pull lands in each tier. Every pack is built to return about 92% of its price in slab value on average, so the fun is in the swings.</p>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-xs text-zinc-500">
                <th className="px-4 py-3 text-left">Pack</th>
                {RARITY_ORDER.map((r) => (
                  <th key={r} className="px-2 py-3"><span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase" style={{ background: RARITY_HEX[r], color: r === "grail" ? "#000" : "#fff" }}>{RARITIES[r].label}</span></th>
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
                      {p.odds[r] ? <span className="font-bold" style={{ color: p.odds[r] >= 20 ? RARITY_HEX[r] : undefined }}>{p.odds[r]}%</span> : <span className="text-zinc-400">-</span>}
                    </td>
                  ))}
                  <td className="w-40 px-4 py-2"><OddsBar odds={p.odds} height={10} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Scoring */}
      <section id="scoring" className="scroll-mt-36 card space-y-4 p-5 text-sm">
        <div>
          <h2 className="text-lg font-bold">How a slab&apos;s tier is set</h2>
          <p className="text-zinc-500">Each slab gets a score from what collectors pay up for. The whole vault is ranked by score: bottom 55% are Common, then 27% Rare, 12% Epic, 4.5% Mythic and the top 1.5% Immortal. The Ultra Heavy Hitters, record auction sales worth hundreds of thousands to millions, are always Immortal and only drop on a tiny extra roll when you hit Immortal.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {([
            ["Grade", "Black Label / Pristine 10 +45, PSA 10 +25, other 10s +20, 9.5 +17, 9 +11, 8–8.5 +6"],
            ["Player", "GOAT (Jordan, LeBron, Kobe) +32, legend +18, current star +12, active player +4"],
            ["Hits", "Autograph +20, memorabilia +13 (Logoman +28), auto + patch combo +8"],
            ["Card type", "Iconic 90s/modern insert +18, premium set +12, numbered / short print +8, rookie +8, parallel +4"],
            ["Era", "Pre-1990 +12, 1990s +5, 2000s +3"],
          ] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-ink/40 p-3">
              <p className="mb-1 text-xs font-black uppercase tracking-wider text-brand">{k}</p>
              <p className="text-zinc-600">{v}</p>
            </div>
          ))}
        </div>
        <p className="flex items-start gap-1.5 text-xs text-zinc-400">
          <CoinIcon className="mt-0.5" />
          {market.ebay
            ? "Values come from live eBay listings for the exact cert, or the same card in the same grade. Heavy Hitters use Courtyard's fair market value. Values marked * are estimates."
            : "Heavy Hitters use Courtyard's fair market value; other values marked * are estimates from the rarity score until eBay keys are added."}
        </p>
      </section>
    </div>
  );
}
