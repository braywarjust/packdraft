"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LivePlayer } from "@/lib/league";

type Side = { id: number; name: string; record: string; score: number; projected: number; remain: number; players: LivePlayer[] };
type Data = { week: number; final: boolean; started: boolean; progress: number; league: string; home: Side; away: Side; winProb: number };
type Event = { key: string; text: string; pts: number; side: "home" | "away"; at: number };

const STARTERS = ["QB", "RB1", "RB2", "WR1", "WR2", "TE", "FLEX", "DST"];

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-16" />;
  const w = 300, h = 64;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * w},${h - p * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" preserveAspectRatio="none">
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
    const load = async () => {
      const r = await fetch(`/api/live/${matchupId}`, { cache: "no-store" });
      if (!r.ok || stop) return;
      const j = (await r.json()) as Data;
      setD(j);
      if (j.started && !j.final) setHistory((h) => [...h.slice(-120), j.winProb]);
      // Turn point changes into a scoring ticker.
      const newEvents: Event[] = [];
      const changed = new Set<number>();
      for (const side of ["home", "away"] as const) {
        for (const p of j[side].players) {
          const before = prev.current.get(p.id);
          if (before !== undefined && Math.abs(p.pts - before) >= 0.5 && p.slot !== "BN") {
            const delta = p.pts - before;
            changed.add(p.id);
            newEvents.push({ key: `${p.id}-${Date.now()}`, side, pts: delta, at: Date.now(), text: `${p.name} ${delta > 0 ? "+" : ""}${delta.toFixed(1)}${delta >= 5.5 ? " 🔥 TD!" : ""} · ${p.line}` });
          }
          prev.current.set(p.id, p.pts);
        }
      }
      if (newEvents.length) {
        setEvents((e) => [...newEvents, ...e].slice(0, 25));
        setFlash(changed);
      }
      if (!j.final && j.started) setTimeout(load, 2000);
      else if (!j.started) setTimeout(load, 6000);
    };
    load();
    return () => { stop = true; };
  }, [matchupId]);

  if (!d) return <p className="text-slate-400">Loading matchup…</p>;
  const { home, away } = d;
  const hp = Math.round(d.winProb * 100);

  const playerCell = (p: LivePlayer | undefined, align: "left" | "right") => (
    <div className={`flex-1 ${align === "right" ? "text-right" : ""} ${p && flash.has(p.id) ? "anim-flash" : ""} rounded-lg px-2 py-1.5`}>
      {p ? (
        <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse" : ""}`}>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{p.name} <span className="text-xs font-normal text-slate-500">{p.pos} {p.team}</span></p>
            <p className="truncate text-xs text-slate-400">{p.g > 0 ? p.line : `Matchup ${p.grade}`}</p>
            <div className={`mt-1 h-1 w-full overflow-hidden rounded bg-panel2 ${align === "right" ? "rotate-180" : ""}`}>
              <div className="h-full bg-slate-400" style={{ width: `${p.g * 100}%` }} />
            </div>
          </div>
          <div className={align === "right" ? "text-left" : "text-right"}>
            <p className="font-mono text-lg font-black">{d.started ? p.pts.toFixed(1) : "—"}</p>
            <p className="text-[10px] text-slate-500">{p.clock} · {p.proj.toFixed(1)}p</p>
          </div>
        </div>
      ) : <span className="text-slate-600">Empty</span>}
    </div>
  );

  return (
    <div className="space-y-4">
      <Link href={`/league/${leagueId}`} className="text-sm text-slate-400 hover:text-white">← {d.league}</Link>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-3 items-center gap-2 p-5">
          <div>
            <p className="text-lg font-black">{home.name}</p>
            <p className="text-xs text-slate-400">{home.record} · proj {home.projected.toFixed(1)}</p>
            <p className="mt-1 font-mono text-5xl font-black">{home.score.toFixed(1)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest text-slate-400">Week {d.week}</p>
            <p className={`mt-1 text-sm font-bold ${d.final ? "text-slate-300" : d.started ? "text-rose-300" : "text-slate-400"}`}>{d.final ? "FINAL" : d.started ? "● LIVE" : "Not started"}</p>
            {d.started && !d.final && <p className="text-xs text-slate-500">{Math.round(d.progress * 100)}% of games played</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-black">{away.name}</p>
            <p className="text-xs text-slate-400">{away.record} · proj {away.projected.toFixed(1)}</p>
            <p className="mt-1 font-mono text-5xl font-black">{away.score.toFixed(1)}</p>
          </div>
        </div>
        <div className="px-5 pb-4">
          <div className="flex justify-between text-xs font-bold"><span className="text-brand">{hp}%</span><span className="text-slate-400">Win probability</span><span className="text-fuchsia-300">{100 - hp}%</span></div>
          <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-panel2">
            <div className="bg-brand transition-all duration-700" style={{ width: `${hp}%` }} />
            <div className="flex-1 bg-fuchsia-500" />
          </div>
          {history.length > 1 && <Spark points={history} />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-2 lg:col-span-2">
          {STARTERS.map((slot) => (
            <div key={slot} className="flex items-center gap-2 border-b border-line/40 last:border-0">
              {playerCell(home.players.find((p) => p.slot === slot), "left")}
              <span className={`pos pos-${slot.replace(/\d$/, "")}`}>{slot.replace(/\d$/, "")}</span>
              {playerCell(away.players.find((p) => p.slot === slot), "right")}
            </div>
          ))}
          <details className="mt-2 px-2 pb-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase text-slate-400">Benches</summary>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
              {[home, away].map((s) => (
                <ul key={s.id} className="space-y-1">
                  {s.players.filter((p) => p.slot === "BN").map((p) => <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="font-mono">{p.pts.toFixed(1)}</span></li>)}
                </ul>
              ))}
            </div>
          </details>
        </div>
        <div className="card p-4">
          <p className="label">Live scoring feed</p>
          {events.length === 0 && <p className="text-sm text-slate-500">{d.started && !d.final ? "Waiting for the next big play…" : d.final ? "This one's in the books." : "Kicks off when the commish starts the week."}</p>}
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
