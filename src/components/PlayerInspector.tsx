"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PlayerInfo } from "@/lib/player-info";
import { RARITIES } from "@/lib/packs";
import { InjuryTag } from "./Headshot";
import { TeamLogo } from "./TeamLogo";
import { TeamBadge } from "./TeamBadge";
import { Fpts } from "./Fpts";
import { Coins } from "./Coins";
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

const fmtPct = (x: number) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;

/** His slab price: what each tier is worth now, how it has moved, and a chart of the Common price over the season. */
function SlabMarket({ d }: { d: PlayerInfo }) {
  const m = d.market;
  const pts = m.history;
  const W = 300, H = 90;
  const lo = Math.min(...pts.map((p) => p.price)), hi = Math.max(...pts.map((p) => p.price));
  const span = Math.max(1, hi - lo);
  const xy = pts.map((p, i) => [pts.length > 1 ? (i / (pts.length - 1)) * W : W, H - 8 - ((p.price - lo) / span) * (H - 16)] as const);
  const up = (m.changeSeason ?? m.change7 ?? 0) >= 0;
  const stroke = up ? "#22c55e" : "#ef4444";
  const Change = ({ label, v }: { label: string; v: number | null }) => (
    <span className="text-xs text-zinc-500">{label} <b className={v == null ? "text-zinc-400" : v >= 0 ? "text-emerald-500" : "text-red-500"}>{v == null ? "-" : fmtPct(v)}</b></span>
  );
  return (
    <section>
      <p className="label">His slab price</p>
      <div className="space-y-3 rounded-xl bg-ink p-4 text-sm ring-1 ring-white/5">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Change label="7 days" v={m.change7} /><Change label="Season" v={m.changeSeason} />
        </div>
        {pts.length >= 2 ? (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none" aria-label="Common slab price over the season">
            <defs><linearGradient id="slab-px" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={stroke} stopOpacity=".35" /><stop offset="1" stopColor={stroke} stopOpacity="0" /></linearGradient></defs>
            <path d={`M0 ${H} ${xy.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} L${W} ${H}Z`} fill="url(#slab-px)" />
            <path d={xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (
          <p className="text-xs text-zinc-500">{m.seasonStarted ? "The chart fills in as he plays this season." : "The price chart starts on opening night, once his new stats come in."}</p>
        )}
        <div className="grid grid-cols-5 gap-1 text-center">
          {m.prices.map((x) => (
            <div key={x.rarity} className="rounded-lg bg-panel2 px-1 py-1.5">
              <p className={`text-[9px] font-black uppercase ${RARITIES[x.rarity].text}`}>{RARITIES[x.rarity].label}</p>
              <p className="font-mono text-[11px] font-bold text-emerald-500"><Coins n={x.price} /></p>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          Priced from his ESPN stats: <Fpts n={m.score} /> a game{m.gp ? ` (this season's ${m.gp} game${m.gp > 1 ? "s" : ""} blended in)` : " last season"}
          {m.popLabel ? `, plus ${m.popLabel.toLowerCase()} popularity (${m.popularity}×)` : ""}. Games he misses don&apos;t move it.
        </p>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-zinc-400"><SlabIcon className="text-fpts" />You own <b className="text-white">{m.mine}</b></span>
          <Link href={`/packs/pool?team=${d.player.team}`} className="btn-ghost px-3 py-1 text-xs">See his slabs</Link>
        </div>
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
