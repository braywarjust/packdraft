"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PACKS, PACK_BY_ID, PackType, RARITIES, Rarity, fmtCoins, BUYBACK_RATE } from "@/lib/packs";
import { CardData, GLOW, PlayerCard } from "@/components/PlayerCard";
import { Logo } from "@/components/Logo";

type Inv = { id: number; pack_type: string; source: string; created_at: number };
type Act<T> = Promise<T | { error: string }>;
const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, grail: 4 };

function PackArt({ p, big }: { p: PackType; big?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${p.color} shadow-xl ${big ? "h-80 w-56" : "h-28 w-20"}`}>
      <div className="foil absolute inset-0" />
      <div className="absolute inset-x-0 top-0 h-3 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.35)_0_6px,transparent_6px_12px)]" />
      <div className="absolute inset-x-0 bottom-0 h-3 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.35)_0_6px,transparent_6px_12px)]" />
      <div className="relative flex h-full flex-col items-center justify-center p-2 text-center">
        <span className={`font-black uppercase leading-none tracking-tight text-white drop-shadow ${big ? "text-3xl" : "text-[10px]"}`}>{p.name.replace(" Pack", "")}</span>
        <span className={`mt-1 font-bold text-white/80 ${big ? "text-sm" : "text-[9px]"}`}>{p.cards} CARDS</span>
        {big && <span className="mt-6 rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-white">PACKDRAFT</span>}
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

export function VendingMachine({ coins, inventory, buy, rip, sell }: {
  coins: number; inventory: Inv[];
  buy: (type: string) => Act<{ ok: boolean; packId: number }>;
  rip: (packId: number) => Act<{ ok: boolean; cards: CardData[] }>;
  sell: (ids: number[]) => Act<{ ok: boolean; total: number }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("pro");
  const [stage, setStage] = useState<"idle" | "vending" | "ready" | "tearing" | "cards">("idle");
  const [packId, setPackId] = useState<number | null>(null);
  const [packType, setPackType] = useState<string>("pro");
  const [cards, setCards] = useState<CardData[]>([]);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [sold, setSold] = useState<Set<number>>(new Set());
  const [err, setErr] = useState("");
  const [party, setParty] = useState(false);
  const [coinsShown, setCoinsShown] = useState(false);
  const pack = PACK_BY_ID[selected];

  const doBuy = async () => {
    setErr("");
    setCoinsShown(true);
    setStage("vending");
    const r = await buy(selected);
    if ("error" in r) { setErr(r.error); setStage("idle"); setCoinsShown(false); return; }
    setPackType(selected);
    setPackId(r.packId);
    setTimeout(() => { setStage("ready"); setCoinsShown(false); router.refresh(); }, 1100);
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
    <div className="grid gap-6 2xl:grid-cols-5">
      {party && <Confetti />}
      {/* Machine */}
      <div className="max-w-3xl 2xl:col-span-3">
        <div className="relative rounded-[28px] border-[6px] border-brand bg-gradient-to-b from-white to-zinc-100 p-4 shadow-xl shadow-zinc-900/10">
          <div className="mb-3 flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-2">
            <Logo height={26} />
            <span className="font-mono text-sm font-bold text-brand">CREDIT {fmtCoins(coins)}</span>
          </div>
          <div className="flex gap-4">
            <div className="relative flex-1 rounded-2xl border-2 border-zinc-200 bg-white p-3 shadow-inner">
              <div className="grid grid-cols-3 gap-x-3 gap-y-5">
                {PACKS.map((p, i) => (
                  <button key={p.id} onClick={() => setSelected(p.id)} className={`group flex flex-col items-center rounded-xl p-2 transition ${selected === p.id ? "bg-red-50 ring-2 ring-brand" : "hover:bg-zinc-100"}`}>
                    <div className="transition group-hover:-translate-y-1"><PackArt p={p} /></div>
                    <div className="mt-2 h-1 w-full rounded bg-zinc-300" />
                    <span className="mt-1 text-[10px] font-bold text-zinc-500">{String.fromCharCode(65 + Math.floor(i / 3))}{(i % 3) + 1}</span>
                    <span className="text-xs font-bold text-emerald-600">{fmtCoins(p.price)}</span>
                  </button>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-white/60 via-transparent to-transparent" />
            </div>
            <div className="flex w-36 flex-col gap-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-3 text-center">
                <p className="text-[10px] uppercase text-zinc-400">Selected</p>
                <p className="text-sm font-black">{pack.name}</p>
                <p className="font-mono text-emerald-600">{fmtCoins(pack.price)}</p>
                <p className="mt-1 text-[10px] text-zinc-500">{pack.blurb}</p>
              </div>
              <div className="relative grid h-14 place-items-center rounded-xl border-2 border-zinc-300 bg-zinc-100">
                <div className="h-8 w-1.5 rounded bg-zinc-950" />
                {coinsShown && <span className="anim-coin absolute text-2xl">🪙</span>}
              </div>
              <button onClick={doBuy} disabled={stage !== "idle" || coins < pack.price} className="btn-primary py-3 text-base font-black">
                {coins < pack.price ? "Need more $" : stage === "vending" ? "Vending…" : "BUY"}
              </button>
              {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
            </div>
          </div>
          <div className="mt-4 grid h-24 place-items-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100 shadow-inner">
            {stage === "vending" && <div className="anim-drop"><PackArt p={pack} /></div>}
            {stage === "idle" && <span className="text-xs uppercase tracking-widest text-zinc-400">Push to collect</span>}
          </div>
        </div>
      </div>

      {/* Inventory */}
      <div className="space-y-3 2xl:col-span-2">
        <h2 className="text-lg font-bold">Your unopened packs ({inventory.length})</h2>
        {inventory.length === 0 && <p className="text-sm text-zinc-500">Win matchups, top the weekly leaderboard, or place in DFS to earn free packs.</p>}
        <div className="grid grid-cols-2 gap-3">
          {inventory.map((inv) => {
            const p = PACK_BY_ID[inv.pack_type];
            return (
              <button key={inv.id} onClick={() => openFromInventory(inv)} disabled={stage !== "idle"} className="card flex items-center gap-3 p-3 text-left hover:border-brand/60">
                <PackArt p={p} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">{p.name}</p>
                  <p className="text-xs text-zinc-500">{inv.source}</p>
                  <span className="mt-2 inline-block rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">RIP IT</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rip modal */}
      {(stage === "ready" || stage === "tearing" || stage === "cards") && rp && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          {stage !== "cards" ? (
            <div className="flex flex-col items-center gap-6">
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{stage === "tearing" ? "Ripping…" : "Click the pack to rip it"}</p>
              <button onClick={doRip} disabled={stage === "tearing"} className={`relative ${stage === "ready" ? "anim-drop hover:anim-shake" : ""}`}>
                {stage === "tearing" ? (
                  <div className="relative h-80 w-56">
                    <div className="anim-tear-top absolute inset-x-0 top-0 h-16 overflow-hidden"><PackArt p={rp} big /></div>
                    <div className="anim-tear-bottom absolute inset-x-0 bottom-0 h-64 overflow-hidden" style={{ clipPath: "inset(0 0 0 0)" }}>
                      <div className="-mt-16"><PackArt p={rp} big /></div>
                    </div>
                  </div>
                ) : (
                  <div className="anim-shake"><PackArt p={rp} big /></div>
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
                  return (
                    <button key={c.id} onClick={() => !isUp && flip(c)} className={`flip anim-deal ${isUp ? "flipped" : ""}`} style={{ animationDelay: `${i * 120}ms` }}>
                      <div className="flip-inner relative h-[280px] w-44">
                        <div className="flip-face absolute inset-0 grid place-items-center rounded-xl border-2 border-slate-600 bg-gradient-to-br from-slate-800 to-slate-950">
                          <div className="text-center">
                            <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-brand to-red-800 text-xl font-black text-white">P</div>
                            <p className="text-xs font-bold tracking-widest text-zinc-500">TAP TO REVEAL</p>
                          </div>
                        </div>
                        <div className={`flip-face flip-back absolute inset-0 rounded-xl ${isUp && RANK[c.rarity] >= 2 ? "anim-glow" : ""}`} style={{ "--glow": GLOW[c.rarity] } as React.CSSProperties}>
                          <PlayerCard c={c} />
                          {sold.has(c.id) && <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/70 text-sm font-bold text-emerald-600">SOLD</div>}
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
                  <p className={`text-3xl font-black ${total >= rp.price ? "text-emerald-600" : "text-zinc-800"}`}>{fmtCoins(total)} <span className="text-base font-normal text-zinc-500">on a {fmtCoins(rp.price)} pack {total >= rp.price ? "📈 W" : "📉"}</span></p>
                  <p className="text-xs text-zinc-400">Best pull: <span className={RARITIES[cards[cards.length - 1].rarity].text}>{cards[cards.length - 1].name}</span></p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button className="btn-ghost" disabled={cards.every((c) => sold.has(c.id) || c.rarity !== "common")}
                      onClick={() => sellIds(cards.filter((c) => c.rarity === "common" && !sold.has(c.id)).map((c) => c.id))}>
                      Sell commons ({Math.round(BUYBACK_RATE * 100)}%)
                    </button>
                    <button className="btn-ghost" disabled={cards.every((c) => sold.has(c.id))} onClick={() => sellIds(cards.filter((c) => !sold.has(c.id)).map((c) => c.id))}>
                      Sell all for {fmtCoins(cards.filter((c) => !sold.has(c.id)).reduce((s, c) => s + Math.floor(c.value * BUYBACK_RATE), 0))}
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
