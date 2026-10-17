"use client";

import { PackSheen } from "@/components/PackSheen";
import { OddsBar } from "@/components/OddsBar";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PACKS, PACK_BY_ID, PackType, RARITIES, Rarity, BUYBACK_RATE } from "@/lib/packs";
import { CardData, GLOW, PlayerCard } from "@/components/PlayerCard";
import { Logo } from "@/components/Logo";
import { Coins } from "@/components/Coins";
import { SlabCount } from "@/components/SlabIcon";

type Inv = { id: number; pack_type: string; source: string; created_at: number };
type Act<T> = Promise<T | { error: string }>;
/** Heavy Hitters and the top two rarity tiers count as case hits: their face-down card shakes before the flip. */
const isCaseHit = (c: CardData) => c.s_source === "courtyard" || c.rarity === "legendary" || c.rarity === "grail";
const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, grail: 4 };

// 1-slab packs are the skinny frosted crate renders (~0.79 wide:tall).
const PACK_SIZE = { sm: [88, 112], md: [176, 224], big: [264, 336] } as const;
/** The Mega Pack render is roughly square, so it gets wider boxes than the 1-slab packs. */
const CASE_SIZE = { sm: [116, 116], md: [220, 220], big: [336, 336] } as const;
const artSize = (p: PackType, size: "sm" | "md" | "big") => (p.kind === "case" ? CASE_SIZE : PACK_SIZE)[size];
const slabsLabel = (n: number) => `${n} slab${n === 1 ? "" : "s"}`;

