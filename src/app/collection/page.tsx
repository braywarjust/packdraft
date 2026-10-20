import { SlabCount } from "@/components/SlabIcon";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { userCards } from "@/lib/packs-server";
import { equippedSlabs } from "@/lib/boost";
import { dayLabel } from "@/lib/nba/espn";
import { RARITIES, Rarity } from "@/lib/packs";
import { ActionButton } from "@/components/ActionButton";
import { clearTestCards, rerollSlabAction, tradeUpSlabs } from "../actions";
import { Reroll } from "./Reroll";
import { TradeUp } from "./TradeUp";
import { PageHeader } from "@/components/PageHeader";
import { CollectionGrid } from "./CollectionGrid";

export default async function Collection({ searchParams }: { searchParams: Promise<{ r?: string; sort?: string; u?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser();
  const users = all<{ id: number; name: string }>("SELECT id, name FROM users ORDER BY name");
  const viewing = sp.u ? users.find((x) => x.id === Number(sp.u)) ?? me : me;
  const mine = viewing.id === me.id;
  // Slabs equipped for a game that hasn't finished yet are marked (and can't be traded up until they're unequipped).
  const equips = equippedSlabs(viewing.id);
  const when = (k: string) => (k.startsWith("sim:") ? k.replace(/^sim:W(\d+):G(\d+)$/, (_, w, g) => `Week ${w} game ${Number(g) + 1}`) : dayLabel(k));
  let cards = userCards(viewing.id).map((c) => {
    const e = equips.get(c.id);
    return e ? { ...c, equipped: `Equipped · ${when(e.day_key)} · ${e.league}` } : c;
  });
  const allSlabs = cards.filter((c) => c.kind === "slab" && !("equipped" in c && c.equipped)); // trade-ups pick from all of them, whatever the filter
  const counts = Object.fromEntries(Object.keys(RARITIES).map((r) => [r, cards.filter((c) => c.rarity === r).length]));
  if (sp.r) cards = cards.filter((c) => c.rarity === sp.r);
  if (sp.sort === "new") cards = [...cards].sort((a, b) => b.created_at - a.created_at);
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { r: sp.r, sort: sp.sort, u: sp.u, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `?${p}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader icon="collection" eyebrow="Slab vault" title={mine ? "My collection" : `${viewing.name}'s collection`}
        description={<span className="flex flex-wrap items-center gap-x-2 gap-y-1 leading-none"><SlabCount n={cards.length} className="font-semibold text-white" /></span>}>
          {users.map((x) => (
            <Link key={x.id} href={qs({ u: String(x.id) })} className={`tab ${x.id === viewing.id ? "tab-active" : ""}`}>{x.id === me.id ? "Me" : x.name}</Link>
          ))}
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={qs({ r: undefined })} className={`tab ${!sp.r ? "tab-active" : ""}`}>All</Link>
        {(Object.keys(RARITIES) as Rarity[]).map((r) => (
          <Link key={r} href={qs({ r })} className={`tab ${sp.r === r ? "tab-active" : ""} ${RARITIES[r].text}`}>{RARITIES[r].label} ({counts[r]})</Link>
        ))}
        <span className="mx-2 h-5 w-px bg-line" />
        <Link href={qs({ sort: undefined })} className={`tab ${!sp.sort ? "tab-active" : ""}`}>Top value</Link>
        <Link href={qs({ sort: "new" })} className={`tab ${sp.sort === "new" ? "tab-active" : ""}`}>Newest</Link>
        {mine && <Reroll cards={allSlabs} coins={me.coins} action={rerollSlabAction} />}
        {mine && <TradeUp cards={allSlabs} coins={me.coins} action={tradeUpSlabs} />}
        {mine && !!me.is_tester && (
          <ActionButton action={clearTestCards} className="btn-ghost" confirm="Delete all test pulls?">Clear test pulls</ActionButton>
        )}
      </div>
      {cards.length === 0 && (
        <div className="card p-8 text-center text-zinc-500">No slabs yet. <Link className="text-brand underline" href="/packs">Open packs in the Pack Shop</Link>.</div>
      )}
      <CollectionGrid cards={cards} mine={mine} />
    </div>
  );
}
