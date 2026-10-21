"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
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
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-ink px-3 py-2 ring-1 ring-white/5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-0.5 font-mono text-lg font-black text-white">{children}</p>
    </div>
  );
}

const RARITY_LABEL: Record<string, string> = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Mythic", grail: "Immortal" };
const statBits = (b: { pts: number; reb: number; ast: number }) => ([["PTS", b.pts], ["REB", b.reb], ["AST", b.ast]] as const).filter(([, v]) => v > 0);

/** His slabs: the ones you own and what each rolled (stat boost and/or multiplier), and a link to the league pack pool. */
function SlabMarket({ d }: { d: PlayerInfo }) {
  return (
    <section>
      <p className="label">His slabs</p>
      <div className="space-y-2 rounded-xl bg-ink p-4 text-sm ring-1 ring-white/5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-zinc-400"><SlabIcon className="text-fpts" />You own <b className="text-white">{d.market.mine}</b></span>
          <Link href={d.league ? `/league/${d.league.id}/packs/pool` : "/packs"} className="btn-ghost px-3 py-1 text-xs">Pack pool</Link>
        </div>
        {d.mySlabs.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-1.5 border-t border-line/60 pt-2 text-xs">
            <span className="font-bold text-white">{RARITY_LABEL[s.rarity] ?? s.rarity} #{s.serial}</span>
            {s.mult != null && <span className="rounded-full bg-fpts/15 px-1.5 py-0.5 font-black text-fpts">{s.mult.toFixed(2)}x fantasy points</span>}
            {s.boost && statBits(s.boost).map(([k, v]) => <span key={k} className="rounded-full bg-orange-500/15 px-1.5 py-0.5 font-black text-orange-500">+{v} {k}</span>)}
            {s.equipped && <span className="ml-auto text-[11px] font-semibold text-fpts">Equipped · {s.equipped.startsWith("sim:") ? "sim game" : day(s.equipped)}</span>}
          </div>
        ))}
        {d.mySlabs.some((s) => s.boost) && <p className="text-[11px] text-zinc-500">Stat boosts are added to his points, rebounds and assists when the game they&apos;re equipped for ends, before any multiplier.</p>}
      </div>
    </section>
  );
}

