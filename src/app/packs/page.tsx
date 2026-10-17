import { requireUser } from "@/lib/auth";
import { unopenedPacks } from "@/lib/packs-server";
import { PACKS, RARITIES } from "@/lib/packs";
import { VendingMachine } from "./VendingMachine";
import { buyPack, ripPack, sellCards } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { catalogStats, ensureCatalog, packFeatures } from "@/lib/slabs";
import { marketConfigured } from "@/lib/market";
import { Coins } from "@/components/Coins";

export default async function PacksPage() {
  const u = await requireUser();
  const inventory = unopenedPacks(u.id);
  ensureCatalog();
  const stats = new Map(catalogStats().map((r) => [r.rarity, r]));
  const market = marketConfigured();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Mystery packs" title="Pack Shop"
        description={<>Buy a pack or a Mega Case, rip it open and collect real graded slabs. Don&apos;t love a pull? Instant buyback at 90% of its value.</>} />
      <VendingMachine features={packFeatures(PACKS)} coins={u.is_tester ? 1_000_000_000 : u.coins} tester={!!u.is_tester} inventory={inventory} buy={buyPack} rip={ripPack} sell={sellCards} />
      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Pack odds</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs text-zinc-500"><tr><th className="text-left">Pack</th><th>Price</th><th>Slabs</th>{Object.values(RARITIES).map((r) => <th key={r.label} className={r.text}>{r.label}</th>)}</tr></thead>
            <tbody>
              {PACKS.map((p) => (
                <tr key={p.id} className="border-t border-line/60 text-center">
                  <td className="py-1.5 text-left font-semibold">{p.name}</td><td><Coins n={p.price} /></td><td>{p.cards}</td>
                  {Object.keys(RARITIES).map((r) => <td key={r}>{p.odds[r as keyof typeof p.odds]}%</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-400">Packs return about 92% of their price in card value on average. The fun is in the variance.</p>
        </div>
      </details>
      <details className="card p-4 text-sm" open>
        <summary className="cursor-pointer font-semibold">How rarity works</summary>
        <p className="mt-2 text-zinc-600">Every card in the vault is a real graded slab. Each one gets a score, and the score decides its tier:</p>
        <ul className="mt-2 grid gap-1 text-zinc-600 sm:grid-cols-2">
          <li><b>Grade:</b> Black Label / Pristine 10 +45, PSA 10 +25, other 10s +20, 9.5 +17, 9 +11, 8–8.5 +6</li>
          <li><b>Player:</b> GOAT (Jordan, LeBron, Kobe) +32, legend +18, current star +12, active player +4</li>
          <li><b>Autograph</b> +20 · <b>Memorabilia</b> +13 (Logoman +28) · auto + patch combo +8</li>
          <li><b>Card type:</b> iconic 90s/modern insert +18, premium set +12, numbered/short print +8, parallel +4, rookie +8</li>
          <li><b>Era:</b> pre-1990 +12, 1990s +5, 2000s +3</li>
          <li>Tiers by score: bottom 55% Base, next 27% Chase, 12% Short Print, 4.5% Case Hit, top 1.5% Grail.</li>
        </ul>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs text-zinc-500"><tr><th className="text-left">Tier</th><th>Slabs</th><th>In collections</th><th>Est. value range</th></tr></thead>
            <tbody>
              {(["common", "rare", "epic", "legendary", "grail"] as const).map((r) => {
                const st = stats.get(r);
                return (
                  <tr key={r} className="border-t border-line/60 text-center">
                    <td className={`py-1.5 text-left font-semibold ${RARITIES[r].text}`}>{RARITIES[r].label}</td>
                    <td>{st?.n ?? 0}</td><td>{st?.owned ?? 0}</td>
                    <td>{st ? <><Coins n={st.lo} /> – <Coins n={st.hi} /></> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          {market.ebay
            ? "Card values come from live eBay listings for the exact cert, or the same card in the same grade. Values marked * are estimates."
            : "Values marked * are estimates from the rarity score. Add eBay API keys (see README) to price pulls from live eBay listings."}
        </p>
      </details>
    </div>
  );
}
