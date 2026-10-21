"use client";

import { XIcon } from "@/components/Icons";
import { useEffect, useState } from "react";
import { CardData, PlayerCard, RarityBadge, SlabImage, slabBadges, slabOf } from "@/components/PlayerCard";
import { Slab } from "@/components/Slab";
import { RARITIES } from "@/lib/packs";
import { Logo, LogoWatermark } from "@/components/Logo";
import { Coins } from "@/components/Coins";
import { FptIcon } from "@/components/Fpts";
import { useScrollLock } from "@/components/useScrollLock";
import { RerollPanel, RerollStage, type RerollAct } from "./Reroll";

export type GridCard = CardData & {
  s_factors?: string | null; s_detail?: string | null; s_est?: number | null; s_pop?: number | null; s_pop_higher?: number | null; created_at: number;
  photo?: string | null;
};

function certUrl(c: GridCard) {
  if (c.s_company === "PSA") return `https://www.psacard.com/cert/${c.s_cert}`;
  if (c.s_company === "SGC") return `https://gosgc.com/cert-code-lookup/${c.s_cert}`;
  return `https://www.ebay.com/sch/i.html?_nkw=${c.s_cert}`;
}

export function CollectionGrid({ cards, mine, coins = 0, reroll }: { cards: GridCard[]; mine?: boolean; coins?: number; reroll?: RerollAct }) {
  const [open, setOpen] = useState<GridCard | null>(null);
  const [rerolling, setRerolling] = useState<GridCard | null>(null);
  useScrollLock(!!open);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("[data-rerolling]") && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const detail = open?.s_detail ? (JSON.parse(open.s_detail) as { match: string; n: number; low?: number; high?: number }) : null;
  const factors = open?.s_factors ? (JSON.parse(open.s_factors) as string[]) : [];

  return (
    <>
      <div className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {cards.map((c) => (
          <button key={c.id} onClick={() => setOpen(c)} className="rounded-xl p-1 transition hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
            <PlayerCard c={c} small />
          </button>
        ))}
      </div>

      {rerolling && reroll && (
        <div data-rerolling>
          <RerollStage card={rerolling} coins={coins} action={reroll}
            onDone={(next) => { setRerolling(null); setOpen(next ? ({ created_at: Date.now(), ...next } as GridCard) : null); }} />
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setOpen(null)}>
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-3">
              <div className="flex items-center gap-3">
                <Logo height={34} />
                <span className="hidden h-5 w-px bg-zinc-200 sm:block" />
                <span className="hidden text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400 sm:block">{open.kind === "slab" ? "Slab" : "Slab Vault"}</span>
              </div>
              <button onClick={() => setOpen(null)} aria-label="Close" className="rounded-md p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"><XIcon /></button>
            </div>
            <div className="relative grid gap-6 overflow-hidden p-6 md:grid-cols-[auto_1fr]">
            <LogoWatermark color="red" opacity={0.06} height={230} className="-bottom-12 -right-10" />
            <div className="relative flex justify-center p-2">
              {open.kind === "slab" ? (
                <Slab s={slabOf(open)} size={Math.min(420, typeof window !== "undefined" ? window.innerWidth - 80 : 420)} />
              ) : open.slab_id ? (
                <SlabImage id={open.slab_id} alt={`${open.s_year} ${open.s_set} ${open.name}`} height={Math.min(560, typeof window !== "undefined" ? window.innerHeight * 0.7 : 560)} rarity={open.rarity} />
              ) : (
                <PlayerCard c={open} />
              )}
            </div>
            <div className="relative min-w-0 space-y-4">
              <div className="flex items-center gap-4">
                {open.photo && open.kind !== "slab" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={open.photo} alt={open.name} className="h-24 w-32 shrink-0 rounded-xl border border-zinc-200 bg-zinc-100 object-cover object-top"
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                )}
                <div className="min-w-0">
                  <RarityBadge rarity={open.rarity} className="mb-1" />
                  <h2 className="text-2xl font-bold tracking-tight">{open.name}</h2>
                  {open.equipped && <p className="mt-1 text-sm font-bold text-fpts">{open.equipped}. It&apos;s used up when that game ends; unequip it from your team page before tip-off to keep it.</p>}
                  {open.kind === "slab" && <p className="text-zinc-500">{open.team_name ?? open.team} · {open.pos}{open.jersey ? ` · #${open.jersey}` : ""} · {RARITIES[open.rarity].label} #{open.serial}</p>}
                  {open.slab_id && (
                    <p className="text-zinc-500">{open.s_year} {open.s_set}{open.s_no ? ` #${open.s_no}` : ""}{open.s_variant ? ` · ${open.s_variant}` : ""}</p>
                  )}
                </div>
              </div>
              {open.slab_id && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-brand px-2 py-0.5 text-xs font-bold text-white">{open.s_company} {open.s_grade}</span>
                  {slabBadges(open.s_flags).map((b) => <span key={b} className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-600">{b}</span>)}
                </div>
              )}
              {open.kind === "slab" && open.mult != null && (
                <div className="rounded-xl border border-fpts/40 bg-fpts/5 p-4">
                  <p className="text-xs text-zinc-500">Fantasy points buff</p>
                  <p className="flex items-center gap-1.5 text-3xl font-black text-fpts"><FptIcon tone="blue" />{open.mult.toFixed(2)}x</p>
                  <p className="mt-1 text-xs text-zinc-500">One use. If {open.name} is on your fantasy team, equip it on one of his games from your team page and his fantasy points for that game{open.boost_pts != null ? ", stat boost included," : ""} are multiplied by {open.mult.toFixed(2)}. The slab leaves your collection when the game ends.</p>
                </div>
              )}
              {open.kind === "slab" && open.boost_pts != null && (
                <div className="rounded-xl border border-orange-500/40 bg-orange-500/5 p-4">
                  <p className="text-xs text-zinc-500">Stat boost</p>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                    {([["Points", open.boost_pts], ["Rebounds", open.boost_reb ?? 0], ["Assists", open.boost_ast ?? 0]] as const).map(([k, v]) => (
                      <div key={k} className={`rounded-lg py-2 ${v ? "bg-orange-500/15" : "bg-zinc-100"}`}>
                        <p className={`text-2xl font-black ${v ? "text-orange-500" : "text-zinc-400"}`}>+{v}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{k}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">One use. Equip it on one of {open.name}&apos;s games before tip-off and these are added to his box score when that game ends{open.mult != null ? `, then the ${open.mult.toFixed(2)}x multiplier applies` : ""}. The slab leaves your collection when the game ends.</p>
                </div>
              )}
              {mine && reroll && open.kind === "slab" && !open.equipped && <RerollPanel card={open} coins={coins} onStart={() => setRerolling(open)} />}
              {open.kind !== "slab" && <div className="rounded-xl border border-zinc-200 p-4">
                <p className="text-xs text-zinc-500">Market value</p>
                <p className="text-3xl font-bold text-emerald-600"><Coins n={open.value} /></p>
                <p className="mt-1 text-xs text-zinc-500">
                  {open.s_source === "auction"
                    ? "Ultra Heavy Hitter: priced at its record public auction sale."
                    : open.s_source === "courtyard"
                    ? "Courtyard fair market value for this exact slab (Heavy Hitter)."
                    : open.s_source === "ebay" && detail
                    ? detail.match === "cert"
                      ? `This exact slab is listed on eBay (${detail.n} listing${detail.n > 1 ? "s" : ""}).`
                      : <>Median of {detail.n} eBay listings for this card in this grade{detail.low != null && <> (<Coins n={detail.low} />–<Coins n={detail.high!} />)</>}.</>
                    : open.slab_id ? "Estimated from the rarity score. Add eBay keys to price from live listings." : "Generated card value."}
                </p>
              </div>}
              {open.slab_id && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-zinc-500">Cert</dt>
                  <dd><a href={certUrl(open)} target="_blank" rel="noreferrer" className="font-mono underline decoration-zinc-300 hover:decoration-zinc-900">{open.s_cert} ↗</a></dd>
                  {open.s_pop != null && (<><dt className="text-zinc-500">Population</dt><dd>{open.s_pop}{open.s_pop_higher != null ? ` (${open.s_pop_higher} higher)` : ""}</dd></>)}
                  <dt className="text-zinc-500">Pulled</dt>
                  <dd>{new Date(open.created_at).toLocaleDateString()}</dd>
                </dl>
              )}
              {factors.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Why it&apos;s {RARITIES[open.rarity].label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {factors.map((f) => <span key={f} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700">{f}</span>)}
                  </div>
                </div>
              )}
            </div>
            </div>
            <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-3 text-[11px] text-zinc-400">
              <span>PackDraft Vault{open.s_cert ? ` · ${open.s_company} cert ${open.s_cert}` : ""}</span>
              <Logo height={18} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