function Body({ d }: { d: PlayerInfo }) {
  const p = d.player;
  const s = d.season?.line;
  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-end gap-4 border-b border-line p-5 pr-14">
        <div className="relative h-28 w-36 shrink-0 overflow-hidden rounded-xl bg-panel2 ring-1 ring-white/5">
          {p.headshot && <img src={p.headshot} alt={p.name} className="absolute left-1/2 top-1 h-[118%] w-auto max-w-none -translate-x-1/2" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span className="rounded bg-panel2 px-1.5 py-0.5 text-white">{p.pos}</span>
            <TeamLogo team={p.team} size={18} />{p.teamName}{p.jersey ? ` · #${p.jersey}` : ""}
          </p>
          <h2 className="mt-1 text-3xl font-black leading-tight text-white">{p.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <InjuryTag injury={p.injury} />
            {d.league && (d.owner ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-ink px-2.5 py-1 font-semibold text-white ring-1 ring-white/10">
                <TeamBadge brand={d.owner.brand} size={20} />{d.owner.mine ? "On your team" : d.owner.brand.name}
                <span className="text-xs text-zinc-500">{d.owner.slot === "BN" ? "Bench" : d.owner.slot.replace(/\d$/, "")}</span>
              </span>
            ) : <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-500 ring-1 ring-emerald-500/30">Free agent in {d.league.name}</span>)}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Tile label="Projected / game"><Fpts n={d.proj} /></Tile>
          <Tile label="Rank">#{d.rank}</Tile>
          <Tile label="Last season / game">{d.season ? <Fpts n={d.season.fp} /> : "Rookie"}</Tile>
          <Tile label="Recent games / game">{d.recentAvg != null ? <Fpts n={d.recentAvg} /> : "-"}</Tile>
          <Tile label="ADP">{p.adp < 999 ? p.adp : "-"}</Tile>
        </div>

        {s && (
          <section>
            <p className="label">Last season averages · {d.season!.gp} games</p>
            <div className="grid grid-cols-4 gap-px overflow-hidden rounded-xl bg-line/60 text-center sm:grid-cols-11">
              {([["MIN", s.min], ["PTS", s.pts], ["REB", s.reb], ["AST", s.ast], ["STL", s.stl], ["BLK", s.blk], ["3PM", s.tpm], ["TO", s.to], ["FG%", pct(s.fgm, s.fga)], ["FT%", pct(s.ftm, s.fta)], ["3P%", pct(s.tpm, s.tpa)]] as [string, number | string][]).map(([k, v]) => (
                <div key={k} className="bg-ink px-1 py-2">
                  <p className="text-[10px] font-bold text-zinc-500">{k}</p>
                  <p className="font-mono text-sm font-black text-white">{typeof v === "number" ? v.toFixed(1) : v}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="label">Game log</p>
          {d.log.length ? (
            <div className="overflow-x-auto rounded-xl ring-1 ring-white/5">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-ink text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr><th className="px-3 py-2 text-left">Date</th><th className="text-left">Opp</th><th className="text-left">Result</th>{["MIN", "PTS", "REB", "AST", "STL", "BLK", "3PM", "TO", "FG"].map((h) => <th key={h} className="px-1 text-right">{h}</th>)}<th className="px-3 text-right">Fantasy</th></tr>
                </thead>
                <tbody>
                  {d.log.map((g) => (
                    <tr key={g.id} className="border-t border-line/50">
                      <td className="whitespace-nowrap px-3 py-1.5 text-zinc-400">{day(g.date)}{g.preseason && <span className="ml-1 text-[10px] text-zinc-500">PRE</span>}</td>
                      <td className="whitespace-nowrap"><span className="inline-flex items-center gap-1 text-zinc-300">{g.home ? "vs" : "@"} <TeamLogo team={g.opp} size={16} />{g.opp}</span></td>
                      <td className={`whitespace-nowrap font-semibold ${g.result.startsWith("W") ? "text-emerald-500" : g.result.startsWith("L") ? "text-red-500" : "text-zinc-400"}`}>{g.result}</td>
                      {[g.line.min, g.line.pts, g.line.reb, g.line.ast, g.line.stl, g.line.blk, g.line.tpm, g.line.to].map((v, i) => <td key={i} className="px-1 text-right font-mono text-zinc-300">{v}</td>)}
                      <td className="px-1 text-right font-mono text-zinc-400">{g.line.fgm}-{g.line.fga}</td>
                      <td className="px-3 text-right font-mono font-bold text-white"><Fpts n={g.fp} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-zinc-500">No games played yet this season.</p>}
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <section>
            <p className="label">Coming up</p>
            {d.upcoming.length ? (
              <ul className="space-y-1.5">
                {d.upcoming.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm ring-1 ring-white/5">
                    <span className="w-28 text-zinc-400">{day(g.date)}</span>
                    <span className="text-zinc-500">{g.home ? "vs" : "@"}</span><TeamLogo team={g.opp} size={18} /><span className="font-semibold text-white">{g.opp}</span>
                    <span className="ml-auto text-xs text-zinc-500">{new Date(g.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}{g.preseason ? " · Preseason" : ""}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-zinc-500">No games scheduled.</p>}
          </section>
          <SlabMarket d={d} />
        </div>
      </div>
    </>
  );
}

export function PlayerInspectorHost() {
  const [req, setReq] = useState<{ id: number; league?: number | null } | null>(null);
  const [data, setData] = useState<PlayerInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useScrollLock(!!req);
  useEffect(() => {
    push = setReq;
    return () => { push = null; };
  }, []);
  useEffect(() => {
    if (!req) return;
    setData(null);
    setErr(null);
    let stop = false;
    fetch(`/api/player/${req.id}${req.league ? `?league=${req.league}` : ""}`)
      .then(async (r) => { const j = await r.json(); if (stop) return; if (!r.ok) setErr(j.error ?? "Couldn't load player"); else setData(j); })
      .catch(() => !stop && setErr("Couldn't load player"));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReq(null);
    window.addEventListener("keydown", onKey);
    return () => { stop = true; window.removeEventListener("keydown", onKey); };
  }, [req]);

  if (!req) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => setReq(null)}>
      <div className="relative my-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => setReq(null)} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-md p-2 text-zinc-400 hover:bg-panel2 hover:text-white"><XIcon /></button>
        {data ? <Body d={data} /> : <p className="p-10 text-center text-sm text-zinc-500">{err ?? "Loading player…"}</p>}
      </div>
    </div>
  );
}
