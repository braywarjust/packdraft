"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { boostPlayer, unboostPlayer } from "@/app/actions";
import type { PlayerInfo } from "@/lib/player-info";
import { InjuryTag } from "./Headshot";
import { TeamLogo } from "./TeamLogo";
import { TeamBadge } from "./TeamBadge";
import { Fpts } from "./Fpts";
import { SlabIcon } from "./SlabIcon";
import { XIcon } from "./Icons";
import { useScrollLock } from "@/components/useScrollLock";

/**
 * Player inspector popup. Mount <PlayerInspectorHost /> once (root layout), then call openPlayer(id, leagueId)
 * from any client code, or wrap a name in <PlayerButton>.
 */
let push: ((r: { id: number; league?: number | null }) => void) | null = null;
export function openPlayer(id: number, league?: number | null) {
  // Inside a league's pages, use that league's scoring and rosters unless told otherwise.
  const fromUrl = typeof window !== "undefined" ? Number(/^\/league\/(\d+)/.exec(window.location.pathname)?.[1]) || null : null;
  push?.({ id, league: league ?? fromUrl });
}

export function PlayerButton({ id, league, className = "", children }: { id: number; league?: number | null; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); openPlayer(id, league); }} className={`min-w-0 cursor-pointer text-left hover:underline decoration-fpts underline-offset-2 ${className}`}>
      {children}
    </button>
  );
}

const pct = (m: number, a: number) => (a ? `${Math.round((m / a) * 1000) / 10}%` : "-");
const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const RARITY_LABEL: Record<string, string> = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Mythic", grail: "Immortal" };
const statBits = (b: { pts: number; reb: number; ast: number }) => ([["PTS", b.pts], ["REB", b.reb], ["AST", b.ast]] as const).filter(([, v]) => v > 0);

/**
 * His slabs: the ones you own, what each rolled (stat boost and/or multiplier), and, when he's on your team in this
 * league, Equip / Unequip on his next game right here.
 */
function SlabMarket({ d, reload }: { d: PlayerInfo; reload: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const eq = d.equip;
  const run = (fn: () => Promise<unknown>) => start(async () => {
    const r = (await fn()) as { error?: string } | undefined;
    setErr(r?.error ?? "");
    reload();
    router.refresh();
  });
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="label !mb-0 flex items-center gap-1.5"><SlabIcon className="text-fpts" /> His slabs · you own {d.market.mine}</p>
        <Link href={d.league ? `/league/${d.league.id}/packs/pool` : "/packs"} className="text-xs font-semibold text-brand">Pack pool</Link>
      </div>
      {eq && (
        <p className="mb-1.5 text-[11px] text-zinc-500">
          {eq.day ? <>Next game: <b className="text-white">{eq.day}</b>. One use.</> : eq.why}
        </p>
      )}
      <div className="space-y-1.5">
        {d.mySlabs.length === 0 && <p className="rounded-lg bg-ink p-3 text-xs text-zinc-500 ring-1 ring-white/5">No slabs of him yet. Rip League Packs to find one.</p>}
        {d.mySlabs.map((s) => {
          const onThis = eq?.cardId === s.id;
          const elsewhere = !!s.equipped && !onThis;
          const canEquip = !!eq?.day && !elsewhere && !onThis && (s.mult != null || !!s.boost);
          return (
            <div key={s.id} className={`flex flex-wrap items-center gap-1.5 rounded-lg bg-ink px-2.5 py-2 text-xs ring-1 ${onThis ? "ring-fpts" : "ring-white/5"}`}>
              <span className="font-bold text-white">{RARITY_LABEL[s.rarity] ?? s.rarity} #{s.serial}</span>
              {s.mult != null && <span className="rounded-full bg-fpts/15 px-1.5 py-0.5 font-black text-fpts">{s.mult.toFixed(2)}x</span>}
              {s.boost && statBits(s.boost).map(([k, v]) => <span key={k} className="rounded-full bg-orange-500/15 px-1.5 py-0.5 font-black text-orange-500">+{v} {k}</span>)}
              <span className="ml-auto flex items-center gap-1.5">
                {onThis && <span className="font-bold text-fpts">Equipped</span>}
                {elsewhere && <span className="text-[11px] font-semibold text-zinc-500">Equipped · {s.equipped!.startsWith("sim:") ? "sim game" : day(s.equipped!)}</span>}
                {onThis && eq && <button disabled={pending} onClick={() => run(() => unboostPlayer(eq.leagueId, d.player.id))} className="btn-ghost px-2 py-0.5 text-[11px]">Unequip</button>}
                {canEquip && eq && <button disabled={pending} onClick={() => run(() => boostPlayer(eq.leagueId, d.player.id, s.id))} className="btn-primary px-2.5 py-0.5 text-[11px]">{eq.cardId ? "Swap in" : "Equip"}</button>}
              </span>
            </div>
          );
        })}
      </div>
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
      {d.mySlabs.some((s) => s.boost) && <p className="mt-1.5 text-[11px] text-zinc-500">Boosts add on at the final, before the multiplier.</p>}
    </section>
  );
}

