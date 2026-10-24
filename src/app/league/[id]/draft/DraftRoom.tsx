"use client";

import { PageLoading } from "@/components/LoadingLogo";
import { StarIcon } from "@/components/Icons";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BoardPick, BoardTeam, DraftBoard, PlayerPool, PoolPlayer } from "@/components/draft-ui";

type State = {
  status: string; rounds: number; order: (BoardTeam & { auto: boolean })[]; picks: BoardPick[];
  keepers: { team_id: number; round: number; name: string; pos: string }[];
  current: { overall: number; round: number; teamId: number; pickInRound: number } | null;
  deadline: number | null; now: number; myTeamId: number | null; autodraft: boolean; isCommish: boolean;
  available: PoolPlayer[]; queue: number[];
};
type Act = Promise<{ error?: string } | unknown>;

export function DraftRoom({ leagueId, pick, queue, toggleAuto, start }: {
  leagueId: number; pick: (id: number) => Act; queue: (id: number, add: boolean) => Act; toggleAuto: () => Act; start: () => Act;
}) {
  const [s, setS] = useState<State | null>(null);
  const [skew, setSkew] = useState(0);
  const [tick, setTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/draft/${leagueId}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as State;
    setSkew(j.now - Date.now());
    setS(j);
  }, [leagueId]);

  useEffect(() => {
    load();
    const poll = setInterval(() => { if (!document.hidden) load(); }, 1500); // no polling from background tabs
    const clock = setInterval(() => setTick(Date.now()), 250);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  const run = async (fn: () => Act) => {
    setBusy(true);
    const r = (await fn()) as { error?: string } | undefined;
    setErr(r?.error ?? "");
    await load();
    setBusy(false);
  };

  if (!s) return <PageLoading text="Loading draft room…" />;

  const myTurn = s.status === "live" && s.current?.teamId === s.myTeamId;
  const onClock = s.order.find((t) => t.id === s.current?.teamId);
  const left = s.deadline ? Math.max(0, Math.ceil((s.deadline - (tick + skew)) / 1000)) : 0;
  const myPicks = s.picks.filter((p) => p.team_id === s.myTeamId);
  const recent = [...s.picks].reverse().slice(0, 8);

  return (
    <div className="space-y-4">
      {s.status === "pre" && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-lg font-bold">The draft hasn&apos;t started.</p>
            <p className="text-sm text-zinc-500">Snake draft, {s.rounds} rounds. Order is randomized when the League Manager starts it. {s.keepers.length > 0 && `${s.keepers.length} keepers are locked in.`}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/mock-draft" className="btn-ghost">Warm up with a mock draft</Link>
            {s.isCommish && <button className="btn-lime" onClick={() => run(start)}>Start draft</button>}
          </div>
        </div>
      )}
      {s.status === "done" && (
        <div className="card flex items-center justify-between p-5">
          <p className="text-lg font-bold">Draft complete</p>
          <Link href={`/league/${leagueId}/team`} className="btn-primary">See my team →</Link>
        </div>
      )}
      {s.status === "live" && s.current && (
        <div className={`card flex flex-wrap items-center gap-4 p-4 ${myTurn ? "border-brand bg-red-500/5" : ""}`}>
          <div className="text-center">
            <p className="text-xs uppercase text-zinc-500">Pick</p>
            <p className="text-2xl font-black">{s.current.round}.{String(s.current.pickInRound).padStart(2, "0")}</p>
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase text-zinc-500">On the clock</p>
            <p className="text-xl font-black">{myTurn ? "YOU'RE UP" : onClock?.name}</p>
            <p className="text-xs text-zinc-500">{onClock?.cpu ? "CPU picking…" : onClock?.auto ? "Autodrafting…" : onClock?.owner}</p>
          </div>
          {!onClock?.cpu && !onClock?.auto && (
            <div className={`font-mono text-4xl font-black ${left <= 10 ? "text-red-600" : ""}`}>0:{String(left).padStart(2, "0")}</div>
          )}
          {s.myTeamId && (
            <button className={`btn ${s.autodraft ? "bg-brand2 text-white" : "btn-ghost"}`} onClick={() => run(toggleAuto)}>
              {s.autodraft ? "Autodraft ON" : "Autodraft off"}
            </button>
          )}
        </div>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DraftBoard order={s.order} picks={s.picks} rounds={s.rounds} currentOverall={s.current?.overall} myTeamId={s.myTeamId} />
        </div>
        <div className="space-y-4">
          {s.status !== "done" && (
            <PlayerPool
              players={s.available}
              canPick={myTurn}
              busy={busy}
              onPick={(id) => run(() => pick(id))}
              queue={s.queue}
              onQueue={s.myTeamId ? (id, add) => run(() => queue(id, add)) : undefined}
            />
          )}
          {s.queue.length > 0 && (
            <div className="card p-3">
              <p className="label"><StarIcon className="text-amber-600" /> My queue (autopick takes these first)</p>
              <ol className="list-decimal pl-5 text-sm">
                {s.queue.map((id) => <li key={id}>{s.available.find((p) => p.id === id)?.name ?? "Drafted"}</li>)}
              </ol>
            </div>
          )}
          <div className="card p-3">
            <p className="label">My picks</p>
            {myPicks.length === 0 && <p className="text-sm text-zinc-400">None yet</p>}
            <ul className="space-y-1 text-sm">
              {myPicks.map((p) => <li key={p.overall}><span className={`pos pos-${p.pos} mr-2`}>{p.pos}</span>{p.name}</li>)}
            </ul>
          </div>
          <div className="card p-3">
            <p className="label">Recent picks</p>
            <ul className="space-y-1 text-sm">
              {recent.map((p) => (
                <li key={p.overall} className="flex justify-between">
                  <span>{p.name} <span className="text-xs text-zinc-400">{p.pos}</span></span>
                  <span className="text-xs text-zinc-500">{s.order.find((t) => t.id === p.team_id)?.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
