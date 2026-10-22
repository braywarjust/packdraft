"use client";

import { PageLoading } from "@/components/LoadingLogo";
import { TeamBadge, type BrandLite } from "@/components/TeamBadge";
import { TeamLogo } from "@/components/TeamLogo";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { LivePlayer } from "@/lib/league";
import { MatchupCard } from "@/components/MatchupCard";
import { BoostChip } from "@/components/LineupEditor";
import { SlabOn } from "@/components/SlabIcon";
import { Fpts } from "@/components/Fpts";
import { PlayerButton } from "@/components/PlayerInspector";
import type { DayInfo, DayRow } from "@/lib/league";
import { BoxHead, BoxRow, BoxTotals, DayStrip, shortName } from "@/components/BoxScore";

type Side = {
  id: number; name: string; brand: BrandLite; record: string; owner: string | null; score: number; projected: number; remain: number; players: LivePlayer[];
  days: Record<string, DayRow[]>; totals: Record<string, number>;
};
type Other = { id: number; home: { brand: BrandLite; score: number }; away: { brand: BrandLite; score: number } };
type Data = {
  week: number; final: boolean; live: boolean; mode: string; range: string | null; progress: number | null; league: string; leagueId: number;
  home: Side; away: Side; winProb: number; others: Other[]; days: DayInfo[]; day: string; mine: number | null;
};
type Event = { key: string; name: string; delta: number; line: string; side: "home" | "away" };

