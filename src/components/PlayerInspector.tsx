"use client";
/* eslint-disable @next/next/no-img-element */

import { LoadingLogo } from "./LoadingLogo";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dropPlayer } from "@/app/actions";
import { askConfirm } from "./Confirm";
import type { PlayerInfo as BaseInfo } from "@/lib/player-info";
import type { NewsItem } from "@/lib/news";
import { newsAgo } from "@/lib/news-time";

type PlayerInfo = BaseInfo & { news?: NewsItem[] };
import { InjuryTag } from "./Headshot";
import { TeamLogo } from "./TeamLogo";
import { TeamBadge } from "./TeamBadge";
import { Fpts } from "./Fpts";
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
    <button type="button" onClick={(e) => { e.stopPropagation(); openPlayer(id, league); }} className={`hit-y min-w-0 cursor-pointer text-left hover:underline decoration-fpts underline-offset-2 ${className}`}>
      {children}
    </button>
  );
}

const pct = (m: number, a: number) => (a ? `${Math.round((m / a) * 1000) / 10}%` : "-");
const shortDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "numeric", day: "numeric" });

function Body({ d, onClose }: { d: PlayerInfo; onClose: () => void }) {
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
            {d.league && d.owner?.mine && <DropButton leagueId={d.league.id} playerId={p.id} name={p.name} onDone={onClose} />}
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

        {d.news && d.news.length > 0 && <NewsList items={d.news} />}

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
          <p className="label">Game log · last 5</p>
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
                  {d.log.slice(0, 5).map((g) => (
                    <tr key={g.id} className="border-t border-line/50">
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

/** Drop a player from your team, from his popup (Update 4.2: the Drop button moved here from the roster board). */
function DropButton({ leagueId, playerId, name, onDone }: { leagueId: number; playerId: number; name: string; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const go = async () => {
    if (!(await askConfirm(`Drop ${name}?`, { confirmLabel: "Drop", danger: true }))) return;
    start(async () => {
      const r = (await dropPlayer(leagueId, playerId)) as { error?: string } | undefined;
      if (r?.error) setErr(r.error);
      else { onDone(); router.refresh(); }
    });
  };
  return (
    <>
      <button type="button" onClick={go} disabled={pending} className="press touch-manipulation rounded-full bg-[#dc2626] px-3 py-0.5 text-xs font-bold text-[#fff] hover:bg-[#ef4444] disabled:opacity-50">
        {pending ? "Dropping…" : "Drop player"}
      </button>
      {err && <span className="w-full text-xs text-red-500">{err}</span>}
    </>
  );
}

/**
 * ESPN news blurbs, collapsed to one line by default: tap to show the headlines, and tap a headline for the analysis
 * ("Spin") under it.
 */
function NewsList({ items }: { items: NewsItem[] }) {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(items[0]?.id);
  return (
    <section>
      <button type="button" onClick={() => setShown(!shown)} aria-expanded={shown}
        className="flex w-full items-center gap-2 rounded-xl bg-ink px-3 py-2 text-left ring-1 ring-white/5 hover:ring-white/15">
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Player news</span>
        <span className="rounded-full bg-panel2 px-1.5 text-[10px] font-bold text-zinc-400">{items.length}</span>
        {!shown && <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">{newsAgo(items[0].published)} · {items[0].headline}</span>}
        <span className={`ml-auto shrink-0 text-zinc-400 transition-transform ${shown ? "rotate-90" : ""}`}>›</span>
      </button>
      {shown && <ul className="mt-1.5 space-y-1.5">
        {items.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => setOpen(open === n.id ? -1 : n.id)} className="w-full rounded-xl bg-ink px-3 py-2 text-left ring-1 ring-white/5 hover:ring-white/15">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{newsAgo(n.published)}</p>
              <p className="text-sm font-semibold leading-snug text-white">{n.headline}</p>
              {open === n.id && n.story && <p className="mt-1.5 text-xs leading-relaxed text-zinc-600"><b className="text-fpts">Spin:</b> {n.story}</p>}
            </button>
          </li>
        ))}
      </ul>}
    </section>
  );
}

export function PlayerInspectorHost() {
  const [req, setReq] = useState<{ id: number; league?: number | null } | null>(null);
  const [data, setData] = useState<PlayerInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

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
        <button onClick={() => setReq(null)} aria-label="Close" className="hit press absolute right-1.5 top-1.5 z-10 sm:right-3 sm:top-3 rounded-md p-2 text-zinc-400 hover:bg-panel2 hover:text-white"><XIcon /></button>
        {data ? <Body d={data} onClose={() => setReq(null)} /> : err ? <p className="p-10 text-center text-sm text-zinc-500">{err}</p> : <div className="grid place-items-center p-10"><LoadingLogo size={96} label="Loading player" /></div>}
      </div>
    </div>
  );
}
