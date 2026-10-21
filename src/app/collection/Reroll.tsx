"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { RARITIES, RARITY_HEX, REROLL_FEE } from "@/lib/packs";
import { slabOf, type CardData } from "@/components/PlayerCard";
import { Slab } from "@/components/Slab";
import { Coins } from "@/components/Coins";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { RerollIcon } from "@/components/Icons";

export type RerollAct = (cardId: number) => Promise<{ ok: boolean; card: CardData } | { error: string }>;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Load the new slab's photo before showing it, so it never pops in blank (gives up after a few seconds). */
function preload(src: string | null | undefined) {
  if (!src) return Promise.resolve();
  const img = new Image();
  img.src = src;
  return Promise.race([img.decode().catch(() => {}), wait(4000)]);
}

/** "Re-roll" panel in a slab's popup on the collection page: what it costs, and the button. */
export function RerollPanel({ card, coins, onStart }: { card: CardData; coins: number; onStart: () => void }) {
  const fee = REROLL_FEE[card.rarity];
  const short = coins < fee;
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <p className="text-xs text-zinc-500">Re-roll</p>
      <p className="mt-0.5 text-sm text-zinc-600">New player, same {RARITIES[card.rarity].label} tier, fresh roll.</p>
      <div className="mt-3 flex items-center gap-3">
        <button className="fx-btn fx-green" disabled={short} onClick={onStart}><RerollIcon className="fx-icon fx-spin" />Re-roll · <Coins n={fee} /></button>
        {short && <span className="text-xs text-red-500">Not enough Pack Points</span>}
      </div>
    </div>
  );
}

/**
 * The re-roll itself, over the slab popup: the old slab spins away, the PackDraft logo plays while the new player is
 * picked and his photo loads, then the new slab flips in. Re-roll again from there, or Done to see the new slab.
 */
export function RerollStage({ card, coins, action, onDone }: { card: CardData; coins: number; action: RerollAct; onDone: (next: CardData | null) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(card);
  const [result, setResult] = useState<CardData | null>(null);
  const [err, setErr] = useState("");
  const [balance, setBalance] = useState(coins);

  const go = (c: CardData) => {
    setErr("");
    setFrom(c);
    setResult(null);
    start(async () => {
      const [r] = await Promise.all([action(c.id), wait(1800)]);
      if ("error" in r) { setErr(r.error); return; }
      await preload(r.card.photo);
      setResult(r.card);
      setBalance((b) => b - REROLL_FEE[c.rarity]);
      router.refresh();
    });
  };
  // Start rolling as soon as the stage opens (once, even when React runs effects twice in development).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    go(card);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rolling = !result && !err;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-8 text-center" aria-live="polite">
        {rolling ? (
          <div className="flex flex-col items-center gap-5">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Re-rolling your {RARITIES[from.rarity].label} {from.name}</p>
            <div className="relative grid h-[260px] w-[260px] place-items-center [perspective:900px]">
              <span className="reroll-ring absolute inset-6 rounded-full border-2" style={{ borderColor: RARITY_HEX[from.rarity] }} />
              <span className="reroll-ring absolute inset-6 rounded-full border-2" style={{ borderColor: RARITY_HEX[from.rarity], animationDelay: ".8s" }} />
              <div className="reroll-out absolute"><Slab s={slabOf(from)} size={200} /></div>
              <div className="logo-play reroll-float relative w-[200px]"><AnimatedLogo className="w-full drop-shadow-[0_10px_30px_rgba(0,0,0,.6)]" /></div>
            </div>
            <p className="animate-pulse text-sm font-semibold text-zinc-400">Finding your new player…</p>
          </div>
        ) : result ? (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">{from.name} re-rolled into</p>
            <div className="reroll-in"><Slab s={slabOf(result)} size={260} /></div>
            <p className="text-xl font-black text-white">{RARITIES[result.rarity].label} {result.name}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button className="fx-btn fx-green" disabled={pending || balance < REROLL_FEE[result.rarity]} onClick={() => go(result)}>
                <RerollIcon className="fx-icon fx-spin" />Re-roll again · <Coins n={REROLL_FEE[result.rarity]} />
              </button>
              <button className="btn-primary" onClick={() => onDone(result)}>Done</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm font-semibold text-red-500">{err}</p>
            <button className="btn-primary" onClick={() => onDone(null)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
