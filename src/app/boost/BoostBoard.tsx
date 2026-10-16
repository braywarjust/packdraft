"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Headshot, InjuryTag } from "@/components/Headshot";
import { Coins } from "@/components/Coins";
import { RarityBadge } from "@/components/PlayerCard";
import { clearBoostPick, setBoostPick } from "../actions";
import type { Rarity } from "@/lib/packs";

type Live = {
  date: string; total: number;
  picks: {
    slot: number; mult: number; cardId: number; ownBonus: boolean; locked: boolean; final: boolean; credited: boolean;
    player: { id: number; name: string; pos: string; team: string; headshot: string | null };
    slab: { id: number; label: string; grade: string; rarity: string } | null;
    game: { state: string; detail: string; start: number; label: string; score: string } | null;
    line: string; fpts: number; pp: number;
  }[];
};
type P = { id: number; name: string; pos: string; team: string; headshot: string | null; injury: string | null; proj: number; opp: string; start: number; locked: boolean };
type S = { cardId: number; slabId: number; playerId: number | null; label: string; player: string; grade: string; rarity: string; value: number; mult: number };

const time = (ts: number) => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET";

/** A number that briefly flashes green when it goes up (live scoring). */
function Ticker({ value, className = "", digits = 1 }: { value: number; className?: string; digits?: number }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (value > prev.current) { setFlash(true); const t = setTimeout(() => setFlash(false), 1200); prev.current = value; return () => clearTimeout(t); }
    prev.current = value;
  }, [value]);
  return <span className={`tabular-nums transition-colors duration-500 ${flash ? "text-emerald-500" : ""} ${className}`}>{value.toFixed(digits)}</span>;
}

