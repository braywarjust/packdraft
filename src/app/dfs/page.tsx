import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { Contest, maybeSettle } from "@/lib/dfs";
import { PACKS, PACK_BY_ID, fmtCoins } from "@/lib/packs";
import { ActionForm } from "@/components/ActionForm";
import { addDays, dayLabel, etDate } from "@/lib/nba/espn";
import { ensureSchedule } from "@/lib/nba/sync";
import { createContest } from "../actions";

export default async function DfsPage() {
  await requireUser();
  const today = etDate();
  await ensureSchedule(today, addDays(today, 7));
  const slates = all<{ date_et: string; n: number; first: number }>(
    "SELECT date_et, COUNT(*) n, MIN(start_ts) first FROM games WHERE date_et BETWEEN ? AND ? GROUP BY date_et ORDER BY date_et", today, addDays(today, 7))
    .filter((s) => s.first > Date.now());
  for (const c of all<Contest>("SELECT * FROM dfs_contests WHERE status = 'live'")) maybeSettle(c);
  const contests = all<{ id: number; name: string; entry_fee: number; prize_pack: string; max_entries: number; status: string; host: string; n: number; mode: string; slate_date: string | null }>(
    `SELECT c.*, u.name host, (SELECT COUNT(*) FROM dfs_entries e WHERE e.contest_id = c.id) n FROM dfs_contests c JOIN users u ON u.id = c.creator_id ORDER BY c.status = 'final', c.id DESC LIMIT 40`);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <h1 className="text-3xl font-black">Daily Fantasy</h1>
        <p className="text-zinc-500">Build an 8-player lineup (G, G, F, F, C, 3 UTIL) under a $50,000 cap from one night of real NBA games. DraftKings-style scoring. Top 3 win mystery packs.</p>
        {contests.length === 0 && <p className="card p-6 text-zinc-500">No contests yet. Start one on the right.</p>}
        {contests.map((c) => (
          <Link key={c.id} href={`/dfs/${c.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-brand/60">
            <div>
              <p className="font-bold">{c.name}</p>
              <p className="text-sm text-zinc-500">{c.mode === "sim" ? "Simulated" : dayLabel(c.slate_date!)} · Host {c.host} · {c.n}/{c.max_entries} entries · Entry {c.entry_fee ? fmtCoins(c.entry_fee) : "FREE"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm">🥇 {PACK_BY_ID[c.prize_pack]?.name}</p>
              <p className={`text-xs font-bold ${c.status === "live" ? "text-red-600" : c.status === "open" ? "text-emerald-600" : "text-zinc-400"}`}>{c.status === "live" ? "● LIVE" : c.status === "open" ? "OPEN" : "FINAL"}</p>
            </div>
          </Link>
        ))}
      </div>
      <aside className="card h-fit p-5">
        <h2 className="mb-3 font-bold">Host a contest</h2>
        <ActionForm action={createContest} submit="Create contest">
          <div><label className="label">Name</label><input name="name" className="input" placeholder="Tuesday Night Hoops" /></div>
          <div><label className="label">Slate</label>
            <select name="slate_date" className="input">
              {slates.map((s) => <option key={s.date_et} value={s.date_et}>{dayLabel(s.date_et)} · {s.n} games</option>)}
              {slates.length === 0 && <option value="">No upcoming games found</option>}
            </select></div>
          <div><label className="label">Mode</label>
            <select name="mode" className="input" defaultValue="real">
              <option value="real">Real NBA games</option><option value="sim">Simulated (play right now)</option>
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Entry fee</label><input name="entry_fee" type="number" min={0} defaultValue={0} className="input" /></div>
            <div><label className="label">Max entries</label><input name="max_entries" type="number" min={2} max={50} defaultValue={10} className="input" /></div>
          </div>
          <div><label className="label">1st place prize</label>
            <select name="prize_pack" defaultValue="pro" className="input">{PACKS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label className="label">Sim slate length (minutes)</label><input name="sim_minutes" type="number" step="0.5" min={0.5} defaultValue={3} className="input" /></div>
          <p className="text-xs text-zinc-400">2nd gets the next pack down, 3rd gets a Rookie Pack.</p>
        </ActionForm>
      </aside>
    </div>
  );
}
