import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all, one, Player } from "@/lib/db";
import { Contest, DFS_SLOTS, SALARY_CAP, contestSeed, prizeLadder, salary, maybeSettle } from "@/lib/dfs";
import { weekProj, matchupGrade, oppRank } from "@/lib/sim";
import { fmtCoins } from "@/lib/packs";
import { ActionButton } from "@/components/ActionButton";
import { LineupBuilder } from "./LineupBuilder";
import { Leaderboard } from "./Leaderboard";
import { contestBots, enterContest, startContest } from "../../actions";

export default async function ContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  let c = one<Contest>("SELECT * FROM dfs_contests WHERE id = ?", Number(id));
  if (!c) notFound();
  maybeSettle(c);
  c = one<Contest>("SELECT * FROM dfs_contests WHERE id = ?", c.id)!;
  const seed = contestSeed(c.id);
  const entries = all<{ id: number; user_id: number | null; name: string | null; bot_name: string | null; lineup: string }>(
    "SELECT e.*, u.name FROM dfs_entries e LEFT JOIN users u ON u.id = e.user_id WHERE contest_id = ?", c.id);
  const mine = entries.find((e) => e.user_id === u.id);
  const isHost = c.creator_id === u.id;
  const prizes = prizeLadder(c);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">DFS · {c.status === "open" ? "Open for entries" : c.status === "live" ? "● Live" : "Final"}</p>
          <h1 className="text-3xl font-black">{c.name}</h1>
          <p className="text-sm text-slate-400">Entry {c.entry_fee ? fmtCoins(c.entry_fee) : "FREE"} · {entries.length}/{c.max_entries} entries · 🥇 {prizes[0].name} · 🥈 {prizes[1].name} · 🥉 {prizes[2].name}</p>
        </div>
        {isHost && c.status === "open" && (
          <div className="flex gap-2">
            <ActionButton action={contestBots.bind(null, c.id, 3)}>🤖 Add 3 bots</ActionButton>
            <ActionButton action={startContest.bind(null, c.id)} className="btn-lime" confirm="Lock lineups and start the slate?">Lock & start slate</ActionButton>
          </div>
        )}
      </div>

      {c.status === "open" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LineupBuilder
              players={all<Player>("SELECT * FROM players ORDER BY adp").map((p) => ({
                id: p.id, name: p.name, pos: p.pos, team: p.team, salary: salary(p), proj: weekProj(p, seed), grade: matchupGrade(oppRank(p, seed)),
              }))}
              slots={DFS_SLOTS}
              cap={SALARY_CAP}
              initial={mine ? JSON.parse(mine.lineup) : null}
              submit={enterContest.bind(null, c.id)}
              fee={mine ? 0 : c.entry_fee}
            />
          </div>
          <div className="card h-fit p-4">
            <p className="label">Entries</p>
            <ul className="space-y-1 text-sm">
              {entries.map((e) => <li key={e.id}>{e.name ?? `🤖 ${e.bot_name}`}{e.user_id === u.id && " (you)"}</li>)}
              {entries.length === 0 && <li className="text-slate-500">Nobody yet</li>}
            </ul>
            <p className="mt-3 text-xs text-slate-500">The host locks the contest to start the live slate. Need at least 2 entries; bots count.</p>
          </div>
        </div>
      ) : (
        <Leaderboard contestId={c.id} />
      )}
    </div>
  );
}
