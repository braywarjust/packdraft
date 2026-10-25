"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ItemArt } from "@/components/ItemArt";
import { Coins } from "@/components/Coins";
import { AcqIcon, ACQ_COLOR, TradeIcon, TRADE_COLOR } from "@/components/Currencies";
import { announceBalance } from "@/components/useLiveBalance";
import { usePhone } from "@/components/usePhone";
import { Busy } from "@/components/LoadingLogo";
import type { ShopItem } from "@/lib/shop";

const MAX_QTY = 10;

/** One League Shop item: its art, price, how many you own, and a quantity picker with Buy. */
export function ShopCounter({ item, name, blurb, price, owned, coins, buy }: {
  item: ShopItem; name: string; blurb: string; price: number; owned: number; coins: number;
  buy: (item: ShopItem, qty: number) => Promise<{ error?: string; coins?: number } | unknown>;
}) {
  const router = useRouter();
  const phone = usePhone();
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const total = price * qty;
  const afford = Math.floor(coins / Math.max(1, price));
  const short = total > coins;
  const Icon = item === "acquisition" ? AcqIcon : TradeIcon;
  const tint = item === "acquisition" ? ACQ_COLOR : TRADE_COLOR;
  const w = phone ? 150 : 210;

  const onBuy = () => start(async () => {
    const r = (await buy(item, qty)) as { error?: string; coins?: number } | undefined;
    if (r?.error) return setMsg({ text: r.error, bad: true });
    if (typeof r?.coins === "number") announceBalance(r.coins);
    setMsg({ text: `Bought ${qty} ${qty === 1 ? name : `${name}s`}`, bad: false });
    setQty(1);
    router.refresh();
  });

  return (
    <section className="card flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-6 sm:p-6">
      <div className="flex shrink-0 justify-center py-2"><ItemArt item={item} width={w} height={Math.round(w * 1.4)} /></div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-black text-white"><Icon className={tint} />{name}</h3>
          <p className="text-sm text-zinc-500">{blurb}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-ink px-3 py-2 ring-1 ring-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Price</p>
            <p className="font-mono text-lg font-black text-white"><Coins n={price} /></p>
          </div>
          <div className="rounded-xl bg-ink px-3 py-2 ring-1 ring-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Bought</p>
            <p className={`flex items-center gap-1.5 font-mono text-lg font-black ${tint}`}><Icon />{owned}</p>
          </div>
        </div>
        <div className="mt-auto space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg ring-1 ring-line">
              <button type="button" className="hit press px-3 py-2 text-lg font-black text-white disabled:opacity-30" disabled={qty <= 1} onClick={() => setQty(qty - 1)} aria-label="One fewer">−</button>
              <span className="w-8 text-center font-mono font-black text-white">{qty}</span>
              <button type="button" className="hit press px-3 py-2 text-lg font-black text-white disabled:opacity-30" disabled={qty >= MAX_QTY} onClick={() => setQty(qty + 1)} aria-label="One more">+</button>
            </div>
            <button type="button" onClick={onBuy} disabled={pending || short} className={`fx-btn ${item === "acquisition" ? "fx-green" : "fx-blue"} min-w-[11rem] flex-1 py-2.5`} style={{ "--coin-ink": "currentColor" } as React.CSSProperties}>
              <Busy on={pending}>Buy for <Coins n={total} /></Busy>
            </button>
          </div>
          <p className={`text-xs ${msg?.bad ? "text-red-500" : msg ? "text-emerald-500" : "text-zinc-500"}`}>
            {msg?.text ?? (short ? `You need ${(total - coins).toLocaleString("en-US")} more Fantasy Coins` : `You can afford ${afford}`)}
          </p>
        </div>
      </div>
    </section>
  );
}
