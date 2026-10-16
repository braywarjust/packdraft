"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type P = { id: number; name: string; pos: string; proj: number };

export function TradeBuilder({
  myTeamId, teams, rosters, initialTo, propose,
}: {
  myTeamId: number;
  teams: { id: number; name: string; cpu: boolean }[];
  rosters: Record<number, P[]>;
  initialTo?: number;
  propose: (to: number, give: number[], get: number[], note: string) => Promise<unknown>;
}) {
  const router = useRouter();
  const [to, setTo] = useState<number>(initialTo ?? teams[0]?.id);
  const [give, setGive] = useState<number[]>([]);
  const [get, setGet] = useState<number[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const [pending, start] = useTransition();
  const toggle = (arr: number[], set: (v: number[]) => void, id: number) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const val = (ids: number[], list: P[]) => ids.reduce((s, id) => s + (list.find((p) => p.id === id)?.proj ?? 0), 0);
  const mine = rosters[myTeamId] ?? [];
  const theirs = rosters[to] ?? [];
  const partner = teams.find((t) => t.id === to);

  const list = (players: P[], sel: number[], set: (v: number[]) => void) => (
    <ul className="max-h-80 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
      {players.map((p) => (
        <li key={p.id}>
          <button onClick={() => toggle(sel, set, p.id)} className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${sel.includes(p.id) ? "bg-brand/20 ring-1 ring-brand" : "hover:bg-panel2"}`}>
            <span><span className={`pos pos-${p.pos} mr-2`}>{p.pos}</span>{p.name}</span>
            <span className="font-mono text-xs text-zinc-500">{p.proj.toFixed(1)}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Build a trade</h2>
        <select value={to} onChange={(e) => { setTo(Number(e.target.value)); setGet([]); }} className="input w-60">
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}{t.cpu ? " (CPU)" : ""}</option>)}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="label">You send ({val(give, mine).toFixed(1)} pts/g)</p>{list(mine, give, setGive)}</div>
        <div><p className="label">You get ({val(get, theirs).toFixed(1)} pts/g)</p>{list(theirs, get, setGet)}</div>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Add some persuasion (or trash talk)…" />
      {partner?.cpu && <p className="text-xs text-zinc-500">CPU managers respond instantly and want a little more projected value back than they give.</p>}
      <div className="flex items-center gap-3">
        <button
          className="btn-primary"
          disabled={pending || (!give.length && !get.length)}
          onClick={() =>
            start(async () => {
              const r = (await propose(to, give, get, note)) as { error?: string; message?: string };
              if (r?.error) setMsg({ t: r.error, bad: true });
              else {
                setMsg({ t: r?.message ?? "Sent", bad: false });
                setGive([]); setGet([]); setNote("");
                router.refresh();
              }
            })
          }
        >
          Send offer
        </button>
        {msg && <span className={`text-sm ${msg.bad ? "text-red-600" : "text-emerald-600"}`}>{msg.t}</span>}
      </div>
    </div>
  );
}
