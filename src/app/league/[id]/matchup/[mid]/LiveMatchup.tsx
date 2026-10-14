"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LivePlayer } from "@/lib/league";
import { Headshot, InjuryTag } from "@/components/Headshot";

type Side = { id: number; name: string; record: string; score: number; projected: number; remain: number; players: LivePlayer[] };
type Data = { week: number; final: boolean; live: boolean; mode: string; range: string | null; progress: number | null; league: string; home: Side; away: Side; winProb: number };
type Event = { key: string; text: string; side: "home" | "away" };

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
              newEvents.push({ key: `${p.id}-${Date.now()}`, side, text: `${p.name} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}${delta >= 8 ? " 🔥" : ""} · ${p.now?.line ?? ""}` });
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

  if (!d) return <p className="text-slate-400">Loading matchup…</p>;
  const { home, away } = d;
  const hp = Math.round(d.winProb * 100);

  const cell = (p: LivePlayer | undefined, right: boolean) => (
    <div className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 ${p && flash.has(p.id) ? "anim-flash" : ""}`}>
      {p ? (
        <div className={`flex items-center gap-2 ${right ? "flex-row-reverse text-right" : ""}`}>
          <Headshot src={p.headshot} name={p.name} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{p.name} <span className="text-xs font-normal text-slate-500">{p.team}</span> <InjuryTag injury={p.injury} /></p>
            <p className="truncate text-[11px] text-slate-400">
              {p.now ? (p.now.state === "in" ? <span className="text-rose-300">● {p.now.clock} </span> : p.now.state === "post" ? `${p.now.clock} ` : `${p.now.label} ${p.now.clock} `) : "No games "}
              {p.now?.line && p.now.state !== "pre" ? `· ${p.now.line}` : ""}
            </p>
            <p className="text-[10px] text-slate-500">{p.played}/{p.total} games · {p.left} left · {p.proj.toFixed(1)}/g</p>
          </div>
          <p className="font-mono text-lg font-black">{p.pts.toFixed(1)}</p>
        </div>
      ) : <span className="text-sm text-slate-600">Empty</span>}
    </div>
  );

  return (
    <div className="space-y-4">
      <Link href={`/league/${leagueId}`} className="text-sm text-slate-400 hover:text-white">← {d.league}</Link>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-3 items-center gap-2 p-5">
          <div>
            <p className="text-lg font-black">{home.name}</p>
            <p className="text-xs text-slate-400">{home.record} · proj {(home.score + home.remain).toFixed(1)}</p>
            <p className="mt-1 font-mono text-4xl font-black sm:text-5xl">{home.score.toFixed(1)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-slate-400">Week {d.week}</p>
            {d.range && <p className="text-[11px] text-slate-500">{d.range}</p>}
            <p className={`mt-1 text-sm font-bold ${d.final ? "text-slate-300" : d.live ? "text-rose-300" : "text-slate-400"}`}>{d.final ? "FINAL" : d.live ? "● LIVE" : "In progress"}</p>
            {d.progress != null && d.progress > 0 && !d.final && <p className="text-xs text-slate-500">{Math.round(d.progress * 100)}% of sim week</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-black">{away.name}</p>
            <p className="text-xs text-slate-400">{away.record} · proj {(away.score + away.remain).toFixed(1)}</p>
            <p className="mt-1 font-mono text-4xl font-black sm:text-5xl">{away.score.toFixed(1)}</p>
          </div>
        </div>
        <div className="px-5 pb-4">
          <div className="flex justify-between text-xs font-bold"><span className="text-brand">{hp}%</span><span className="text-slate-400">Win probability</span><span className="text-fuchsia-300">{100 - hp}%</span></div>
          <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-panel2">
            <div className="bg-brand transition-all duration-700" style={{ width: `${hp}%` }} />
            <div className="flex-1 bg-fuchsia-500" />
          </div>
          <Spark points={history} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-2 lg:col-span-2">
          {STARTERS.map((slot) => (
            <div key={slot} className="flex items-center gap-1 border-b border-line/40 last:border-0">
              {cell(home.players.find((p) => p.slot === slot), false)}
              <span className={`pos pos-${lbl(slot)} shrink-0`}>{lbl(slot)}</span>
              {cell(away.players.find((p) => p.slot === slot), true)}
            </div>
          ))}
          <details className="mt-2 px-2 pb-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase text-slate-400">Benches</summary>
            <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-slate-400">
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
          {events.length === 0 && <p className="text-sm text-slate-500">{d.final ? "This one's in the books." : "Updates roll in here while games are live."}</p>}
          <ul className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.key} className={`anim-deal rounded-lg border-l-2 bg-ink/60 px-2 py-1.5 ${e.side === "home" ? "border-brand" : "border-fuchsia-400"}`}>{e.text}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
