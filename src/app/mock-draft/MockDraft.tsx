"use client";

import { useEffect, useMemo, useState } from "react";
import { BoardPick, DraftBoard, PlayerPool, PoolPlayer } from "@/components/draft-ui";

const ROUNDS = 13;
const LIMITS: Record<string, number> = { G: 7, F: 7, C: 4 };

function botChoice(pool: PoolPlayer[], mine: PoolPlayer[], round: number) {
  const count = (pos: string) => mine.filter((p) => p.pos === pos).length;
  const ok = (p: PoolPlayer) => {
    if (count(p.pos) >= LIMITS[p.pos]) return false;
    if (round >= ROUNDS - 1 && count("C") === 0) return p.pos === "C";
    return true;
  };
  const c = pool.filter(ok).slice(0, 4);
  const r = Math.random();
  return (c[r < 0.6 ? 0 : r < 0.82 ? 1 : r < 0.94 ? 2 : 3] ?? c[0] ?? pool[0]).id;
}

export function MockDraft({ players, userName }: { players: PoolPlayer[]; userName: string }) {
  const [teams, setTeams] = useState(8);
  const [slot, setSlot] = useState(1);
  const [started, setStarted] = useState(false);
  const [picks, setPicks] = useState<(BoardPick & { id: number })[]>([]);

  const order = useMemo(
    () => Array.from({ length: teams }, (_, i) => ({
      id: i + 1, name: i + 1 === slot ? "You" : `Bot ${i + 1}`, owner: i + 1 === slot ? userName : "CPU", color: i + 1 === slot ? "#22d3ee" : "#475569",
    })),
    [teams, slot, userName],
  );
  const total = teams * ROUNDS;
  const overall = picks.length + 1;
  const done = picks.length >= total;
  const round = Math.floor((overall - 1) / teams) + 1;
  const idx = (overall - 1) % teams;
  const onClock = round % 2 === 1 ? idx + 1 : teams - idx;
  const taken = new Set(picks.map((p) => p.id));
  const pool = players.filter((p) => !taken.has(p.id));

  const add = (teamId: number, id: number) => {
    const p = players.find((x) => x.id === id)!;
    setPicks((prev) => [...prev, { overall: prev.length + 1, round, team_id: teamId, id, name: p.name, pos: p.pos, team: p.team }]);
  };

  useEffect(() => {
    if (!started || done || onClock === slot) return;
    const t = setTimeout(() => {
      const mine = picks.filter((p) => p.team_id === onClock).map((p) => players.find((x) => x.id === p.id)!);
      add(onClock, botChoice(pool, mine, round));
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, picks.length, onClock, slot, done]);

  const mine = picks.filter((p) => p.team_id === slot);

  if (!started)
    return (
      <div className="mx-auto max-w-lg card space-y-4 p-6">
        <h1 className="text-2xl font-black">Mock draft</h1>
        <p className="text-sm text-zinc-500">Practice against bots that draft by ADP. Nothing here counts. Picks come fast.</p>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Teams</label>
            <select className="input" value={teams} onChange={(e) => { setTeams(Number(e.target.value)); setSlot(1); }}>
              {[4, 6, 8, 10, 12].map((n) => <option key={n}>{n}</option>)}
            </select></div>
          <div><label className="label">Your pick</label>
            <select className="input" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
              {Array.from({ length: teams }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
            </select></div>
        </div>
        <button className="btn-lime w-full" onClick={() => setStarted(true)}>Start mock draft</button>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs uppercase text-zinc-500">Mock draft · {teams} teams · pick {slot}</p>
          <p className="text-xl font-black">{done ? "Draft complete!" : onClock === slot ? "🚨 You're on the clock" : `Bot ${onClock} is picking…`}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setPicks([])}>Restart</button>
          <button className="btn-ghost" onClick={() => { setStarted(false); setPicks([]); }}>Settings</button>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><DraftBoard order={order} picks={picks} rounds={ROUNDS} currentOverall={done ? null : overall} myTeamId={slot} /></div>
        <div className="space-y-4">
          {!done && <PlayerPool players={pool} canPick={onClock === slot} onPick={(id) => add(slot, id)} />}
          <div className="card p-3">
            <p className="label">Your team ({mine.reduce((s, p) => s + (players.find((x) => x.id === p.id)?.proj ?? 0), 0).toFixed(1)} proj pts/g)</p>
            <ul className="space-y-1 text-sm">{mine.map((p) => <li key={p.id}><span className={`pos pos-${p.pos} mr-2`}>{p.pos}</span>{p.name}</li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}
