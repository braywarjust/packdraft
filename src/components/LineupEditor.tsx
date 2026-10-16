"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { LivePlayer } from "@/lib/league";
import { Headshot, InjuryTag } from "./Headshot";

const STARTERS = ["G1", "G2", "F1", "F2", "C", "UTIL1", "UTIL2", "UTIL3"];
const lbl = (s: string) => s.replace(/\d$/, "");
const eligible = (slot: string, pos: string) => slot === "BN" || lbl(slot) === "UTIL" || lbl(slot) === pos;

export function LineupEditor({
  players, editable, setSlot, autoSet, drop,
}: {
  players: LivePlayer[];
  editable: boolean;
  setSlot?: (playerId: number, slot: string) => Promise<{ error?: string } | unknown>;
  autoSet?: () => Promise<unknown>;
  drop?: (playerId: number) => Promise<{ error?: string } | unknown>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      const r = (await fn()) as { error?: string } | undefined;
      setErr(r?.error ?? "");
      setSelected(null);
      router.refresh();
    });

  const bySlot = new Map(players.filter((p) => p.slot !== "BN").map((p) => [p.slot, p]));
  const bench = players.filter((p) => p.slot === "BN");
  const sel = players.find((p) => p.id === selected);
  const weekPts = players.reduce((s, p) => s + p.pts, 0);

  const row = (slot: string, p: LivePlayer | undefined) => {
    const canTarget = editable && sel && sel.id !== p?.id && eligible(slot, sel.pos) && !(p && p.locked) && !sel.locked;
    const today = p?.now;
    return (
      <tr key={slot + (p?.id ?? "")} className={`border-t border-line/60 ${selected === p?.id ? "bg-brand/10" : ""} ${canTarget ? "bg-red-500/5" : ""}`}>
        <td className="py-2 pl-3"><span className={`pos pos-${lbl(slot)}`}>{lbl(slot)}</span></td>
        <td className="py-2">
          {p ? (
            <div className="flex items-center gap-2">
              <Headshot src={p.headshot} name={p.name} size={36} />
              <div className="min-w-0">
                <p className="font-semibold">{p.name} <span className="text-xs font-normal text-zinc-400">{p.pos} · {p.team}</span> <InjuryTag injury={p.injury} /> {p.locked && <span title="Locked: game started" className="text-xs">🔒</span>}</p>
                <p className="truncate text-xs text-zinc-500">
                  {today ? (today.state === "in" ? <span className="text-red-600">● {today.clock} {today.label} </span> : `${today.label} · ${today.clock} `) : "No games this week "}
                  {today?.line && today.state !== "pre" ? `· ${today.line}` : ""}
                </p>
              </div>
            </div>
          ) : <span className="text-zinc-400">Empty</span>}
        </td>
        <td className="text-center text-xs text-zinc-500">{p ? `${p.played}/${p.total}` : ""}</td>
        <td className="text-right font-mono text-zinc-500">{p ? p.proj.toFixed(1) : ""}</td>
        <td className="pr-3 text-right font-mono font-bold">{p ? p.pts.toFixed(1) : ""}</td>
        {editable && (
          <td className="py-2 pr-3 text-right">
            {canTarget ? (
              <button className="btn-lime px-2 py-1 text-xs" disabled={pending} onClick={() => act(() => setSlot!(sel!.id, slot))}>Move here</button>
            ) : p && !p.locked ? (
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setSelected(selected === p.id ? null : p.id)}>{selected === p.id ? "Cancel" : "Move"}</button>
            ) : null}
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={pending} onClick={() => act(() => autoSet!())}>⚡ Start my active players</button>
          {sel && (
            <>
              <span className="text-sm text-zinc-700">Moving <b>{sel.name}</b>: pick a highlighted slot</span>
              {sel.slot !== "BN" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => act(() => setSlot!(sel.id, "BN"))}>Bench him</button>}
              <button className="btn-danger px-2 py-1 text-xs" onClick={() => { if (confirm(`Drop ${sel.name}?`)) act(() => drop!(sel.id)); }}>Drop</button>
            </>
          )}
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-panel2 text-xs uppercase text-zinc-500">
            <tr><th className="py-2 pl-3 text-left">Slot</th><th className="text-left">Player</th><th>GP</th><th className="text-right">Proj/g</th><th className="pr-3 text-right">Wk pts</th>{editable && <th />}</tr>
          </thead>
          <tbody>
            {STARTERS.map((s) => row(s, bySlot.get(s)))}
            <tr className="border-t border-line bg-panel2/60">
              <td colSpan={4} className="py-2 pl-3 text-xs font-bold uppercase text-zinc-500">Week total (starters only count)</td>
              <td className="pr-3 text-right font-mono font-bold">{weekPts.toFixed(1)}</td>{editable && <td />}
            </tr>
            {bench.map((p) => row("BN", p))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
