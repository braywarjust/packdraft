"use client";

import { PackArt as PackVisual } from "@/components/PackArt";
import { OddsBar } from "@/components/OddsBar";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { PACKS, PACK_BY_ID, PackType, RARITIES, Rarity, fmtOdds } from "@/lib/packs";
import { CardData, GLOW, PlayerCard } from "@/components/PlayerCard";
import { Logo } from "@/components/Logo";
import { Coins } from "@/components/Coins";
import { SlabCount } from "@/components/SlabIcon";
import { SlabCover } from "@/components/Slab";
import { CheckIcon, LockIcon } from "@/components/Icons";
import { useScrollLock } from "@/components/useScrollLock";

type Inv = { id: number; pack_type: string; source: string; created_at: number; league_id?: number | null };
type Act<T> = Promise<T | { error: string }>;
/** Heavy Hitters and the top two rarity tiers count as case hits: their face-down card shakes before the flip. */
const isBigHit = (c: CardData) => c.s_source === "courtyard" || c.s_source === "auction" || c.rarity === "legendary" || c.rarity === "grail";
const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, grail: 4 };

// 1-slab packs are the skinny frosted crate renders (~0.79 wide:tall).
/** Light colour each crate bursts open with (its tier colour). */
const BURST: Record<string, string> = { rookie: "#cbd5e1", starter: "#7dd3fc", pro: "#6ee7b7", allpro: "#f0abfc", hof: "#fde68a", goat: "#fda4af", megacase: "#e0f2fe" };

/**
 * Pretend store checkout: order summary, the Pack Points wallet as the payment card, a terms tick and a Pay button that
 * "processes" before the pack drops in. Buying always leads straight into opening.
 */
