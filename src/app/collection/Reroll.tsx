"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { RARITIES, RARITY_HEX, RARITY_ORDER, REROLL_FEE, fmtCoins, type Rarity } from "@/lib/packs";
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

type Act = (cardId: number) => Promise<{ ok: boolean; card: CardData } | { error: string }>;

/** Re-roll button + picker (collection page): pay Pack Points to turn one of your slabs into a different player at the same rarity. */
export function Reroll({ cards, coins, action }: { cards: CardData[]; coins: number; action: Act }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(true)} disabled={!cards.length}
        title={`Re-roll a slab into a different player at the same rarity: ${RARITY_ORDER.map((r) => `${RARITIES[r].label} ${fmtCoins(REROLL_FEE[r])}`).join(", ")}`}>
        Re-roll
      </button>
      {open && <RerollModal cards={cards} coins={coins} action={action} onClose={() => setOpen(false)} />}
    </>
  );
}

function RerollModal({ cards, coins, action, onClose }: { cards: CardData[]; coins: number; action: Act; onClose: () => void }) {
  useScrollLock(true);
  const router = useRouter();
  const [pending, start] = useTransition();
  const byTier = useMemo(() => Object.fromEntries(RARITY_ORDER.map((t) => [t, cards.filter((c) => c.rarity === t)])) as Record<Rarity, CardData[]>, [cards]);
  const [tier, setTier] = useState<Rarity>(RARITY_ORDER.find((t) => byTier[t].length) ?? "common");
  const [picked, setPicked] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ from: CardData; to: CardData } | null>(null);
  // The re-roll animation: the old slab spins away and the PackDraft logo plays until the new slab (and its photo) is ready.
  const [rolling, setRolling] = useState<CardData | null>(null);
  const [balance, setBalance] = useState(coins);
  const list = byTier[tier];
  const chosen = list.find((c) => c.id === picked) ?? null;
  const fee = REROLL_FEE[tier];

  const choose = (t: Rarity) => { setTier(t); setPicked(null); setErr(""); };
  const go = async (c: CardData) => {
    setErr("");
    setResult(null);
    setRolling(c);
    start(async () => {
      const [r] = await Promise.all([action(c.id), wait(1800)]);
      if ("error" in r) { setRolling(null); setErr(r.error); return; }
      await preload(r.card.photo);
      setRolling(null);
      setResult({ from: c, to: r.card });
      setBalance((b) => b - REROLL_FEE[c.rarity]);
      setPicked(null);
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line/60 px-5 py-3">
          <div>
            <p className="text-lg font-black text-white">Re-roll a slab</p>
            <p className="text-xs text-zinc-500">Pick a slab. It becomes a different player at the same rarity, with a new multiplier stamp. Rarer slabs cost more to re-roll.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-2 text-zinc-400 hover:bg-panel2 hover:text-white"><XIcon /></button>
        </div>

        {rolling ? (
          <div className="flex flex-col items-center gap-5 p-8 text-center" aria-live="polite">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Re-rolling your {RARITIES[rolling.rarity].label} {rolling.name}</p>
            <div className="relative grid h-[260px] w-[260px] place-items-center [perspective:900px]">
              <span className="reroll-ring absolute inset-6 rounded-full border-2" style={{ borderColor: RARITY_HEX[rolling.rarity] }} />
              <span className="reroll-ring absolute inset-6 rounded-full border-2" style={{ borderColor: RARITY_HEX[rolling.rarity], animationDelay: ".8s" }} />
              <div className="reroll-out absolute"><Slab s={slabOf(rolling)} size={200} /></div>
              <div className="logo-play reroll-float relative w-[200px]"><AnimatedLogo className="w-full drop-shadow-[0_10px_30px_rgba(0,0,0,.6)]" /></div>
            </div>
            <p className="animate-pulse text-sm font-semibold text-zinc-400">Finding your new player…</p>
          </div>
        ) : result ? (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">{result.from.name} re-rolled into</p>
            <div className="reroll-in"><Slab s={slabOf(result.to)} size={260} /></div>
            <p className="text-xl font-black text-white">{RARITIES[result.to.rarity].label} {result.to.name}</p>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setResult(null)}>Re-roll another</button>
              <button className="btn-ghost" disabled={pending || balance < REROLL_FEE[result.to.rarity]} onClick={() => go(result.to)}>
                Re-roll {result.to.name} again · <Coins n={REROLL_FEE[result.to.rarity]} />
              </button>
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
            {err && <p className="text-sm font-semibold text-red-500">{err}</p>}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
              {RARITY_ORDER.map((t) => (
                <button key={t} onClick={() => choose(t)} className={`tab ${tier === t ? "tab-active" : ""} ${RARITIES[t].text}`}>
                  {RARITIES[t].label} · {fmtCoins(REROLL_FEE[t])} ({byTier[t].length})
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              {list.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500">You don&apos;t have any {RARITIES[tier].label} slabs to re-roll.</p>
              ) : (
                <div className="grid grid-cols-3 justify-items-center gap-3 sm:grid-cols-5 lg:grid-cols-6">
                  {list.map((c) => {
                    const on = picked === c.id;
                    return (
                      <button key={c.id} onClick={() => setPicked(on ? null : c.id)}
                        className={`relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition ${on ? "bg-panel2 ring-2" : "hover:bg-panel2"}`}
                        style={on ? { ["--tw-ring-color" as string]: RARITY_HEX[tier] } : undefined}>
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
              <p className="text-sm text-zinc-400">{chosen ? <><b className="text-white">{chosen.name}</b> · fee <b className="text-white"><Coins n={fee} /></b></> : "Pick a slab to re-roll"}</p>
              {err && <p className="text-sm font-semibold text-red-500">{err}</p>}
              {chosen && balance < fee && <p className="text-sm text-red-500">Not enough Pack Points</p>}
              <button className="btn-primary ml-auto" disabled={!chosen || balance < fee || pending} onClick={() => chosen && go(chosen)}>
                {pending ? "Re-rolling…" : <>Re-roll · <Coins n={fee} /></>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
