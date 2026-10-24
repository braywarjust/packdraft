"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STATS, WEIGHT_MAX, WEIGHT_MIN, encodeWeights, scoringLabel, weightsOf, PRESET_IDS, type Weights } from "@/lib/scoring";

export function SettingsForm({ action, children, readOnly }: { action: (f: FormData) => Promise<unknown>; children: React.ReactNode; readOnly?: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ t: string; bad: boolean } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card space-y-4 p-5"
      action={(f) =>
        start(async () => {
          const r = (await action(f)) as { error?: string };
          setMsg(r?.error ? { t: r.error, bad: true } : { t: "Saved", bad: false });
          router.refresh();
        })
      }
    >
      <fieldset disabled={readOnly} className={readOnly ? "space-y-4 [&_.input]:appearance-none [&_.input]:border-transparent [&_.input]:bg-ink/40" : "space-y-4"}>{children}</fieldset>
      {!readOnly && (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 flex items-center gap-3 lg:bottom-3">
          <button className="btn-primary shadow-lg" disabled={pending}>Save settings</button>
          {msg && <span className={`text-sm ${msg.bad ? "text-red-600" : "text-emerald-600"}`}>{msg.t}</span>}
        </div>
      )}
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

/** Points per stat, ESPN style: pick a preset or set your own. Posts w_<stat> fields. */
export function ScoringEditor({ scoring }: { scoring: string }) {
  const [w, setW] = useState<Weights>(() => ({ ...weightsOf(scoring) }));
  const current = encodeWeights(w);
  const preset = PRESET_IDS.includes(current) ? current : "custom";
  return (
    <div className="space-y-3">
      <div>
        <label className="label">Scoring type</label>
        <select value={preset} onChange={(e) => e.target.value !== "custom" && setW({ ...weightsOf(e.target.value) })} className="input">
          {PRESET_IDS.map((id) => <option key={id} value={id}>{scoringLabel(id)}</option>)}
          <option value="custom">Custom points</option>
        </select>
      </div>
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel2 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="px-3 py-2">Stat</th><th className="px-3 py-2 text-right">Points</th></tr>
          </thead>
          <tbody>
            {STATS.map(([k, abbr, name]) => (
              <tr key={k} className="border-t border-line">
                <td className="px-3 py-1.5"><b>{abbr}</b> <span className="text-zinc-500">{name}</span></td>
                <td className="px-3 py-1.5 text-right">
                  <input name={`w_${k}`} type="number" inputMode="decimal" step="0.25" min={WEIGHT_MIN} max={WEIGHT_MAX}
                    value={w[k] ?? 0} onChange={(e) => setW({ ...w, [k]: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="input ml-auto !w-24 text-right font-mono" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">A triple-double scores TD instead of DD, not both. Points per stat go from {WEIGHT_MIN} to {WEIGHT_MAX}. A change rescores the current matchup; finished matchups keep their final scores. With custom points, Pack Points are still paid on ESPN points.</p>
    </div>
  );
}
