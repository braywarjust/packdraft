"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CardData, PlayerCard, RarityBadge, SlabImage, slabBadges } from "@/components/PlayerCard";
import { BUYBACK_RATE, RARITIES, fmtCoins } from "@/lib/packs";
import { Logo, LogoWatermark } from "@/components/Logo";

export type GridCard = CardData & {
  s_factors?: string | null; s_detail?: string | null; s_est?: number | null; s_pop?: number | null; s_pop_higher?: number | null; created_at: number;
};

function certUrl(c: GridCard) {
  if (c.s_company === "PSA") return `https://www.psacard.com/cert/${c.s_cert}`;
  if (c.s_company === "SGC") return `https://gosgc.com/cert-code-lookup/${c.s_cert}`;
  return `https://www.ebay.com/sch/i.html?_nkw=${c.s_cert}`;
}

export function CollectionGrid({ cards, mine, sell }: { cards: GridCard[]; mine: boolean; sell: (ids: number[]) => Promise<unknown> }) {
  const router = useRouter();
  const [open, setOpen] = useState<GridCard | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
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

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm" onClick={() => setOpen(null)}>
          <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-3">
              <div className="flex items-center gap-3">
                <Logo height={34} />
                <span className="hidden h-5 w-px bg-zinc-200 sm:block" />
                <span className="hidden text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400 sm:block">Slab Vault</span>
              </div>
              <button onClick={() => setOpen(null)} aria-label="Close" className="rounded-md p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">✕</button>
            </div>
            <div className="relative grid gap-6 overflow-hidden p-6 md:grid-cols-[auto_1fr]">
            <LogoWatermark color="red" opacity={0.06} height={230} className="-bottom-12 -right-10" />
            <div className="relative flex justify-center p-2">
              {open.slab_id ? (
                <SlabImage id={open.slab_id} alt={`${open.s_year} ${open.s_set} ${open.name}`} height={Math.min(560, typeof window !== "undefined" ? window.innerHeight * 0.7 : 560)} rarity={open.rarity} />
              ) : (
                <PlayerCard c={open} />
              )}
            </div>
            <div className="relative min-w-0 space-y-4">
              <div>
                <RarityBadge rarity={open.rarity} className="mb-1" />
                <h2 className="text-2xl font-bold tracking-tight">{open.name}</h2>
                {open.slab_id && (
                  <p className="text-zinc-500">{open.s_year} {open.s_set}{open.s_no ? ` #${open.s_no}` : ""}{open.s_variant ? ` · ${open.s_variant}` : ""}</p>
                )}
              </div>
              {open.slab_id && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-bold text-white">{open.s_company} {open.s_grade}</span>
                  {slabBadges(open.s_flags).map((b) => <span key={b} className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-600">{b}</span>)}
                </div>
              )}
              <div className="rounded-xl border border-zinc-200 p-4">
                <p className="text-xs text-zinc-500">Market value</p>
                <p className="text-3xl font-bold text-emerald-600">{fmtCoins(open.value)}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {open.s_source === "ebay" && detail
                    ? detail.match === "cert"
                      ? `This exact slab is listed on eBay (${detail.n} listing${detail.n > 1 ? "s" : ""}).`
                      : `Median of ${detail.n} eBay listings for this card in this grade${detail.low != null ? ` (${fmtCoins(detail.low)}–${fmtCoins(detail.high!)})` : ""}.`
                    : open.slab_id ? "Estimated from the rarity score. Add eBay keys to price from live listings." : "Generated card value."}
                </p>
              </div>
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
              {mine && (
                <button
                  className="btn-lime"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Sell ${open.name} back for ${fmtCoins(Math.floor(open.value * BUYBACK_RATE))}?`)) return;
                    start(async () => {
                      await sell([open.id]);
                      setOpen(null);
                      router.refresh();
                    });
                  }}
                >
                  Sell back for {fmtCoins(Math.floor(open.value * BUYBACK_RATE))}
                </button>
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
