"use client";

import { useEffect, useState } from "react";

type Entry = { id: number; name: string; mine: boolean; pts: number; remain: number; rank: number | null;
  players: { slot: string; name: string; pos: string; pts: number; g: number; salary: number }[] };

export function Leaderboard({ contestId }: { contestId: number }) {
  const [d, setD] = useState<{ status: string; progress: number; entries: Entry[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      const r = await fetch(`/api/dfs/${contestId}`, { cache: "no-store" });
      if (!r.ok || stop) return;
      const j = await r.json();
      setD(j);
      if (j.status === "live") setTimeout(load, 2000);
    };
    load();
    return () => { stop = true; };
  }, [contestId]);
  if (!d) return <p className="text-slate-400">Loading…</p>;
  return (
    <div className="space-y-3">
      {d.status === "live" && (
        <div className="h-2 overflow-hidden rounded-full bg-panel2"><div className="h-full bg-gradient-to-r from-brand to-brand2" style={{ width: `${d.progress * 100}%` }} /></div>
      )}
      {d.status === "final" && <p className="text-sm text-lime-300">Final! Prize packs are in the winners&apos; vending machine inventory.</p>}
      <div className="card divide-y divide-line/60">
        {d.entries.map((e, i) => (
          <div key={e.id} className={e.mine ? "bg-brand/10" : ""}>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(open === e.id ? null : e.id)}>
              <span className="w-8 text-lg font-black text-slate-400">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
              <span className="flex-1 font-semibold">{e.name}{e.mine && " (you)"}</span>
              {d.status === "live" && <span className="text-xs text-slate-500">+{e.remain.toFixed(1)} proj left</span>}
              <span className="w-20 text-right font-mono text-lg font-black">{e.pts.toFixed(2)}</span>
            </button>
            {open === e.id && (
              <ul className="grid gap-1 px-4 pb-3 text-sm sm:grid-cols-3">
                {e.players.map((p) => (
                  <li key={p.slot} className="flex justify-between rounded bg-ink/60 px-2 py-1">
                    <span><span className={`pos pos-${p.pos} mr-1`}>{p.slot.replace(/\d$/, "")}</span>{p.name}</span>
                    <span className="font-mono">{p.pts.toFixed(1)}{p.g < 1 && p.g > 0 ? "•" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
