"use client";

import { TeamBadge, type BrandLite } from "@/components/TeamBadge";
import { TeamLogo } from "@/components/TeamLogo";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LivePlayer } from "@/lib/league";
import { InjuryTag } from "@/components/Headshot";
import { inkOn, isLight } from "@/lib/color";
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

  // Each starter gets a row tinted in his fantasy team's colour, with his photo large and faded in from the outer edge.
  const cell = (p: LivePlayer | undefined, right: boolean, brand: BrandLite) => {
    const fade = `linear-gradient(${right ? "to left" : "to right"}, #000 30%, transparent 92%)`;
    const light = isLight(brand.color);
    return (
      <div className={`relative min-h-[76px] min-w-0 flex-1 overflow-hidden rounded-xl ring-1 ring-white/5 ${p && flash.has(p.id) ? "anim-flash" : ""}`}
        style={{ background: light ? brand.color : `linear-gradient(${right ? 270 : 90}deg, transparent 25%, rgba(8,10,16,.45)), ${brand.color}`, color: inkOn(brand.color) }}>
        {p ? (
          <>
            {p.headshot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.headshot} alt="" aria-hidden loading="lazy"
                className={`pointer-events-none absolute top-1 h-[125%] w-auto max-w-none select-none opacity-90 ${right ? "-right-3" : "-left-3"}`}
                style={{ maskImage: fade, WebkitMaskImage: fade }} />
            )}
            <div className={`relative flex h-full items-center gap-2 py-2.5 ${right ? "flex-row-reverse pl-3 pr-[84px] text-right" : "pl-[84px] pr-3"}`}>
              <div className="min-w-0 flex-1">
                <p className={`flex items-center gap-1.5 text-[15px] font-black leading-tight ${right ? "flex-row-reverse" : ""}`}><span className="truncate">{p.name}</span><InjuryTag injury={p.injury} /><BoostChip boost={p.boost} /></p>
                <p className="mt-0.5 truncate text-[11px] font-semibold opacity-90">
                  <TeamLogo team={p.team} size={13} className="-mt-0.5 mr-1 align-middle" />{p.team} ·{" "}
                  {p.now ? (p.now.state === "in" ? <span className={`font-bold ${light ? "text-red-700" : "text-red-300"}`}>● {p.now.clock} </span> : p.now.state === "post" ? `${p.now.clock} ` : `${p.now.label} ${p.now.clock} `) : "No games "}
                  {p.now?.line && p.now.state !== "pre" ? `· ${p.now.line}` : ""}
                </p>
                <p className="text-[10px] font-semibold opacity-80">{p.played}/{p.total} games · {p.left} left · <Fpts n={p.proj} />/g</p>
              </div>
              <p className="font-mono text-xl font-black"><Fpts n={p.pts} iconClass="text-[0.8em]" /></p>
            </div>
          </>
        ) : <span className="flex h-full items-center px-4 text-sm text-zinc-500">Empty</span>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Link href={`/league/${leagueId}`} className="text-sm text-zinc-500 hover:text-zinc-900">← {d.league}</Link>
      {/* Branded header: the two teams' colours split on a diagonal (same as the matchup cards), big logos facing off. */}
      <div className="relative overflow-hidden rounded-2xl shadow-xl ring-1 ring-white/10" style={{ background: away.brand.color }}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ clipPath: "polygon(0 0, 54% 0, 46% 100%, 0 100%)", background: home.brand.color }}>
          <div className="absolute left-1/4 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"><TeamBadge brand={home.brand} size={320} ghost /></div>
        </div>
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ clipPath: "polygon(54% 0, 100% 0, 100% 100%, 46% 100%)", background: away.brand.color }}>
          <div className="absolute left-3/4 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.16]"><TeamBadge brand={away.brand} size={320} ghost /></div>
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="54" y1="0" x2="46" y2="100" stroke="#fff" strokeOpacity=".55" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 p-5 sm:p-6">
          <div className={`flex min-w-0 flex-col items-start gap-3 `}>
            <div className={`flex min-w-0 items-center gap-3 `}>
              <TeamBadge brand={home.brand} size={76} className="drop-shadow-xl" />
              <div className="min-w-0">
                <p className="truncate text-xl font-black leading-tight sm:text-2xl" style={{ color: inkOn(home.brand.color) }}>{home.name}</p>
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-75" style={{ color: inkOn(home.brand.color) }}>{home.brand.abbr} · {home.record}</p>
              </div>
            </div>
            <div className="rounded-xl bg-black/55 px-4 py-2 shadow-lg ring-1 ring-white/10">
              <p className="font-mono text-4xl font-black leading-none text-white sm:text-5xl"><Fpts n={home.score} iconClass="text-[0.7em]" /></p>
              <p className="mt-1 font-mono text-xs font-bold text-white/85"><span className="text-[10px] font-black uppercase tracking-widest text-fpts">Proj </span><Fpts n={home.score + home.remain} /></p>
            </div>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-black/55 px-3 py-2 text-center ring-1 ring-white/10">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">Week {d.week}</p>
            {d.range && <p className="text-[10px] text-white/60">{d.range}</p>}
            <p className={`mt-1 text-sm font-black ${d.final ? "text-white" : d.live ? "text-red-400" : "text-white/80"}`}>{d.final ? "FINAL" : d.live ? "● LIVE" : "In progress"}</p>
            {d.progress != null && d.progress > 0 && !d.final && <p className="text-[10px] text-white/60">{Math.round(d.progress * 100)}% of sim week</p>}
          </div>
          <div className={`flex min-w-0 flex-col gap-3 items-end text-right`}>
            <div className={`flex min-w-0 items-center gap-3 flex-row-reverse`}>
              <TeamBadge brand={away.brand} size={76} className="drop-shadow-xl" />
              <div className="min-w-0">
                <p className="truncate text-xl font-black leading-tight sm:text-2xl" style={{ color: inkOn(away.brand.color) }}>{away.name}</p>
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-75" style={{ color: inkOn(away.brand.color) }}>{away.brand.abbr} · {away.record}</p>
              </div>
            </div>
            <div className="rounded-xl bg-black/55 px-4 py-2 shadow-lg ring-1 ring-white/10">
              <p className="font-mono text-4xl font-black leading-none text-white sm:text-5xl"><Fpts n={away.score} iconClass="text-[0.7em]" /></p>
              <p className="mt-1 font-mono text-xs font-bold text-white/85"><span className="text-[10px] font-black uppercase tracking-widest text-fpts">Proj </span><Fpts n={away.score + away.remain} /></p>
            </div>
          </div>
        </div>
        <div className="relative bg-black/55 px-5 py-3">
          <div className="flex justify-between text-xs font-bold text-white"><span>{hp}%</span><span className="text-white/60">Win probability</span><span>{100 - hp}%</span></div>
          <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
            <div className="transition-all duration-700" style={{ width: `${hp}%`, background: home.brand.color }} />
            <div className="flex-1" style={{ background: away.brand.color }} />
          </div>
          <Spark points={history} />
        </div>
      </div>

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
