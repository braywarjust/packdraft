import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { myTrades, tradableCards, TRADE_MAX_SLABS, type SlabTrade } from "@/lib/slab-trades";
import type { Card } from "@/lib/packs-server";
import { PageHeader } from "@/components/PageHeader";
import { ActionButton } from "@/components/ActionButton";
import { Coins } from "@/components/Coins";
import { proposeSlabTradeAction, respondSlabTradeAction } from "../../actions";
import { TradeDesk } from "./TradeDesk";
import { TradeThumb, buffText, cardLabel } from "./TradeSlab";

export const metadata: Metadata = { title: "Slab trades" };

const nums = (s?: string) => (s ? s.split(",").map(Number).filter((n) => n > 0) : undefined);

export default async function SlabTrades({ searchParams }: { searchParams: Promise<{ to?: string; give?: string; get?: string }> }) {
  const sp = await searchParams;
  const me = await requireUser();
  // Test accounts trade only with test accounts (and real ones with real ones).
  const managers = all<{ id: number; name: string; color: string }>(
    "SELECT id, name, color FROM users WHERE id != ? AND is_tester = ? ORDER BY name COLLATE NOCASE", me.id, me.is_tester ? 1 : 0);
  const cards: Record<number, Card[]> = { [me.id]: tradableCards(me.id) };
  for (const m of managers) cards[m.id] = tradableCards(m.id);
  const trades = myTrades(me.id);
  const incoming = trades.filter((t) => t.status === "pending" && t.to_user_id === me.id);
  const outgoing = trades.filter((t) => t.status === "pending" && t.from_user_id === me.id);
  const history = trades.filter((t) => t.status !== "pending");

  return (
    <div className="space-y-6">
      <PageHeader icon="collection" eyebrow="Slab vault" title="Slab trades"
        description="Swap slabs with your friends, sweeten it with Pack Points, or just gift one.">
        <Link href="/collection" className="btn-ghost">Back to collection</Link>
      </PageHeader>

      {incoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Offers for you <span className="ml-1 rounded-full bg-accent px-2 text-sm text-white">{incoming.length}</span></h2>
          {incoming.map((t) => <TradeRow key={t.id} t={t} me={me.id} />)}
        </section>
      )}

      <TradeDesk me={me.id} coins={me.coins} managers={managers} cards={cards} max={TRADE_MAX_SLABS}
        initial={{ to: sp.to ? Number(sp.to) : undefined, give: nums(sp.give), get: nums(sp.get) }} propose={proposeSlabTradeAction} />

      {outgoing.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Your open offers</h2>
          {outgoing.map((t) => <TradeRow key={t.id} t={t} me={me.id} />)}
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">History</h2>
          {history.map((t) => <TradeRow key={t.id} t={t} me={me.id} />)}
        </section>
      )}
    </div>
  );
}

const STATUS: Record<SlabTrade["status"], [string, string]> = {
  pending: ["Waiting", "text-amber-600"], accepted: ["Accepted", "text-emerald-600"], declined: ["Declined", "text-zinc-400"],
  cancelled: ["Cancelled", "text-zinc-400"], void: ["Called off", "text-zinc-400"],
};

function TradeRow({ t, me }: { t: SlabTrade; me: number }) {
  const incoming = t.status === "pending" && t.to_user_id === me;
  const outgoing = t.status === "pending" && t.from_user_id === me;
  const [label, tone] = STATUS[t.status];
  const fromMe = t.from_user_id === me;
  const side = (who: string, cs: Card[], pp: number) => (
    <div className="min-w-0 flex-1 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{who}</p>
      {cs.length === 0 && !pp && <p className="text-sm text-zinc-400">Nothing</p>}
      <div className="flex flex-wrap gap-3">
        {cs.map((c) => {
          const buff = buffText(c);
          return (
            <div key={c.id} className="w-[104px] text-center">
              <div className="flex justify-center"><TradeThumb c={c} size={96} /></div>
              <p className="mt-1 truncate text-xs font-semibold">{c.name}</p>
              <p className="truncate text-[11px] text-zinc-500">{cardLabel(c)}</p>
              {buff && <p className="truncate text-[11px] font-semibold text-fpts">{buff}</p>}
            </div>
          );
        })}
      </div>
      {!!pp && <p className="text-sm font-bold text-emerald-600">+ <Coins n={pp} /></p>}
    </div>
  );
  return (
    <div className={`card space-y-3 p-4 ${incoming ? "border-brand/50 ring-1 ring-brand/30" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p>
          <span className="font-bold">{fromMe ? "You" : t.fromName}</span>
          <span className="text-zinc-500"> → </span>
          <span className="font-bold">{t.to_user_id === me ? "you" : t.toName}</span>
          <span className="text-zinc-400"> · {new Date(t.decided_at ?? t.created_at).toLocaleDateString()}</span>
        </p>
        <span className={`text-xs font-bold uppercase tracking-wide ${tone}`}>{label}</span>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row">
        {side(fromMe ? "You send" : `${t.fromName} sends`, t.giveCards, t.give_pp)}
        <div className="hidden w-px bg-line sm:block" />
        {side(fromMe ? `${t.toName} sends` : "You send", t.getCards, t.get_pp)}
      </div>
      {t.note && <p className="text-sm italic text-zinc-700">&ldquo;{t.note}&rdquo;</p>}
      {t.status === "void" && t.reason && <p className="text-xs text-zinc-500">{t.reason}</p>}
      {t.problem && <p className="text-sm font-semibold text-red-600">Can&apos;t go through as offered: {t.problem}.</p>}
      {incoming && (
        <div className="flex flex-wrap gap-2">
          {!t.problem && <ActionButton action={respondSlabTradeAction.bind(null, t.id, true)} className="btn-primary px-4 py-1.5 text-sm"
            confirm={t.get_pp || t.getCards.length ? "Accept this trade? The slabs swap right away." : undefined}>Accept</ActionButton>}
          <ActionButton action={respondSlabTradeAction.bind(null, t.id, false)} className="btn-ghost px-4 py-1.5 text-sm">Decline</ActionButton>
        </div>
      )}
      {outgoing && <ActionButton action={respondSlabTradeAction.bind(null, t.id, false)} className="btn-ghost px-4 py-1.5 text-sm">Cancel offer</ActionButton>}
    </div>
  );
}