export function BoostBoard({ initial, slots, ownBonus, players, slabs, history, noGames }: {
  initial: Live; slots: number; ownBonus: number; players: P[]; slabs: S[];
  history: { date_et: string; label: string; pp: number; picks: number; pending: number }[]; noGames: string | null;
}) {
  const router = useRouter();
  const [live, setLive] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [player, setPlayer] = useState<P | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => setLive(initial), [initial]);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      let liveNow = false;
      const r = await fetch("/api/boost", { cache: "no-store" }).catch(() => null);
      if (r?.ok && !stop) {
        const j = (await r.json()) as Live;
        setLive(j);
        liveNow = j.picks.some((p) => p.game?.state === "in");
      }
      // Poll fast while any of your players is on the floor.
      if (!stop) setTimeout(load, liveNow ? 8000 : 30000);
    };
    const t = setTimeout(load, 8000);
    return () => { stop = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bySlot = new Map(live.picks.map((p) => [p.slot, p]));
  const usedCards = new Set(live.picks.filter((p) => p.slot !== editing).map((p) => p.cardId));
  const usedPlayers = new Set(live.picks.filter((p) => p.slot !== editing).map((p) => p.player.id));
  const list = useMemo(() => players.filter((p) => !p.locked && !usedPlayers.has(p.id) && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 60),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, q, live, editing]);

  const close = () => { setEditing(null); setPlayer(null); setQ(""); setErr(null); };
  const act = (fn: () => Promise<unknown>) => start(async () => {
    const r = (await fn()) as { error?: string };
    if (r?.error) { setErr(r.error); return; }
    close();
    router.refresh();
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {noGames && <p className="card p-5 text-zinc-500">{noGames}</p>}
        <div className="card flex items-center justify-between p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Today&apos;s boost</p>
            <p className="text-sm text-zinc-500">{live.picks.some((p) => p.game?.state === "in") ? "● Live. Updates every few seconds." : "Pays out as each game goes final."}</p>
          </div>
          <p className="flex items-center gap-2 text-3xl font-black text-emerald-600"><Ticker value={live.total} /> <span className="text-base font-semibold text-zinc-500">PP</span></p>
        </div>

        {Array.from({ length: slots }, (_, slot) => {
          const k = bySlot.get(slot);
          if (!k) {
            return (
              <button key={slot} disabled={!!noGames} onClick={() => setEditing(slot)}
                className="card flex w-full items-center justify-center gap-2 border-dashed p-8 text-zinc-500 transition hover:border-brand/60 hover:text-brand disabled:opacity-50">
                + Boost slot {slot + 1}: pick a player and a slab
              </button>
            );
          }
          const live_ = k.game?.state === "in";
          return (
            <div key={slot} className={`card overflow-hidden ${live_ ? "ring-1 ring-red-500/40" : ""}`}>
              <div className="flex items-stretch gap-4 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {k.slab && <img src={`/api/slabs/${k.slab.id}`} alt="" className="h-28 w-[68px] shrink-0 object-cover object-center" />}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Headshot src={k.player.headshot} name={k.player.name} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{k.player.name} <span className="text-xs font-normal text-zinc-500">{k.player.pos} · {k.player.team}</span></p>
                      <p className="text-xs text-zinc-500">
                        {k.game ? <>{k.game.label} · {k.game.state === "pre" ? time(k.game.start) : <span className={live_ ? "font-semibold text-red-600" : ""}>{live_ && "● "}{k.game.detail}</span>}</> : "No game"}
                      </p>
                    </div>
                  </div>
                  {k.slab && (
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <RarityBadge rarity={k.slab.rarity as Rarity} /> <span className="truncate">{k.slab.label} · {k.slab.grade}</span>
                      {k.ownBonus && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-600">Own-player +{ownBonus.toFixed(1)}×</span>}
                    </p>
                  )}
                  <p className="font-mono text-xs text-zinc-400">{k.line || (k.game?.state === "pre" ? "Waiting for tip-off" : "No stats yet")}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end justify-between text-right">
                  <div className="font-mono text-sm text-zinc-500">
                    <Ticker value={k.fpts} /> pts <span className="text-amber-600">× {k.mult.toFixed(2)}</span>
                  </div>
                  <p className="text-2xl font-black text-emerald-600"><Ticker value={k.pp} /> <span className="text-xs font-semibold text-zinc-500">PP</span></p>
                  <p className="text-[11px] text-zinc-400">{k.credited ? "Paid ✓" : k.locked ? "Locked" : "Editable until tip"}</p>
                </div>
              </div>
              {!k.locked && (
                <div className="flex justify-end gap-2 border-t border-line/60 px-4 py-2 text-xs">
                  <button onClick={() => setEditing(slot)} className="text-zinc-500 hover:text-brand">Change</button>
                  <button onClick={() => act(() => clearBoostPick(slot))} className="text-zinc-500 hover:text-red-600">Remove</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <aside className="space-y-4">
        <div className="card p-4 text-sm">
          <h3 className="mb-2 font-bold">Slab multipliers</h3>
          <p className="mb-3 text-xs text-zinc-500">Set by each slab&apos;s market value.</p>
          <ul className="space-y-1.5 font-mono text-xs">
            {[[25, "1.00"], [250, "1.50"], [2500, "2.00"], [25000, "2.50"], [250000, "3.00"]].map(([v, m]) => (
              <li key={v} className="flex justify-between"><span>${Number(v).toLocaleString()} slab</span><span className="text-amber-600">× {m}</span></li>
            ))}
            <li className="flex justify-between border-t border-line/60 pt-1.5"><span>His own slab</span><span className="text-amber-600">+ {ownBonus.toFixed(2)}</span></li>
          </ul>
        </div>
        <div className="card p-4 text-sm">
          <h3 className="mb-2 font-bold">Past days</h3>
          {history.length === 0 && <p className="text-xs text-zinc-500">Nothing yet.</p>}
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h.date_et} className="flex justify-between"><span>{h.label}</span><span className="font-semibold text-emerald-600"><Coins n={h.pp} />{h.pending ? " …" : ""}</span></li>
            ))}
          </ul>
        </div>
      </aside>

      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={close}>
          <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line/60 p-4">
              <p className="font-bold">{player ? `Back ${player.name} with a slab` : `Boost slot ${editing + 1}: pick a player`}</p>
              <button onClick={close} className="text-zinc-400 hover:text-zinc-900">✕</button>
            </div>
            {err && <p className="px-4 pt-3 text-sm text-red-600">{err}</p>}
            {!player ? (
              <>
                <div className="p-4 pb-2"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tonight's players" className="input" /></div>
                <ul className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
                  {list.map((p) => (
                    <li key={p.id}>
                      <button onClick={() => setPlayer(p)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-panel2">
                        <Headshot src={p.headshot} name={p.name} size={32} />
                        <span className="min-w-0 flex-1"><span className="font-semibold">{p.name}</span> <span className="text-xs text-zinc-500">{p.pos} · {p.team} {p.opp} · {time(p.start)}</span> <InjuryTag injury={p.injury} /></span>
                        <span className="font-mono text-xs text-zinc-500">proj {p.proj.toFixed(1)}</span>
                      </button>
                    </li>
                  ))}
                  {list.length === 0 && <li className="px-2 py-4 text-sm text-zinc-500">No players left who haven&apos;t tipped off.</li>}
                </ul>
              </>
            ) : (
              <>
                <p className="px-4 pt-3 text-xs text-zinc-500">
                  Projected {player.proj.toFixed(1)} pts. Pick the slab to back him with. Each slab can boost one slot a day.
                  <button onClick={() => setPlayer(null)} className="ml-2 text-brand hover:underline">Change player</button>
                </p>
                <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 scrollbar-thin sm:grid-cols-4">
                  {slabs.length === 0 && <p className="col-span-full text-sm text-zinc-500">You don&apos;t have any slabs yet. Rip some packs first.</p>}
                  {slabs.map((s) => {
                    const own = s.playerId === player.id;
                    const mult = s.mult + (own ? ownBonus : 0);
                    const used = usedCards.has(s.cardId);
                    return (
                      <button key={s.cardId} disabled={used || pending} onClick={() => act(() => setBoostPick(editing, player.id, s.cardId))}
                        className={`flex flex-col items-center gap-1 rounded-lg p-2 text-center transition hover:bg-panel2 disabled:cursor-not-allowed disabled:opacity-40 ${own ? "ring-1 ring-amber-500/60" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/slabs/${s.slabId}`} alt="" loading="lazy" className="h-32 w-full object-contain" />
                        <span className="text-lg font-black text-amber-600">× {mult.toFixed(2)}</span>
                        <span className="line-clamp-2 text-[11px] text-zinc-500">{s.player}</span>
                        <span className="text-[11px] text-zinc-400">{own ? "Own player bonus!" : used ? "Used today" : `$${s.value.toLocaleString()}`}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="border-t border-line/60 px-4 py-2 text-xs text-zinc-500">
                  If he scores {player.proj.toFixed(0)} pts, a × 2.00 slab pays {(player.proj * 2).toFixed(0)} Pack Points.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
