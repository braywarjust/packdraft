"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RARITIES, RARITY_HEX, TRADE_UP, TRADE_UP_COUNT, type Rarity } from "@/lib/packs";
import { slabOf, type CardData } from "@/components/PlayerCard";
import { Slab } from "@/components/Slab";
import { Coins } from "@/components/Coins";
import { CheckIcon, XIcon } from "@/components/Icons";
import { useScrollLock } from "@/components/useScrollLock";
import { AnimatedLogo } from "@/components/AnimatedLogo";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Load the new slab's photo before showing it, so it never pops in blank (gives up after a few seconds). */
function preload(src: string | null | undefined) {
  if (!src) return Promise.resolve();
  const img = new Image();
  img.src = src;
  return Promise.race([img.decode().catch(() => {}), wait(4000)]);
}

type Act = (ids: number[]) => Promise<{ ok: boolean; card: CardData } | { error: string }>;
const TIERS = (Object.keys(TRADE_UP) as Rarity[]);

/** Trade-up button + picker: choose five slabs of one rarity, pay the fee, get one slab of the next rarity. */
export function TradeUp({ cards, coins, action }: { cards: (CardData & { created_at: number })[]; coins: number; action: Act }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>Trade up</button>
      {open && <TradeUpModal cards={cards} coins={coins} action={action} onClose={() => setOpen(false)} />}
    </>
  );
}

function TradeUpModal({ cards, coins, action, onClose }: { cards: CardData[]; coins: number; action: Act; onClose: () => void }) {
  useScrollLock(true);
  const router = useRouter();
  const [pending, start] = useTransition();
  const byTier = useMemo(() => Object.fromEntries(TIERS.map((t) => [t, cards.filter((c) => c.rarity === t).sort((a, b) => a.value - b.value)])) as Record<Rarity, CardData[]>, [cards]);
  const [tier, setTier] = useState<Rarity>(TIERS.find((t) => byTier[t].length >= TRADE_UP_COUNT) ?? "common");
  const [picked, setPicked] = useState<number[]>([]);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<CardData | null>(null);
  // The trade-up animation: the five slabs fuse into one, the PackDraft logo plays until the new slab (and its photo) is ready.
  const [fusing, setFusing] = useState<CardData[] | null>(null);
  const step = TRADE_UP[tier]!;
  const list = byTier[tier];
  const chosen = list.filter((c) => picked.includes(c.id));
  const ready = chosen.length === TRADE_UP_COUNT && coins >= step.fee;

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < TRADE_UP_COUNT ? [...p, id] : p));
  const choose = (t: Rarity) => { setTier(t); setPicked([]); setErr(""); };
  const go = async () => {
    setErr("");
    setFusing(chosen);
    start(async () => {
      const [r] = await Promise.all([action(picked), wait(2200)]);
      if ("error" in r) { setFusing(null); setErr(r.error); return; }
      await preload(r.card.photo);
      setFusing(null);
      setResult(r.card);
      setPicked([]);
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line/60 px-5 py-3">
          <div>
            <p className="text-lg font-black text-white">Trade up</p>
            <p className="text-xs text-zinc-500">Trade {TRADE_UP_COUNT} slabs of one rarity plus a fee for 1 slab of the next rarity. Five of the same player gets you him again, one tier up.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-2 text-zinc-400 hover:bg-panel2 hover:text-white"><XIcon /></button>
        </div>

        {fusing ? (
          <div className="flex flex-col items-center gap-5 p-8 text-center" aria-live="polite">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Trading up {TRADE_UP_COUNT} {RARITIES[tier].label} slabs to {RARITIES[step.to].label}</p>
            <div className="relative grid h-[300px] w-full max-w-[520px] place-items-center">
              <span className="trade-flash absolute h-40 w-40 rounded-full blur-xl" style={{ background: RARITY_HEX[step.to] }} />
              <span className="reroll-ring absolute h-56 w-56 rounded-full border-2" style={{ borderColor: RARITY_HEX[step.to], animationDelay: "1.1s" }} />
              <span className="reroll-ring absolute h-56 w-56 rounded-full border-2" style={{ borderColor: RARITY_HEX[step.to], animationDelay: "1.9s" }} />
              {fusing.map((c, i) => {
                const a = (-90 + i * (360 / fusing.length)) * (Math.PI / 180);
                return (
                  <div key={c.id} className="trade-fuse absolute"
                    style={{ ["--x" as string]: `${Math.round(Math.cos(a) * 170)}px`, ["--y" as string]: `${Math.round(Math.sin(a) * 105)}px`, ["--r" as string]: `${(i - 2) * 8}deg`, animationDelay: `${i * 0.06}s` }}>
                    <Slab s={slabOf(c)} size={96} />
                  </div>
                );
              })}
              <div className="logo-play trade-logo relative w-[200px]"><AnimatedLogo className="w-full drop-shadow-[0_10px_30px_rgba(0,0,0,.6)]" /></div>
            </div>
            <p className="animate-pulse text-sm font-semibold text-zinc-400">Forging your {RARITIES[step.to].label} slab…</p>
          </div>
        ) : result ? (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">You traded up to</p>
            <div className="reroll-in"><Slab s={slabOf(result)} size={260} /></div>
            <p className="text-xl font-black text-white">{RARITIES[result.rarity].label} {result.name}</p>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setResult(null)}>Trade up again</button>
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
              {TIERS.map((t) => (
                <button key={t} onClick={() => choose(t)} className={`tab ${tier === t ? "tab-active" : ""} ${RARITIES[t].text}`}>
                  {RARITIES[t].label} → {RARITIES[TRADE_UP[t]!.to].label} ({byTier[t].length})
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              {list.length < TRADE_UP_COUNT ? (
                <p className="py-10 text-center text-sm text-zinc-500">You have {list.length} {RARITIES[tier].label} slab{list.length === 1 ? "" : "s"}. You need {TRADE_UP_COUNT} to trade up.</p>
              ) : (
                <div className="grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-5 lg:grid-cols-6">
                  {list.map((c) => {
                    const on = picked.includes(c.id);
                    return (
                      <button key={c.id} onClick={() => toggle(c.id)} disabled={!on && picked.length >= TRADE_UP_COUNT}
                        className={`relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition disabled:opacity-40 ${on ? "bg-panel2 ring-2" : "hover:bg-panel2"}`}
                        style={on ? { ["--tw-ring-color" as string]: RARITY_HEX[step.to] } : undefined}>
                        <Slab s={slabOf(c)} size={112} />
                        <span className="w-full truncate text-[11px] font-semibold text-zinc-300">{c.name}</span>
                        {on && <span className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-black"><CheckIcon /></span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-line/60 px-5 py-3">
              <p className="text-sm text-zinc-400">
                <b className="text-white">{chosen.length}/{TRADE_UP_COUNT}</b> picked · fee <b className="text-white"><Coins n={step.fee} /></b>
              </p>
              {list.length >= TRADE_UP_COUNT && (
                <button className="btn-ghost px-3 py-1 text-xs" onClick={() => setPicked(list.slice(0, TRADE_UP_COUNT).map((c) => c.id))}>Quick pick 5</button>
              )}
              {err && <p className="text-sm font-semibold text-red-500">{err}</p>}
              {coins < step.fee && <p className="text-sm text-red-500">Not enough Pack Points for the fee</p>}
              <button className="btn-primary ml-auto" disabled={!ready || pending} onClick={go}>
                {pending ? "Trading…" : <>Trade up to {RARITIES[step.to].label} · <Coins n={step.fee} /></>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