/** Pack image rendered in Blender (public/packs/{id}.png, see scripts/pack-renders). Falls back to the CSS wrapper. */
function PackArt({ p, big, md, slabs }: { p: PackType; big?: boolean; md?: boolean; slabs?: number[] }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <CssPackArt p={p} big={big} md={md} slabs={slabs} />;
  const [w, h] = artSize(p, big ? "big" : md ? "md" : "sm");
  const src = `/packs/${p.id}.png?v=7`;
  return (
    <span className="relative block" style={{ width: w, height: h }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={p.name} width={w} height={h} draggable={false} onError={() => setFailed(true)}
        className="block select-none object-contain" style={{ width: w, height: h, filter: "drop-shadow(0 14px 18px rgba(0,0,0,.45))" }} />
      <PackSheen src={src} seed={p.price} />
    </span>
  );
}

/** Foil pack wrapper: tier colours, crimped edges, PackDraft logo and a fan of real chase slabs from the vault. */
function CssPackArt({ p, big, md, slabs = [] }: { p: PackType; big?: boolean; md?: boolean; slabs?: number[] }) {
  const size = big ? "big" : md ? "md" : "sm";
  const [w, h] = PACK_SIZE[size];
  const slabH = h * 0.44;
  const fan = slabs.slice(0, size === "sm" ? 1 : 3);
  const angles = fan.length === 3 ? [-14, 0, 14] : fan.length === 2 ? [-9, 9] : [0];
  const crimp = "repeating-linear-gradient(90deg, rgba(255,255,255,.45) 0 5px, transparent 5px 10px)";
  return (
    <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${p.color} shadow-2xl ring-1 ring-black/20`} style={{ width: w, height: h }}>
      {/* sheen + texture */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 70% at 50% 0%, rgba(255,255,255,.35), transparent 60%), radial-gradient(90% 60% at 50% 110%, rgba(0,0,0,.45), transparent 70%)" }} />
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.5) 0 1px, transparent 1px 9px)" }} />
      <div className="foil absolute inset-0 opacity-70" />
      {/* crimped seals */}
      <div className="absolute inset-x-0 top-0" style={{ height: h * 0.045, background: crimp }} />
      <div className="absolute inset-x-0 bottom-0" style={{ height: h * 0.045, background: crimp }} />
      {/* logo */}
      <div className="absolute inset-x-0 flex justify-center" style={{ top: h * 0.07 }}>
        <Logo height={h * (size === "sm" ? 0.2 : 0.17)} style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,.45))" }} />
      </div>
      {/* chase slabs */}
      <div className="absolute inset-x-0 flex justify-center" style={{ top: h * 0.29, height: slabH }}>
        {fan.map((id, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={id} src={`/api/slabs/${id}`} alt="" loading="lazy"
            className="absolute top-0 object-cover object-center"
            style={{
              height: slabH, width: slabH * 0.6, transform: `translateX(${(i - (fan.length - 1) / 2) * slabH * 0.36}px) rotate(${angles[i]}deg)`,
              transformOrigin: "50% 90%", filter: "drop-shadow(0 8px 10px rgba(0,0,0,.5))", zIndex: i === 1 ? 2 : 1,
            }} />
        ))}
      </div>
      {/* name band */}
      <div className="absolute inset-x-0 z-10 bg-black/55 text-center backdrop-blur-[2px]" style={{ bottom: h * 0.06, paddingBlock: h * 0.025 }}>
        <p className={`font-black uppercase leading-none tracking-tight text-white ${size === "big" ? "text-2xl" : size === "md" ? "text-base" : "text-[9px]"}`}>{p.name.replace(" Pack", "")}</p>
        {size !== "sm" && <p className={`mt-0.5 font-semibold uppercase tracking-[0.2em] text-white/75 ${size === "big" ? "text-xs" : "text-[9px]"}`}>{slabsLabel(p.cards)}</p>}
      </div>
    </div>
  );
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

export function VendingMachine({ coins, inventory, buy, rip, sell, tester = false, features = {} }: {
  coins: number; inventory: Inv[]; tester?: boolean; features?: Record<string, number[]>;
  buy: (type: string) => Act<{ ok: boolean; packId: number }>;
  rip: (packId: number) => Act<{ ok: boolean; cards: CardData[] }>;
  sell: (ids: number[]) => Act<{ ok: boolean; total: number }>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "vending" | "ready" | "tearing" | "cards">("idle");
  const [packId, setPackId] = useState<number | null>(null);
  const [packType, setPackType] = useState<string>("pro");
  const [cards, setCards] = useState<CardData[]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [sold, setSold] = useState<Set<number>>(new Set());
  const [err, setErr] = useState("");
  const [party, setParty] = useState(false);

  const doBuy = async (type: string) => {
    setErr("");
    setBusyId(type);
    setStage("vending");
    const r = await buy(type);
    setBusyId(null);
    if ("error" in r) { setErr(r.error); setStage("idle"); return; }
    setPackType(type);
    setPackId(r.packId);
    setStage("ready");
    router.refresh();
  };

  const openFromInventory = (inv: Inv) => {
    setPackType(inv.pack_type);
    setPackId(inv.id);
    setErr("");
    setStage("ready");
  };

  const doRip = async () => {
    if (!packId) return;
    setStage("tearing");
    const r = await rip(packId);
    if ("error" in r) { setErr(r.error); setStage("idle"); return; }
    // Reveal worst first, best last, for maximum drama.
    setCards([...r.cards].sort((a, b) => RANK[a.rarity] - RANK[b.rarity] || a.value - b.value));
    setFlipped(new Set());
    setSold(new Set());
    setTimeout(() => setStage("cards"), 650);
    router.refresh();
  };

  const flip = (c: CardData) => {
    setFlipped((f) => new Set(f).add(c.id));
    if (c.rarity === "legendary" || c.rarity === "grail") { setParty(true); setTimeout(() => setParty(false), 4500); }
  };

  const sellIds = async (ids: number[]) => {
    const r = await sell(ids);
    if ("error" in r) return setErr(r.error);
    setSold((s) => { const n = new Set(s); ids.forEach((i) => n.add(i)); return n; });
    router.refresh();
  };

  const close = () => { setStage("idle"); setCards([]); setPackId(null); router.refresh(); };
  const total = cards.reduce((s, c) => s + c.value, 0);
  const allFlipped = cards.length > 0 && flipped.size === cards.length;
  const rp = PACK_BY_ID[packType];

  return (
    <div className="space-y-8">
      {party && <Confetti />}
      {(err || tester) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {tester && <p className="text-sm text-zinc-500">Test mode: every pack is free.</p>}
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
                    <span className="mt-2 inline-block rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">Open</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section id="packs" className="scroll-mt-36 space-y-3">
        <div><h2 className="text-lg font-bold">Packs</h2><p className="text-sm text-zinc-500">One graded slab each. Pricier packs tilt the odds toward the top tiers. Tap a pack to buy and rip it.</p></div>
        <div className="grid grid-cols-2 justify-items-center gap-x-6 gap-y-10 sm:grid-cols-3 xl:grid-cols-6">
          {PACKS.filter((p) => p.kind !== "case").map((p) => {
            const busy = stage !== "idle";
            const short = !tester && coins < p.price;
            return (
              <button key={p.id} onClick={() => doBuy(p.id)} disabled={busy || short}
                title={short ? "Not enough Pack Points" : `${p.name}: ${p.blurb} ${slabsLabel(p.cards)} · Case Hit ${p.odds.legendary}% · Grail ${p.odds.grail}%`}
                className="group flex flex-col items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed">
                <div className={`transition duration-200 ${short || busy ? "" : "group-hover:-translate-y-2 group-hover:rotate-[-2deg] group-hover:drop-shadow-[0_18px_24px_rgba(0,0,0,.45)]"} ${busyId === p.id ? "animate-pulse" : ""}`}>
                  <PackArt p={p} md slabs={features[p.id]} />
                </div>
                <span className={`text-lg font-bold ${short ? "text-zinc-500 opacity-60" : "text-emerald-600"}`} title={short ? "Not enough Pack Points" : undefined}><Coins n={p.price} /></span>
                  <SlabCount n={p.cards} className="-mt-2 text-xs font-semibold text-white" />
                  <span className="w-36 space-y-1">
                    <OddsBar odds={p.odds} />
                    <span className="block text-center text-[11px] text-zinc-500">Case Hit or better <b className="text-amber-600">{(p.odds.legendary + p.odds.grail).toFixed(p.odds.legendary + p.odds.grail < 1 ? 2 : 1).replace(/\.0$/, "")}%</b></span>
                  </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* The Mega Pack: presented like the others (the render is the buy button, price underneath). */}
      {PACKS.some((p) => p.kind === "case") && (
        <section id="mega" className="scroll-mt-36 space-y-3">
          <div><h2 className="text-lg font-bold">Mega Pack</h2><p className="text-sm text-zinc-500">Five slabs in one big crate, with no Base tier at all.</p></div>
          <div className="flex flex-wrap justify-center gap-10">
            {PACKS.filter((p) => p.kind === "case").map((p) => {
              const busy = stage !== "idle";
              const short = !tester && coins < p.price;
              return (
                <button key={p.id} onClick={() => doBuy(p.id)} disabled={busy || short}
                  title={short ? "Not enough Pack Points" : `${p.name}: ${p.blurb} ${slabsLabel(p.cards)} · Case Hit ${p.odds.legendary}% · Grail ${p.odds.grail}%`}
                  className="group flex flex-col items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed">
                  <div className={`transition duration-200 ${short || busy ? "" : "group-hover:-translate-y-2 group-hover:rotate-[-2deg] group-hover:drop-shadow-[0_18px_24px_rgba(0,0,0,.45)]"} ${busyId === p.id ? "animate-pulse" : ""}`}>
                    <PackArt p={p} md />
                  </div>
                  <span className={`text-lg font-bold ${short ? "text-zinc-500 opacity-60" : "text-emerald-600"}`} title={short ? "Not enough Pack Points" : undefined}><Coins n={p.price} /></span>
                  <SlabCount n={p.cards} className="-mt-2 text-xs font-semibold text-white" />
                  <span className="w-36 space-y-1">
                    <OddsBar odds={p.odds} />
                    <span className="block text-center text-[11px] text-zinc-500">Case Hit or better <b className="text-amber-600">{(p.odds.legendary + p.odds.grail).toFixed(p.odds.legendary + p.odds.grail < 1 ? 2 : 1).replace(/\.0$/, "")}%</b></span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}


      {/* Rip modal */}
      {(stage === "ready" || stage === "tearing" || stage === "cards") && rp && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-zinc-100/95 p-4 backdrop-blur-sm">
          {stage !== "cards" ? (
            <div className="flex flex-col items-center gap-6">
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{stage === "tearing" ? "Ripping…" : "Click the pack to rip it"}</p>
              <button onClick={doRip} disabled={stage === "tearing"} className={`relative ${stage === "ready" ? "anim-drop hover:anim-shake" : ""}`}>
                {stage === "tearing" ? (
                  <div className="relative h-[336px]" style={{ width: artSize(rp, "big")[0] }}>
                    <div className="anim-tear-top absolute inset-x-0 top-0 h-16 overflow-hidden"><PackArt p={rp} big slabs={features[rp.id]} /></div>
                    <div className="anim-tear-bottom absolute inset-x-0 bottom-0 h-[272px] overflow-hidden" style={{ clipPath: "inset(0 0 0 0)" }}>
                      <div className="-mt-16"><PackArt p={rp} big slabs={features[rp.id]} /></div>
                    </div>
                  </div>
                ) : (
                  <div className="anim-shake"><PackArt p={rp} big slabs={features[rp.id]} /></div>
                )}
              </button>
              {stage === "ready" && <button onClick={close} className="text-sm text-zinc-400 hover:text-white">Save it for later</button>}
            </div>
          ) : (
            <div className="flex w-full max-w-5xl flex-col items-center gap-6">
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{rp.name} · tap cards to reveal</p>
              <div className="flex flex-wrap justify-center gap-4">
                {cards.map((c, i) => {
                  const isUp = flipped.has(c.id);
                  const hit = isCaseHit(c);
                  return (
                    <button key={c.id} onClick={() => !isUp && flip(c)} className={`flip anim-deal ${isUp ? "flipped" : ""}`} style={{ animationDelay: `${i * 120}ms` }}>
                      <div className={hit && !isUp ? "anim-rumble [perspective:1000px]" : ""}>
                      <div className="flip-inner relative h-[330px] w-44">
                        {/* Shared slab back rendered in Blender (scripts/slab-back). Same square framing and 260px height as the
                            revealed slab scan (SlabCard), so the flip swaps back for front without a size jump. */}
                        <div className="flip-face absolute inset-0 flex flex-col items-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/slab-back.webp?v=2" alt="" draggable={false} className="pointer-events-none max-w-none select-none"
                            style={{ width: 260, height: 260, filter: hit ? "drop-shadow(0 0 14px rgba(251,191,36,.75))" : "drop-shadow(0 8px 12px rgba(0,0,0,.35))" }} />
                          {hit
                            ? <p className="mt-3 animate-pulse rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-black tracking-widest text-black">CASE HIT</p>
                            : <p className="mt-3 text-[10px] font-semibold tracking-[0.3em] text-zinc-400">TAP TO REVEAL</p>}
                        </div>
                        <div className={`flip-face flip-back absolute inset-0 rounded-xl ${isUp && !c.slab_id && RANK[c.rarity] >= 2 ? "anim-glow" : ""}`} style={{ "--glow": GLOW[c.rarity] } as React.CSSProperties}>
                          <PlayerCard c={c} />
                          {sold.has(c.id) && <div className="absolute inset-0 grid place-items-center rounded-xl bg-white/85 text-sm font-bold text-zinc-900">SOLD</div>}
                        </div>
                      </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!allFlipped ? (
                <button className="btn-ghost" onClick={() => cards.forEach((c, i) => setTimeout(() => flip(c), i * 350))}>Reveal all</button>
              ) : (
                <div className="card w-full max-w-xl space-y-3 p-4 text-center">
                  <p className="text-sm text-zinc-500">Pack value</p>
                  <p className={`text-3xl font-black ${total >= rp.price ? "text-emerald-600" : "text-zinc-800"}`}><Coins n={total} /> <span className="text-base font-normal text-zinc-500">on a <Coins n={rp.price} /> pack {total >= rp.price ? "· W" : "· L"}</span></p>
                  <p className="text-xs text-zinc-400">Best pull: <span className={RARITIES[cards[cards.length - 1].rarity].text}>{cards[cards.length - 1].name}</span></p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button className="btn-ghost" disabled={cards.every((c) => sold.has(c.id) || c.rarity !== "common")}
                      onClick={() => sellIds(cards.filter((c) => c.rarity === "common" && !sold.has(c.id)).map((c) => c.id))}>
                      Sell commons ({Math.round(BUYBACK_RATE * 100)}%)
                    </button>
                    <button className="btn-ghost" disabled={cards.every((c) => sold.has(c.id))} onClick={() => sellIds(cards.filter((c) => !sold.has(c.id)).map((c) => c.id))}>
                      Sell all for <Coins n={cards.filter((c) => !sold.has(c.id)).reduce((s, c) => s + Math.floor(c.value * BUYBACK_RATE), 0)} />
                    </button>
                    <button className="btn-primary" onClick={close}>Keep & close</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
