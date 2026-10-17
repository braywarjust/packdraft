"use client";

import { TeamBadge, type BrandLite } from "@/components/TeamBadge";
import { TeamLogo } from "@/components/TeamLogo";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LivePlayer } from "@/lib/league";
import { InjuryTag } from "@/components/Headshot";
import { MatchupCard } from "@/components/MatchupCard";
import { BoostChip } from "@/components/LineupEditor";
import { Fpts } from "@/components/Fpts";

type Side = { id: number; name: string; brand: BrandLite; record: string; score: number; projected: number; remain: number; players: LivePlayer[] };
type Data = { week: number; final: boolean; live: boolean; mode: string; range: string | null; progress: number | null; league: string; home: Side; away: Side; winProb: number };
type Event = { key: string; name: string; delta: number; line: string; side: "home" | "away" };

const STARTERS = ["G1", "G2", "F1", "F2", "C", "UTIL1", "UTIL2", "UTIL3"];
const lbl = (s: string) => s.replace(/\d$/, "");

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 300, h = 56;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * w},${h - p * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-14 w-full" preserveAspectRatio="none">
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="#22304d" strokeDasharray="4 4" />
      <path d={d} fill="none" stroke="#22d3ee" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function LiveMatchup({ leagueId, matchupId }: { leagueId: number; matchupId: number }) {
  const [d, setD] = useState<Data | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [flash, setFlash] = useState<Set<number>>(new Set());
  const prev = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const r = await fetch(`/api/live/${matchupId}`, { cache: "no-store" });
      if (stop) return;
      if (r.ok) {
        const j = (await r.json()) as Data;
        setD(j);
        if (!j.final) setHistory((h) => (h[h.length - 1] === j.winProb ? h : [...h.slice(-150), j.winProb]));
        const newEvents: Event[] = [];
        const changed = new Set<number>();
        for (const side of ["home", "away"] as const) {
          for (const p of j[side].players) {
            const before = prev.current.get(p.id);
            if (before !== undefined && Math.abs(p.pts - before) >= 0.5 && p.slot !== "BN") {
              const delta = p.pts - before;
              changed.add(p.id);
              newEvents.push({ key: `${p.id}-${Date.now()}`, side, name: p.name, delta, line: p.now?.line ?? "" });
            }
            prev.current.set(p.id, p.pts);
          }
        }
        if (newEvents.length) {
          setEvents((e) => [...newEvents, ...e].slice(0, 30));
          setFlash(changed);
        }
        if (!j.final) timer = setTimeout(load, j.live || (j.progress ?? 0) > 0 ? 5000 : 30000);
      } else timer = setTimeout(load, 15000);
    };
    load();
    return () => { stop = true; clearTimeout(timer); };
  }, [matchupId]);

  if (!d) return <p className="text-zinc-500">Loading matchup…</p>;
  const { home, away } = d;
  const hp = Math.round(d.winProb * 100);

  // Each starter gets a row framed in his fantasy team's colour, with his photo large on the outer edge.
  const cell = (p: LivePlayer | undefined, right: boolean, brand: BrandLite) => {
    return (
      <div className={`relative min-h-[76px] min-w-0 flex-1 overflow-hidden rounded-xl ring-1 ring-white/5 ${p && flash.has(p.id) ? "anim-flash" : ""}`}
        style={{ background: brand.color }}>
        {p ? (
          <>
            {p.headshot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.headshot} alt="" aria-hidden loading="lazy"
                className={`pointer-events-none absolute top-1 h-[125%] w-auto max-w-none select-none ${right ? "-right-8" : "-left-8"}`} />
            )}
            {/* Text and points sit on a dark panel so they're always white with the blue icon, whatever the team colour. */}
            <div className={`relative my-1.5 flex min-h-[64px] items-center gap-2 rounded-lg bg-[#0f141f] py-2 text-white ring-1 ring-black/20 ${right ? "ml-1.5 mr-[72px] flex-row-reverse pl-3 pr-3 text-right" : "ml-[72px] mr-1.5 pl-3 pr-3"}`}>
              <div className="min-w-0 flex-1">
                <p className={`flex items-center gap-1.5 text-[15px] font-black leading-tight ${right ? "flex-row-reverse" : ""}`}><span className="truncate">{p.name}</span><InjuryTag injury={p.injury} /><BoostChip boost={p.boost} /></p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-300">
                  <TeamLogo team={p.team} size={13} className="-mt-0.5 mr-1 align-middle" />{p.team} ·{" "}
                  {p.now ? (p.now.state === "in" ? <span className="font-bold text-red-400">● {p.now.clock} </span> : p.now.state === "post" ? `${p.now.clock} ` : `${p.now.label} ${p.now.clock} `) : "No games "}
                  {p.now?.line && p.now.state !== "pre" ? `· ${p.now.line}` : ""}
                </p>
                <p className="text-[10px] font-semibold text-zinc-400">{p.played}/{p.total} games · {p.left} left · <Fpts n={p.proj} />/g</p>
              </div>
              <p className={`border-white/10 font-mono text-xl font-black ${right ? "border-r pr-3" : "border-l pl-3"}`}><Fpts n={p.pts} iconClass="text-[0.8em]" /></p>
            </div>
          </>
        ) : <span className="flex h-full items-center px-4 text-sm text-zinc-500">Empty</span>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Link href={`/league/${leagueId}`} className="text-sm text-zinc-500 hover:text-zinc-900">← {d.league}</Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-black uppercase tracking-[0.25em] text-zinc-500">Week {d.week}</span>
        {d.range && <span className="text-zinc-500">{d.range}</span>}
        <span className={`font-bold ${d.final ? "text-white" : d.live ? "text-red-500" : "text-zinc-400"}`}>{d.final ? "Final" : d.live ? "● Live" : "In progress"}</span>
        {d.progress != null && d.progress > 0 && !d.final && <span className="text-zinc-500">{Math.round(d.progress * 100)}% of sim week</span>}
      </div>
      <MatchupCard big home={{ id: home.id, brand: home.brand, record: home.record, score: home.score, proj: home.score + home.remain }}
        away={{ id: away.id, brand: away.brand, record: away.record, score: away.score, proj: away.score + away.remain }}
        status={d.final ? "final" : d.live || home.score + away.score > 0 ? "live" : "pre"} winProb={d.winProb} />
      {history.length > 1 && <div className="card px-4 pb-3 pt-2"><p className="label">Win probability over the week</p><Spark points={history} /></div>}

      <div className="grid gap-4 2xl:grid-cols-3">
        <div className="card p-2 2xl:col-span-2">
          {STARTERS.map((slot) => (
            <div key={slot} className="flex items-stretch gap-1.5 py-1">
              {cell(home.players.find((p) => p.slot === slot), false, home.brand)}
              <span className={`pos pos-${lbl(slot)} shrink-0 self-center`}>{lbl(slot)}</span>
              {cell(away.players.find((p) => p.slot === slot), true, away.brand)}
            </div>
          ))}
          <details className="mt-2 px-2 pb-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase text-zinc-500">Benches</summary>
            <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-zinc-500">
              {[home, away].map((s) => (
                <ul key={s.id} className="space-y-1">
                  {s.players.filter((p) => p.slot === "BN").map((p) => <li key={p.id} className="flex justify-between gap-2"><span className="truncate">{p.name}</span><span className="font-mono">{p.left} left</span></li>)}
                </ul>
              ))}
            </div>
          </details>
        </div>
        <div className="card p-4">
          <p className="label">Live scoring feed</p>
          {events.length === 0 && <p className="text-sm text-zinc-400">{d.final ? "This one's in the books." : "Updates roll in here while games are live."}</p>}
          <ul className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.key} className={`anim-deal rounded-lg border-l-2 bg-ink/60 px-2 py-1.5 ${e.side === "home" ? "border-brand" : "border-accent"}`}>{e.name} {e.delta > 0 ? "+" : "-"}<Fpts n={Math.abs(e.delta)} />{e.delta >= 8 ? " (big play)" : ""} · {e.line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
