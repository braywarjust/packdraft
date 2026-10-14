"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type P = { id: number; name: string; pos: string; team: string; salary: number; proj: number; grade: string };
const eligible = (slot: string, pos: string) => (slot === "FLEX" ? ["RB", "WR", "TE"].includes(pos) : slot.replace(/\d$/, "") === pos);
const money = (n: number) => `$${n.toLocaleString()}`;

export function LineupBuilder({ players, slots, cap, initial, submit, fee }: {
  players: P[]; slots: string[]; cap: number; initial: number[] | null; submit: (lineup: number[]) => Promise<unknown>; fee: number;
}) {
  const router = useRouter();
  const [lineup, setLineup] = useState<(number | null)[]>(initial ?? slots.map(() => null));
  const [pos, setPos] = useState("ALL");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const used = lineup.reduce<number>((s, id) => s + (id ? byId.get(id)!.salary : 0), 0);
  const proj = lineup.reduce<number>((s, id) => s + (id ? byId.get(id)!.proj : 0), 0);
  const left = cap - used;
  const open = lineup.filter((x) => x === null).length;

  const add = (p: P) => {
    if (lineup.includes(p.id)) return;
    // Prefer the exact position slot, then FLEX.
    let i = slots.findIndex((s, idx) => lineup[idx] === null && s !== "FLEX" && eligible(s, p.pos));
    if (i < 0) i = slots.findIndex((s, idx) => lineup[idx] === null && eligible(s, p.pos));
    if (i < 0) return setMsg({ t: `No open slot for a ${p.pos}`, bad: true });
    setMsg(null);
    setLineup((l) => l.map((x, idx) => (idx === i ? p.id : x)));
  };
  const list = players.filter((p) => (pos === "ALL" || p.pos === pos) && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 100);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card flex h-[560px] flex-col p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {["ALL", "QB", "RB", "WR", "TE", "DST"].map((p) => <button key={p} onClick={() => setPos(p)} className={`tab px-2 py-1 text-xs ${pos === p ? "tab-active" : ""}`}>{p}</button>)}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input ml-auto w-28 py-1 text-xs" />
        </div>
        <ul className="flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
          {list.map((p) => {
            const inL = lineup.includes(p.id);
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-panel2">
                <span className={`pos pos-${p.pos}`}>{p.pos}</span>
                <span className="flex-1 truncate">{p.name} <span className="text-xs text-slate-500">{p.team} · {p.grade}</span></span>
                <span className="font-mono text-xs text-slate-400">{p.proj.toFixed(1)}</span>
                <span className="w-16 text-right font-mono text-xs">{money(p.salary)}</span>
                <button disabled={inL || p.salary > left} onClick={() => add(p)} className="btn-lime px-2 py-0.5 text-xs">+</button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="card space-y-3 p-4">
        <div className="flex justify-between text-sm">
          <span>Remaining <b className={left < 0 ? "text-rose-300" : "text-lime-300"}>{money(left)}</b></span>
          <span className="text-slate-400">Avg/slot left {open ? money(Math.floor(left / open)) : "—"}</span>
          <span>Proj <b>{proj.toFixed(1)}</b></span>
        </div>
        <ul className="space-y-1">
          {slots.map((s, i) => {
            const p = lineup[i] ? byId.get(lineup[i]!) : null;
            return (
              <li key={s} className="flex items-center gap-2 rounded-lg bg-ink/60 px-2 py-2 text-sm">
                <span className={`pos pos-${s.replace(/\d$/, "")}`}>{s.replace(/\d$/, "")}</span>
                <span className="flex-1">{p ? p.name : <span className="text-slate-600">—</span>}</span>
                {p && <><span className="font-mono text-xs">{money(p.salary)}</span><button onClick={() => setLineup((l) => l.map((x, idx) => (idx === i ? null : x)))} className="text-xs text-rose-300">✕</button></>}
              </li>
            );
          })}
        </ul>
        <button
          className="btn-primary w-full"
          disabled={pending || open > 0 || left < 0}
          onClick={() => start(async () => {
            const r = (await submit(lineup as number[])) as { error?: string };
            setMsg(r?.error ? { t: r.error, bad: true } : { t: "Lineup locked in ✓", bad: false });
            router.refresh();
          })}
        >
          {initial ? "Update lineup" : `Enter contest${fee ? ` (${money(fee)})` : ""}`}
        </button>
        {msg && <p className={`text-sm ${msg.bad ? "text-rose-300" : "text-lime-300"}`}>{msg.t}</p>}
      </div>
    </div>
  );
}
