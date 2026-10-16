"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SettingsForm({ action, children }: { action: (f: FormData) => Promise<unknown>; children: React.ReactNode }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card space-y-4 p-5"
      action={(f) =>
        start(async () => {
          const r = (await action(f)) as { error?: string };
          setMsg(r?.error ? { t: r.error, bad: true } : { t: "Saved ✓", bad: false });
          router.refresh();
        })
      }
    >
      {children}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>Save settings</button>
        {msg && <span className={`text-sm ${msg.bad ? "text-red-600" : "text-emerald-600"}`}>{msg.t}</span>}
      </div>
    </form>
  );
}

export function KeeperForm({ teams, players, rounds, action }: {
  teams: { id: number; name: string }[]; players: { id: number; name: string; pos: string }[]; rounds: number;
  action: (teamId: number, playerId: number, round: number) => Promise<unknown>;
}) {
  const router = useRouter();
  const [team, setTeam] = useState(teams[0]?.id);
  const [q, setQ] = useState("");
  const [player, setPlayer] = useState<number | null>(null);
  const [round, setRound] = useState(rounds);
  const [err, setErr] = useState("");
  const matches = q ? players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={team} onChange={(e) => setTeam(Number(e.target.value))} className="input">{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select value={round} onChange={(e) => setRound(Number(e.target.value))} className="input">{Array.from({ length: rounds }, (_, i) => <option key={i} value={i + 1}>Round {i + 1}</option>)}</select>
      </div>
      <input value={q} onChange={(e) => { setQ(e.target.value); setPlayer(null); }} className="input" placeholder="Search player to keep" />
      {matches.length > 0 && !player && (
        <ul className="rounded-lg border border-line">
          {matches.map((p) => <li key={p.id}><button className="w-full px-3 py-1.5 text-left text-sm hover:bg-panel2" onClick={() => { setPlayer(p.id); setQ(p.name); }}>{p.pos} · {p.name}</button></li>)}
        </ul>
      )}
      <button
        className="btn-ghost"
        disabled={!player}
        onClick={async () => {
          const r = (await action(team, player!, round)) as { error?: string };
          setErr(r?.error ?? "");
          if (!r?.error) { setQ(""); setPlayer(null); router.refresh(); }
        }}
      >
        Add keeper
      </button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
