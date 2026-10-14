"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { LivePlayer } from "@/lib/league";

const STARTERS = ["QB", "RB1", "RB2", "WR1", "WR2", "TE", "FLEX", "DST"];
const eligible = (slot: string, pos: string) =>
  slot === "BN" ? true : slot === "FLEX" ? ["RB", "WR", "TE"].includes(pos) : slot.replace(/\d$/, "") === pos;
const gradeColor = (g: string) => (g.startsWith("A") ? "text-emerald-300" : g === "B" ? "text-lime-300" : g === "C" ? "text-slate-300" : g === "D" ? "text-amber-300" : "text-rose-300");

type Row = LivePlayer & { locked: boolean };

export function LineupEditor({
  players, editable, live, setSlot, autoSet, drop,
}: {
  players: Row[];
  editable: boolean;
  live: boolean;
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
  const total = players.filter((p) => p.slot !== "BN").reduce((s, p) => s + (live ? p.pts : p.proj), 0);

  const row = (slot: string, p: Row | undefined) => {
    const canTarget = editable && sel && sel.id !== p?.id && eligible(slot, sel.pos) && !(p && p.locked) && !sel.locked;
    return (
      <tr key={slot + (p?.id ?? "")} className={`border-t border-line/60 ${selected === p?.id ? "bg-brand/10" : ""} ${canTarget ? "bg-lime-400/5" : ""}`}>
        <td className="py-2 pl-3"><span className={`pos pos-${slot.replace(/\d$/, "")}`}>{slot.replace(/\d$/, "")}</span></td>
        <td className="py-2">
          {p ? (
            <div>
              <p className="font-semibold">{p.name} {p.locked && <span title="Game started" className="text-xs">🔒</span>}</p>
              <p className="text-xs text-slate-400">{p.pos} · {p.team} · <span className={gradeColor(p.grade)}>Matchup {p.grade}</span> · {p.clock}</p>
              {live && p.g > 0 && <p className="text-xs text-slate-500">{p.line}</p>}
            </div>
          ) : <span className="text-slate-500">Empty</span>}
        </td>
        <td className="text-right font-mono text-slate-400">{p ? p.proj.toFixed(1) : ""}</td>
        {live && <td className="text-right font-mono font-bold">{p ? p.pts.toFixed(1) : ""}</td>}
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
          <button className="btn-primary" disabled={pending} onClick={() => act(() => autoSet!())}>⚡ Auto-set best lineup</button>
          {sel && (
            <>
              <span className="text-sm text-slate-300">Moving <b>{sel.name}</b>: pick a highlighted slot</span>
              {sel.slot !== "BN" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => act(() => setSlot!(sel.id, "BN"))}>Bench him</button>}
              <button className="btn-danger px-2 py-1 text-xs" onClick={() => { if (confirm(`Drop ${sel.name}?`)) act(() => drop!(sel.id)); }}>Drop</button>
            </>
          )}
          {err && <span className="text-sm text-rose-300">{err}</span>}
        </div>
      )}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel2 text-xs uppercase text-slate-400">
            <tr><th className="py-2 pl-3 text-left">Slot</th><th className="text-left">Player</th><th className="text-right">Proj</th>{live && <th className="text-right">Pts</th>}{editable && <th />}</tr>
          </thead>
          <tbody>
            {STARTERS.map((s) => row(s, bySlot.get(s)))}
            <tr className="border-t border-line bg-panel2/60"><td colSpan={2} className="py-2 pl-3 text-xs font-bold uppercase text-slate-400">Starters total</td>
              <td colSpan={1 + (live ? 1 : 0) + (editable ? 1 : 0)} className="pr-3 text-right font-mono font-bold">{total.toFixed(1)}</td></tr>
            {bench.map((p) => row("BN", p))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
