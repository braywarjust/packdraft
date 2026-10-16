import { requireUser } from "@/lib/auth";
import { unopenedPacks } from "@/lib/packs-server";
import { PACKS, RARITIES } from "@/lib/packs";
import { VendingMachine } from "./VendingMachine";
import { buyPack, ripPack, sellCards } from "../actions";
import { PageHeader } from "@/components/PageHeader";

export default async function PacksPage() {
  const u = await requireUser();
  const inventory = unopenedPacks(u.id);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Mystery packs" title="Pack Shop"
        description={<>Buy a pack, rip it open and collect graded, serial-numbered player cards. Don&apos;t love a pull? Instant buyback at 90% of its value.</>} />
      <VendingMachine coins={u.coins} inventory={inventory} buy={buyPack} rip={ripPack} sell={sellCards} />
      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Pack odds</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs text-zinc-500"><tr><th className="text-left">Pack</th><th>Price</th><th>Cards</th>{Object.values(RARITIES).map((r) => <th key={r.label} className={r.text}>{r.label}</th>)}</tr></thead>
            <tbody>
              {PACKS.map((p) => (
                <tr key={p.id} className="border-t border-line/60 text-center">
                  <td className="py-1.5 text-left font-semibold">{p.name}</td><td>${p.price.toLocaleString()}</td><td>{p.cards}</td>
                  {Object.keys(RARITIES).map((r) => <td key={r}>{p.odds[r as keyof typeof p.odds]}%</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-400">Packs return about 92% of their price in card value on average. The fun is in the variance.</p>
        </div>
      </details>
    </div>
  );
}
