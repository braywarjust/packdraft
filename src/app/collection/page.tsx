import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { userCards } from "@/lib/packs-server";
import { BUYBACK_RATE, RARITIES, Rarity, fmtCoins } from "@/lib/packs";
import { ActionButton } from "@/components/ActionButton";
import { clearTestCards, sellCards } from "../actions";
import { PageHeader } from "@/components/PageHeader";
import { CollectionGrid } from "./CollectionGrid";

export default async function Collection({ searchParams }: { searchParams: Promise<{ r?: string; sort?: string; u?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser();
  const users = all<{ id: number; name: string }>("SELECT id, name FROM users ORDER BY name");
  const viewing = sp.u ? users.find((x) => x.id === Number(sp.u)) ?? me : me;
  const mine = viewing.id === me.id;
  let cards = userCards(viewing.id);
  const total = cards.reduce((s, c) => s + c.value, 0);
  const counts = Object.fromEntries(Object.keys(RARITIES).map((r) => [r, cards.filter((c) => c.rarity === r).length]));
  if (sp.r) cards = cards.filter((c) => c.rarity === sp.r);
  if (sp.sort === "new") cards = [...cards].sort((a, b) => b.created_at - a.created_at);
  const commons = cards.filter((c) => c.rarity === "common");
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { r: sp.r, sort: sp.sort, u: sp.u, ...o };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `?${p}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Card vault" title={mine ? "My collection" : `${viewing.name}'s collection`}
        description={<>{cards.length} cards · vault value <span className="font-bold text-emerald-600">{fmtCoins(total)}</span></>}>
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
        {mine && !!me.is_tester && (
          <ActionButton action={clearTestCards} className="btn-ghost" confirm="Delete all test pulls?">Clear test pulls</ActionButton>
        )}
        {mine && commons.length > 0 && (
          <span className="ml-auto">
            <ActionButton action={sellCards.bind(null, commons.map((c) => c.id))} confirm={`Sell ${commons.length} commons for ${fmtCoins(commons.reduce((s, c) => s + Math.floor(c.value * BUYBACK_RATE), 0))}?`}>
              Bulk sell commons
            </ActionButton>
          </span>
        )}
      </div>
      {cards.length === 0 && (
        <div className="card p-8 text-center text-zinc-500">No cards yet. <Link className="text-brand underline" href="/packs">Hit the vending machine</Link>.</div>
      )}
      <CollectionGrid cards={cards} mine={mine} sell={sellCards} />
    </div>
  );
}