function Checkout({ p, coins, onPay, onDone, onCancel }: {
  p: PackType; coins: number; onPay: () => Promise<boolean>; onDone: () => void; onCancel: () => void;
}) {
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<"idle" | "processing" | "approved">("idle");
  const total = p.price;
  const after = coins - total;
  const order = useMemo(() => `PD-${Math.floor(100000 + Math.random() * 900000)}`, []);
  const pay = async () => {
    setState("processing");
    const [ok] = await Promise.all([onPay(), new Promise((r) => setTimeout(r, 1300))]);
    if (!ok) { setState("idle"); return; }
    setState("approved");
    setTimeout(onDone, 850);
  };
  const line = (k: React.ReactNode, v: React.ReactNode, cls = "") => (
    <div className={`flex items-center justify-between text-sm ${cls}`}><span className="text-zinc-500">{k}</span><span className="font-semibold text-white">{v}</span></div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={() => state === "idle" && onCancel()}>
      <div className="anim-deal w-full max-w-md overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-white"><LockIcon className="text-emerald-500" /> Secure checkout</p>
          <p className="font-mono text-[11px] text-zinc-500">Order {order}</p>
        </div>
        <div className="space-y-5 p-5">
          {/* Item */}
          <div className="flex items-center gap-4 rounded-xl bg-ink p-3 ring-1 ring-white/5">
            <div className="shrink-0"><PackArt p={p} /></div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-black text-white">{p.name}</p>
              <SlabCount n={p.cards} className="text-xs text-zinc-400" />
              <OddsBar odds={p.odds} />
              <p className="text-[11px] text-zinc-500">Mythic or better <b className="text-red-500">{(p.odds.legendary + p.odds.grail).toFixed(1).replace(/\.0$/, "")}%</b>{p.odds.grail > 0 && <> · Immortal {fmtOdds(p.odds.grail)}</>}</p>
            </div>
            <p className="self-start font-mono font-black text-white"><Coins n={p.price} /></p>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            {line("Subtotal", <Coins n={p.price} />)}
            {line("Vault handling", "Free")}
            {line("Delivery", "Instant")}
            <div className="my-2 border-t border-line" />
            {line(<span className="font-bold text-white">Total</span>, <span className="text-lg text-emerald-500"><Coins n={total} /></span>)}
          </div>

          {/* Payment method: the wallet as a card */}
          <div>
            <p className="label">Pay with</p>
            <div className="relative overflow-hidden rounded-xl p-4 text-white shadow-lg" style={{ background: "linear-gradient(120deg, #0253a4, #0253a4 55%, #cc2b31 140%)" }}>
              <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 2px, transparent 2px 14px)" }} />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/70">PackDraft Wallet</p>
                  <p className="mt-1 font-mono text-2xl font-black"><Coins n={coins} live /></p>
                  <p className="text-[11px] text-white/70">Pack Points balance</p>
                </div>
                <Logo height={30} />
              </div>
              <p className="relative mt-3 flex justify-between border-t border-white/20 pt-2 text-xs"><span className="text-white/70">Balance after purchase</span><b className="font-mono"><Coins n={after} /></b></p>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-xs text-zinc-400">
            <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} disabled={state !== "idle"} />
            I understand pack contents are random, it opens right away, and all sales are final.
          </label>

          <button type="button" onClick={pay} disabled={!agree || state !== "idle"}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-black transition ${state === "approved" ? "bg-emerald-600 text-white" : "btn-primary"} disabled:cursor-not-allowed ${!agree && state === "idle" ? "opacity-50" : ""}`}>
            {state === "processing" ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Processing payment…</>
              : state === "approved" ? <><CheckIcon /> Payment approved</>
              : <>Pay <Coins n={total} /></>}
          </button>
          {state === "idle" && <button type="button" onClick={onCancel} className="w-full text-center text-sm text-zinc-500 hover:text-white">Cancel</button>}
        </div>
      </div>
    </div>
  );
}

const PACK_SIZE = { sm: [88, 112], md: [176, 224], big: [264, 336] } as const;
/** The Mega Pack render is roughly square, so it gets wider boxes than the 1-slab packs. */
const CASE_SIZE = { sm: [116, 116], md: [220, 220], big: [336, 336] } as const;
const artSize = (p: PackType, size: "sm" | "md" | "big") => (p.kind === "case" ? CASE_SIZE : PACK_SIZE)[size];
const slabsLabel = (n: number) => `${n} slab${n === 1 ? "" : "s"}`;

/** Animated pack art (components/PackArt) in the shop's standard boxes. */
function PackArt({ p, big, md }: { p: PackType; big?: boolean; md?: boolean; slabs?: number[] }) {
  const [w, h] = artSize(p, big ? "big" : md ? "md" : "sm");
  return <PackVisual p={p} width={w} height={h} />;
}

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.8, dx: `${(Math.random() - 0.5) * 300}px`,
    color: ["#22d3ee", "#a3e635", "#fbbf24", "#f472b6", "#a78bfa", "#34d399"][i % 6], size: 6 + Math.random() * 8,
  })), []);
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {bits.map((b, i) => (
        <span key={i} className="absolute top-0 rounded-sm" style={{
          left: `${b.left}%`, width: b.size, height: b.size * 0.5, background: b.color,
          animation: `confetti ${b.dur}s ${b.delay}s cubic-bezier(.2,.6,.4,1) forwards`, ["--dx" as string]: b.dx,
        } as React.CSSProperties} />
      ))}
    </div>
  );
}

export function VendingMachine({ coins, inventory, buy, rip, features = {} }: {
  coins: number; inventory: Inv[]; features?: Record<string, number[]>;
  buy: (type: string) => Act<{ ok: boolean; packId: number }>;
  rip: (packId: number) => Act<{ ok: boolean; cards: CardData[] }>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "vending" | "ready" | "tearing" | "cards">("idle");
  const [packId, setPackId] = useState<number | null>(null);
  const [packType, setPackType] = useState<string>("pro");
  const [cards, setCards] = useState<CardData[]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [err, setErr] = useState("");
  const [party, setParty] = useState(false);
  const packRef = useRef<HTMLButtonElement>(null);
  const [burstAt, setBurstAt] = useState<{ x: number; y: number } | null>(null);

  const [checkout, setCheckout] = useState<PackType | null>(null);
  useScrollLock(!!checkout || stage !== "idle");
  /** Charged at checkout; resolves true once paid. Checkout shows "approved", then calls dropIn. */
  const doBuy = async (type: string) => {
    setErr("");
    setBusyId(type);
    const r = await buy(type);
    setBusyId(null);
    if ("error" in r) { setErr(r.error); setCheckout(null); return false; }
    setPackType(type);
    setPackId(r.packId);
    return true;
  };
  const dropIn = () => { setCheckout(null); setStage("ready"); router.refresh(); };

  const openFromInventory = (inv: Inv) => {
    setPackType(inv.pack_type);
    setPackId(inv.id);
    setErr("");
    setStage("ready");
  };

  const doRip = async () => {
    if (!packId) return;
    // Centre the screen flash on the pack itself, not the middle of the window.
    const b = packRef.current?.getBoundingClientRect();
    setBurstAt(b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null);
    setStage("tearing");
    // The crate charges up and bursts open (about 1.5s); the slabs deal in once both the burst and the pull are done.
    const [r] = await Promise.all([rip(packId), new Promise((ok) => setTimeout(ok, 1500))]);
    if ("error" in r) { setErr(r.error); setStage("idle"); return; }
    // Reveal worst first, best last, for maximum drama.
    setCards([...r.cards].sort((a, b) => RANK[a.rarity] - RANK[b.rarity] || a.value - b.value));
    setFlipped(new Set());
    setStage("cards");
    router.refresh();
  };

  const flip = (c: CardData) => {
    setFlipped((f) => new Set(f).add(c.id));
    if (c.rarity === "legendary" || c.rarity === "grail") { setParty(true); setTimeout(() => setParty(false), 4500); }
  };

  const close = () => { setStage("idle"); setCards([]); setPackId(null); router.refresh(); };
  const allFlipped = cards.length > 0 && flipped.size === cards.length;
  const rp = PACK_BY_ID[packType];

  return (
    <div className="space-y-8">
      {party && <Confetti />}
      {err && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
        </div>
      )}

      {inventory.length > 0 && (
        <section id="unopened" className="scroll-mt-36 space-y-3">
          <h2 className="text-lg font-bold">Your unopened packs ({inventory.length})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {inventory.map((inv) => {
              const p = PACK_BY_ID[inv.pack_type];
              return (
                <button key={inv.id} onClick={() => openFromInventory(inv)} disabled={stage !== "idle"} className="card flex items-center gap-3 p-3 text-left transition hover:border-brand/60">
                  <PackArt p={p} slabs={features[p.id]} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{p.name}</p>
                    <p className="truncate text-xs text-zinc-500">{inv.source}</p>
                    {inv.league_id == null && <p className="truncate text-[10px] font-semibold text-amber-500">Opens in any of your leagues</p>}
                    <span className="mt-2 inline-block rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">Open</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section id="packs" className="scroll-mt-36 space-y-3">
        <div><h2 className="text-lg font-bold">League Packs</h2><p className="text-sm text-zinc-500">One Slab each, five in the Mega Pack, all from this league&apos;s pool. Pricier packs tilt the odds toward the top tiers. Tap a pack to check out and rip it.</p></div>
        {/* All seven packs in one row; scrolls sideways when the screen is too narrow. */}
        {/* Generous padding (pulled back with negative margins) so a hovered pack’s lift, tilt and shadow never get clipped by the scroller. */}
        <div className="-mx-6 -mb-6 -mt-8 flex snap-x scroll-px-6 gap-6 overflow-x-auto px-6 pb-10 pt-11 scrollbar-thin">
          {PACKS.map((p) => {
            const busy = stage !== "idle";
            const short = coins < p.price;
            return (
              <button key={p.id} onClick={() => setCheckout(p)} disabled={busy || short}
                title={short ? "Not enough Pack Points" : `${p.name}: ${p.blurb} ${slabsLabel(p.cards)} · Mythic ${p.odds.legendary}% · Immortal ${fmtOdds(p.odds.grail)}`}
                className="group flex shrink-0 snap-start flex-col items-center justify-end gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed">
                <div className={`transition duration-200 ${short || busy ? "" : "group-hover:-translate-y-2 group-hover:rotate-[-2deg] group-hover:drop-shadow-[0_18px_24px_rgba(0,0,0,.45)]"} ${busyId === p.id ? "animate-pulse" : ""}`}>
                  <PackArt p={p} md slabs={features[p.id]} />
                </div>
                <span className={`text-lg font-bold ${short ? "text-zinc-500 opacity-60" : "text-emerald-600"}`} title={short ? "Not enough Pack Points" : undefined}><Coins n={p.price} /></span>
                  <SlabCount n={p.cards} className="-mt-2 text-xs font-semibold text-white" />
                  <span className="w-36 space-y-1">
                    <OddsBar odds={p.odds} />
                    <span className="block text-center text-[11px] text-zinc-500">Mythic or better <b className="text-red-500">{(p.odds.legendary + p.odds.grail).toFixed(p.odds.legendary + p.odds.grail < 1 ? 2 : 1).replace(/\.0$/, "")}%</b></span>
                  </span>
              </button>
            );
          })}
        </div>
      </section>



      {checkout && <Checkout p={checkout} coins={coins} onPay={() => doBuy(checkout.id)} onDone={dropIn} onCancel={() => setCheckout(null)} />}

      {/* Rip modal */}
      {(stage === "ready" || stage === "tearing" || stage === "cards") && rp && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-zinc-100/95 p-4 backdrop-blur-sm">
          {/* No words on screen from the pack dropping in until a slab is flipped, and no backing out: it gets opened. */}
          {stage !== "cards" ? (
            <div className="flex flex-col items-center gap-6" style={{ "--burst": BURST[rp.id] ?? "#ffffff" } as React.CSSProperties}>
              <button ref={packRef} onClick={doRip} disabled={stage === "tearing"} className={`relative ${stage === "ready" ? "anim-drop hover:anim-shake" : ""}`}>
                {stage === "tearing" ? (
                  // Charge and burst: light rays spin up behind the crate while it shakes harder and harder, then it
                  // swells into a flash of its tier colour and the slabs deal in.
                  <div className="relative grid place-items-center">
                    {/* Centred by the keyframes themselves (translate -50%), so no translate classes here. */}
                    <div className="anim-burst-rays pointer-events-none absolute left-1/2 top-1/2 h-[640px] w-[640px] rounded-full" />
                    <div className="anim-burst-glow pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] rounded-full" />
                    <div className="anim-charge relative"><div className="anim-jitter"><PackArt p={rp} big slabs={features[rp.id]} /></div></div>
                  </div>
                ) : (
                  <div className="anim-shake"><PackArt p={rp} big slabs={features[rp.id]} /></div>
                )}
              </button>
              {stage === "tearing" && <div className="anim-burst-flash pointer-events-none fixed inset-0 z-[55]" style={burstAt ? ({ "--bx": `${burstAt.x}px`, "--by": `${burstAt.y}px` } as React.CSSProperties) : undefined} />}
            </div>
          ) : (
            // The slabs sit dead centre, where the pack was; the summary hangs below them out of the flow so nothing moves.
            <div className="relative flex w-full max-w-5xl flex-col items-center">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-24">
                {cards.map((c, i) => {
                  const isUp = flipped.has(c.id);
                  const hit = isBigHit(c);
                  return (
                    <button key={c.id} onClick={() => !isUp && flip(c)} className={`flip anim-deal ${isUp ? "flipped" : ""}`} style={{ animationDelay: `${i * 120}ms` }}>
                      <div className={hit && !isUp ? "anim-rumble [perspective:1000px]" : ""}>
                      <div className="flip-inner relative h-[208px] w-[216px]">{/* slab height only, so the slab itself is centred; its caption hangs below */}
                        {/* Face-down slab: the same 208px square as the revealed Slab, centred the same way, so it flips in place.
                            Old graded slabs no longer drop, so every new pull is a square Slab. */}
                        <div className="flip-face absolute inset-0 flex flex-col items-center">
                          <SlabCover size={208} rarity={c.rarity} />
                        </div>
                        <div className={`flip-face flip-back absolute inset-0 flex flex-col items-center rounded-xl ${isUp && !c.slab_id && c.kind !== "slab" && RANK[c.rarity] >= 2 ? "anim-glow" : ""}`} style={{ "--glow": GLOW[c.rarity] } as React.CSSProperties}>
                          <PlayerCard c={c} />
                        </div>
                      </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="absolute left-1/2 top-full mt-24 flex w-full max-w-xl -translate-x-1/2 justify-center pb-6">
              {!allFlipped ? (flipped.size > 0 &&
                <button className="btn-ghost" onClick={() => cards.forEach((c, i) => setTimeout(() => flip(c), i * 350))}>Reveal all</button>
              ) : (
                <div className="card w-full max-w-xl space-y-3 p-4 text-center">
                  <p className="text-sm text-zinc-400">Best pull: <span className={RARITIES[cards[cards.length - 1].rarity].text}>{cards[cards.length - 1].name}</span></p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button className="btn-primary" onClick={close}>Add to collection</button>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