function Body({ d, reload }: { d: PlayerInfo; reload: () => void }) {
  const p = d.player;
  const s = d.season?.line;
  return (
    <>
      {/* Header: compact on phones */}
      <div className="flex items-end gap-3 border-b border-line p-3 pr-12 sm:gap-4 sm:p-5 sm:pr-14">
        <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-panel2 ring-1 ring-white/5 sm:h-28 sm:w-36">
          {p.headshot && <img src={p.headshot} alt={p.name} className="absolute left-1/2 top-1 h-[118%] w-auto max-w-none -translate-x-1/2" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 sm:gap-2 sm:text-xs">
            <span className="rounded bg-panel2 px-1.5 py-0.5 text-white">{p.pos}</span>
            <TeamLogo team={p.team} size={16} /><span className="truncate">{p.teamName}{p.jersey ? ` · #${p.jersey}` : ""}</span>
          </p>
          <h2 className="mt-0.5 truncate text-xl font-black leading-tight text-white sm:mt-1 sm:text-3xl">{p.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs sm:mt-2 sm:text-sm">
            <InjuryTag injury={p.injury} />
            {d.league && (d.owner ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2 py-0.5 font-semibold text-white ring-1 ring-white/10">
                <TeamBadge brand={d.owner.brand} size={16} />{d.owner.mine ? "On your team" : d.owner.brand.name}
                <span className="text-[10px] text-zinc-500">{d.owner.slot === "BN" ? "Bench" : d.owner.slot.replace(/\d$/, "")}</span>
              </span>
            ) : <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-500 ring-1 ring-emerald-500/30">Free agent</span>)}
          </div>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:space-y-5 sm:p-5">
        {/* Key numbers: one row of five, small on phones */}
        <div className="grid grid-cols-5 gap-1 sm:gap-2">
          {([["Proj/g", <Fpts key="p" n={d.proj} />], ["Rank", `#${d.rank}`], ["Last yr", d.season ? <Fpts key="s" n={d.season.fp} /> : "Rk"], ["Recent", d.recentAvg != null ? <Fpts key="r" n={d.recentAvg} /> : "-"], ["ADP", p.adp < 999 ? p.adp : "-"]] as [string, React.ReactNode][]).map(([k, v]) => (
            <div key={k} className="min-w-0 rounded-lg bg-ink px-1.5 py-1.5 text-center ring-1 ring-white/5 sm:rounded-xl sm:px-3 sm:py-2 sm:text-left">
              <p className="truncate text-[9px] font-bold uppercase tracking-wider text-zinc-500 sm:text-[10px]">{k}</p>
              <p className="truncate font-mono text-sm font-black text-white sm:text-lg">{v}</p>
            </div>
          ))}
        </div>

        <SlabMarket d={d} reload={reload} />

        {s && (
          <section>
            <p className="label">Last season · {d.season!.gp} games</p>
            <div className="grid grid-cols-6 gap-px overflow-hidden rounded-xl bg-line/60 text-center sm:grid-cols-11">
              {([["MIN", s.min], ["PTS", s.pts], ["REB", s.reb], ["AST", s.ast], ["STL", s.stl], ["BLK", s.blk], ["3PM", s.tpm], ["TO", s.to], ["FG%", pct(s.fgm, s.fga)], ["FT%", pct(s.ftm, s.fta)], ["3P%", pct(s.tpm, s.tpa)]] as [string, number | string][]).map(([k, v], i) => (
                <div key={k} className={`bg-ink px-0.5 py-1 sm:px-1 sm:py-2 ${i >= 6 ? "max-sm:hidden" : ""}`}>
                  <p className="text-[9px] font-bold text-zinc-500 sm:text-[10px]">{k}</p>
                  <p className="font-mono text-xs font-black text-white sm:text-sm">{typeof v === "number" ? v.toFixed(1) : v}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="label">Game log</p>
          {d.log.length ? (
            <div className="overflow-x-auto rounded-xl ring-1 ring-white/5">
              <table className="w-full text-xs sm:min-w-[620px] sm:text-sm">
                <thead className="bg-ink text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left sm:px-3 sm:py-2">Date</th><th className="text-left">Opp</th><th className="text-left max-sm:hidden">Result</th>
                    {["MIN", "PTS", "REB", "AST", "STL", "BLK", "3PM", "TO", "FG"].map((h, i) => <th key={h} className={`px-1 text-right ${i === 0 || i > 3 ? "max-sm:hidden" : ""}`}>{h}</th>)}
                    <th className="px-2 text-right sm:px-3">Fpts</th>
                  </tr>
                </thead>
                <tbody>
                  {d.log.map((g, gi) => (
                    <tr key={g.id} className={`border-t border-line/50 ${gi >= 5 ? "max-sm:hidden" : ""}`}>
                      <td className="whitespace-nowrap px-2 py-1 text-zinc-400 sm:px-3 sm:py-1.5">{shortDay(g.date)}{g.preseason && <span className="ml-1 text-[10px] text-zinc-500">PRE</span>}</td>
                      <td className="whitespace-nowrap"><span className="inline-flex items-center gap-1 text-zinc-300">{g.home ? "vs" : "@"} <TeamLogo team={g.opp} size={14} />{g.opp}</span></td>
                      <td className={`whitespace-nowrap font-semibold max-sm:hidden ${g.result.startsWith("W") ? "text-emerald-500" : g.result.startsWith("L") ? "text-red-500" : "text-zinc-400"}`}>{g.result}</td>
                      {[g.line.min, g.line.pts, g.line.reb, g.line.ast, g.line.stl, g.line.blk, g.line.tpm, g.line.to].map((v, i) => <td key={i} className={`px-1 text-right font-mono text-zinc-300 ${i === 0 || i > 3 ? "max-sm:hidden" : ""}`}>{v}</td>)}
                      <td className="px-1 text-right font-mono text-zinc-400 max-sm:hidden">{g.line.fgm}-{g.line.fga}</td>
                      <td className="px-2 text-right font-mono font-bold text-white sm:px-3"><Fpts n={g.fp} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-zinc-500">No games played yet this season.</p>}
        </section>

        <section>
          <p className="label">Coming up</p>
          {d.upcoming.length ? (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {d.upcoming.map((g) => (
                <div key={g.id} className="rounded-lg bg-ink px-2 py-1.5 text-center text-xs ring-1 ring-white/5">
                  <p className="text-[10px] text-zinc-500">{shortDay(g.date)}</p>
                  <p className="flex items-center justify-center gap-1 font-semibold text-white"><span className="text-zinc-500">{g.home ? "vs" : "@"}</span><TeamLogo team={g.opp} size={14} />{g.opp}</p>
                  <p className="text-[10px] text-zinc-500">{new Date(g.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}{g.preseason ? " · Pre" : ""}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-zinc-500">No games scheduled.</p>}
        </section>
      </div>
    </>
  );
}

export function PlayerInspectorHost() {
  const [req, setReq] = useState<{ id: number; league?: number | null } | null>(null);
  const [data, setData] = useState<PlayerInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useScrollLock(!!req);
  useEffect(() => {
    push = (r) => { setNonce(0); setReq(r); };
    return () => { push = null; };
  }, []);
  useEffect(() => {
    if (!req) return;
    if (!nonce) setData(null);
    setErr(null);
    let stop = false;
    fetch(`/api/player/${req.id}${req.league ? `?league=${req.league}` : ""}`)
      .then(async (r) => { const j = await r.json(); if (stop) return; if (!r.ok) setErr(j.error ?? "Couldn't load player"); else setData(j); })
      .catch(() => !stop && setErr("Couldn't load player"));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReq(null);
    window.addEventListener("keydown", onKey);
    return () => { stop = true; window.removeEventListener("keydown", onKey); };
  }, [req, nonce]);

  if (!req) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-2 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setReq(null)}>
      <div className="relative my-2 w-full max-w-3xl sm:my-8 overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setReq(null)} aria-label="Close" className="absolute right-1.5 top-1.5 z-10 sm:right-3 sm:top-3 rounded-md p-2 text-zinc-400 hover:bg-panel2 hover:text-white"><XIcon /></button>
        {data ? <Body d={data} reload={reload} /> : <p className="p-10 text-center text-sm text-zinc-500">{err ?? "Loading player…"}</p>}
      </div>
    </div>
  );
}
