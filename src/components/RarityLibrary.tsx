"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { RARITIES, RARITY_HEX, type Rarity } from "@/lib/packs";
import { Coins } from "./Coins";
import { XIcon } from "./Icons";
import { useScrollLock } from "./useScrollLock";

type LibSlab = { id: number; player: string; year: number; set_name: string; company: string; grade: string; value: number; pulled: number; mine: number };

/** Wraps a rarity tile in the Pack Shop; clicking it opens that tier's library. */
export function RarityLibraryButton({ rarity, className = "", children }: { rarity: Rarity; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`block w-full text-left transition hover:-translate-y-0.5 hover:brightness-110 ${className}`} title={`Browse every ${RARITIES[rarity].label} slab`}>
        {children}
      </button>
      {open && <RarityLibrary rarity={rarity} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Every slab you could pull in a tier, greyed out: still easy to make out, but not yours (yet). */
function RarityLibrary({ rarity, onClose }: { rarity: Rarity; onClose: () => void }) {
  useScrollLock(true);
  const [q, setQ] = useState("");
  const [slabs, setSlabs] = useState<LibSlab[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [next, setNext] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);
  const color = RARITY_HEX[rarity];

  const load = async (offset: number, query: string, reset: boolean) => {
    const id = ++reqId.current;
    setLoading(true);
    const r = await fetch(`/api/library?rarity=${rarity}&offset=${offset}&q=${encodeURIComponent(query)}`);
    const j = await r.json();
    if (id !== reqId.current) return;
    setLoading(false);
    if (!r.ok) return;
    setTotal(j.total);
    setNext(j.next);
    setSlabs((s) => (reset ? j.slabs : [...s, ...j.slabs]));
  };

  // New search: start over (debounced).
  useEffect(() => {
    const t = setTimeout(() => load(0, q, true), q ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rarity]);

  // Load more as you reach the bottom.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && next != null && !loading) load(next, q, false); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, loading, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <span className="rounded-full px-2 py-0.5 text-xs font-black uppercase" style={{ background: color, color: rarity === "grail" ? "#000" : "#fff" }}>{RARITIES[rarity].label}</span>
          <h2 className="text-lg font-black text-white">Slab library</h2>
          <span className="text-sm text-zinc-500">{total == null ? "Loading…" : `${total.toLocaleString("en-US")} slab${total === 1 ? "" : "s"}`}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search player or set" className="input ml-auto w-56 py-1.5 text-sm" />
          <button onClick={onClose} aria-label="Close" className="rounded-md p-2 text-zinc-400 hover:bg-panel2 hover:text-white"><XIcon /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
            {slabs.map((s) => (
              <div key={s.id} className="flex flex-col items-center text-center">
                <div className="relative">
                  <img src={`/api/slabs/${s.id}?h=300`} alt={s.player} loading="lazy" className="h-[150px] w-[90px] object-cover"
                    style={{ filter: "grayscale(1) brightness(.85) contrast(.95)", opacity: 0.6 }} />
                  {!!s.mine && <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 px-1.5 text-[9px] font-black text-black">YOURS</span>}
                  {!s.mine && !!s.pulled && <span className="absolute -right-1 -top-1 rounded-full bg-zinc-600 px-1.5 text-[9px] font-bold text-white">PULLED</span>}
                </div>
                <p data-slab-name className="mt-1.5 w-full truncate text-[11px] font-semibold text-zinc-400">{s.player}</p>
                <p data-slab-name className="w-full truncate text-[10px] text-zinc-500">{s.year} {s.set_name}</p>
                <p className="font-mono text-[11px] font-bold text-zinc-400"><Coins n={s.value} /></p>
              </div>
            ))}
          </div>
          {total === 0 && <p className="py-10 text-center text-sm text-zinc-500">No slabs match.</p>}
          <div ref={sentinel} className="h-10" />
          {loading && slabs.length > 0 && <p className="text-center text-xs text-zinc-500">Loading more…</p>}
        </div>
      </div>
    </div>
  );
}