import { STARTERS } from "@/lib/scoring";
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
  const [day, setDay] = useState<string | null>(null);

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

  if (!d) return <PageLoading text="Loading matchup…" />;
  // Your team always on the left, like ESPN.
  const flip = d.away.id === d.mine;
  const [home, away] = flip ? [d.away, d.home] : [d.home, d.away];
  const wp = flip ? 1 - d.winProb : d.winProb;

  const curDay = day && d.days.some((x) => x.key === day) ? day : d.day;
  const curInfo = d.days.find((x) => x.key === curDay);
  const hRows = home.days[curDay] ?? [], aRows = away.days[curDay] ?? [];
  const hBench = hRows.filter((r) => r.slot === "BN"), aBench = aRows.filter((r) => r.slot === "BN");
  const pairs = [
    ...STARTERS.map((slot) => ({ slot: slot as string, a: hRows.find((r) => r.slot === slot) ?? null, b: aRows.find((r) => r.slot === slot) ?? null })),
    ...Array.from({ length: Math.max(hBench.length, aBench.length) }, (_, i) => ({ slot: "BN", a: hBench[i] ?? null, b: aBench[i] ?? null })),
  ];
  // One side of a head-to-head row: name and game on the outside, fantasy points next to the slot.
  const h2hCell = (r: DayRow | null, right: boolean) => {
    const g = r?.game;
    return (
      <div className={`flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 ${right ? "flex-row-reverse text-right" : ""} ${r && flash.has(r.id) ? "anim-flash" : ""}`}>
        <div className="min-w-0 flex-1">
          {r ? (
            <>
              <p className={`flex items-center gap-1 text-[12px] font-semibold leading-tight text-white ${right ? "justify-end" : ""}`}>
                {right && <TeamLogo team={r.team} size={14} />}
                {right && <SlabOn boost={r.boost} />}
                <PlayerButton id={r.id} className="truncate">{shortName(r.name)}</PlayerButton>
                {!right && <SlabOn boost={r.boost} />}
                {!right && <TeamLogo team={r.team} size={14} />}
              </p>
              <p className={`truncate text-[11px] ${g?.state === "in" ? "font-semibold text-red-500" : "text-zinc-500"}`}>
                {g ? <>{g.state === "in" && "● "}{g.opp} {g.status.replace(/ ET$/, "")}</> : ""}
              </p>
              {r.boost && <p className={`mt-0.5 flex gap-1 ${right ? "justify-end" : ""}`}><BoostChip boost={r.boost} /></p>}
            </>
          ) : <p className="text-xs text-zinc-500">Empty</p>}
        </div>
        <span className="w-9 shrink-0 text-center font-mono text-[13px] font-black text-white">{r?.fpts != null ? r.fpts.toFixed(1) : "-"}</span>
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
        status={d.final ? "final" : d.live || home.score + away.score > 0 ? "live" : "pre"} winProb={wp} />
      {history.length > 1 && <div className="card px-4 pb-3 pt-2"><p className="label">Win probability over the week</p><Spark points={flip ? history.map((x) => 1 - x) : history} /></div>}

      {/* The week's other matchups */}
      {d.others.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin">
          {d.others.map((o) => (
            <Link key={o.id} href={`/league/${d.leagueId}/matchup/${o.id}`} replace
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs ring-1 transition ${o.id === matchupId ? "bg-white/10 ring-white/60" : "bg-panel ring-line hover:ring-white/30"}`}>
              <TeamBadge brand={o.home.brand} size={22} />
              <b className="font-mono text-white">{Math.round(o.home.score)}</b><span className="text-zinc-500">vs</span><b className="font-mono text-white">{Math.round(o.away.score)}</b>
              <TeamBadge brand={o.away.brand} size={22} />
            </Link>
          ))}
        </div>
      )}

      {/* Score by day */}
      <div className="card overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="sticky left-0 bg-panel px-3 py-2 text-left">Team</th>
              {d.days.map((x) => <th key={x.key} className={`whitespace-nowrap px-2 py-2 text-center ${x.key === curDay ? "text-brand" : ""}`}>{x.top === "SIM" ? x.short : x.top}</th>)}
              <th className="px-3 py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {[home, away].map((sd) => (
              <tr key={sd.id} className="border-t border-line/60">
                <td className="sticky left-0 bg-panel px-3 py-2"><span className="flex items-center gap-2"><TeamBadge brand={sd.brand} size={20} /><span className="max-w-[110px] truncate font-semibold text-white">{sd.name}</span></span></td>
                {d.days.map((x) => (
                  <td key={x.key} className={`px-2 py-2 text-center font-mono ${x.key === curDay ? "bg-brand/10 font-bold text-white" : "text-zinc-400"}`}>
                    <button type="button" onClick={() => setDay(x.key)} className="w-full">{sd.totals[x.key] ? sd.totals[x.key].toFixed(1) : "0"}</button>
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-mono text-sm font-black text-white">{sd.score.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 2xl:grid-cols-3">
        <div className="space-y-4 2xl:col-span-2">
          <div className="card p-3"><DayStrip days={d.days} day={curDay} onDay={setDay} /></div>

          {/* Phones: head to head by slot, ESPN app style */}
          <div className="card divide-y divide-line/60 overflow-hidden sm:hidden">
            {pairs.map(({ slot, a, b }, i) => (
              <div key={`${slot}${i}`} className={`flex items-stretch ${slot === "BN" ? "opacity-70" : ""}`}>
                {h2hCell(a, false)}
                <span className="flex w-9 shrink-0 items-center justify-center bg-panel2 text-[10px] font-black text-zinc-400">{slot === "BN" ? "BN" : lbl(slot)}</span>
                {h2hCell(b, true)}
              </div>
            ))}
            <div className="flex items-center justify-between bg-panel2 px-3 py-2 font-mono text-sm font-black text-white">
              <span><Fpts n={home.totals[curDay] ?? 0} /></span>
              <span className="font-sans text-[10px] uppercase tracking-widest text-zinc-400">{curInfo?.label}</span>
              <span><Fpts n={away.totals[curDay] ?? 0} /></span>
            </div>
          </div>

          {/* Bigger screens: both box scores */}
          {[home, away].map((sd) => {
            const rows = sd.days[curDay] ?? [];
            const by = new Map(rows.filter((r) => r.slot !== "BN").map((r) => [r.slot, r]));
            return (
              <section key={sd.id} className="card hidden overflow-hidden sm:block">
                <h3 className="flex items-center gap-2 border-b border-line/60 px-4 py-3 font-black text-white">
                  <TeamBadge brand={sd.brand} size={26} />{sd.name} box score
                  <span className="ml-auto font-mono text-base"><Fpts n={sd.totals[curDay] ?? 0} /></span>
                </h3>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[900px] text-sm">
                    <BoxHead dayLabel={curInfo?.top ?? ""} />
                    <tbody>
                      {STARTERS.map((slot) => <BoxRow key={slot} r={by.get(slot) ?? null} slotCell={<span className={`pos pos-${lbl(slot)}`}>{lbl(slot)}</span>} />)}
                      <BoxTotals rows={STARTERS.map((x) => by.get(x)).filter(Boolean) as DayRow[]} total={sd.totals[curDay] ?? 0} />
                      {rows.filter((r) => r.slot === "BN").map((r) => <BoxRow key={r.id} r={r} slotCell={<span className="pos">BN</span>} highlight="opacity-75" />)}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
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
