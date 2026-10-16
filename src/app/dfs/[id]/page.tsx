import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { Contest, DFS_SLOTS, SALARY_CAP, contestPlayers, prizeLadder, salary, tickContest, slateGames } from "@/lib/dfs";
import { dayLabel } from "@/lib/nba/espn";
import { ActionButton } from "@/components/ActionButton";
import { LineupBuilder } from "./LineupBuilder";
import { Leaderboard } from "./Leaderboard";
import { contestBots, enterContest, startContest } from "../../actions";
import { Coins } from "@/components/Coins";

export default async function ContestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  let c = one<Contest>("SELECT * FROM dfs_contests WHERE id = ?", Number(id));
  if (!c) notFound();
  tickContest(c);
  c = one<Contest>("SELECT * FROM dfs_contests WHERE id = ?", c.id)!;
  const entries = all<{ id: number; user_id: number | null; name: string | null; bot_name: string | null; lineup: string }>(
    "SELECT e.*, u.name FROM dfs_entries e LEFT JOIN users u ON u.id = e.user_id WHERE contest_id = ?", c.id);
  const mine = entries.find((e) => e.user_id === u.id);
  const isHost = c.creator_id === u.id;
  const prizes = prizeLadder(c);
  const games = slateGames(c);
  const opp = new Map<string, string>();
  for (const g of games) { opp.set(g.home, `vs ${g.away}`); opp.set(g.away, `@ ${g.home}`); }
  const lock = games.length ? Math.min(...games.map((g) => g.start_ts)) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            DFS · {c.mode === "sim" ? "Simulated slate" : `${dayLabel(c.slate_date!)} · ${games.length} games`} · {c.status === "open" ? "Open for entries" : c.status === "live" ? "● Live" : "Final"}
          </p>
          <h1 className="text-3xl font-black">{c.name}</h1>
          <p className="text-sm text-zinc-500">
            Entry {c.entry_fee ? <Coins n={c.entry_fee} /> : "FREE"} · {entries.length}/{c.max_entries} entries · 🥇 {prizes[0].name} · 🥈 {prizes[1].name} · 🥉 {prizes[2].name}
            {c.status === "open" && lock && <> · Locks at first tip, {new Date(lock).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET</>}
          </p>
        </div>
        {isHost && c.status === "open" && (
          <div className="flex gap-2">
            <ActionButton action={contestBots.bind(null, c.id, 3)}>🤖 Add 3 bots</ActionButton>
            {c.mode === "sim" && <ActionButton action={startContest.bind(null, c.id)} className="btn-lime" confirm="Lock lineups and start the slate?">Lock & start slate</ActionButton>}
          </div>
        )}
      </div>

      {c.status === "open" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LineupBuilder
              players={contestPlayers(c).map((p) => ({
                id: p.id, name: p.name, pos: p.pos, team: p.team, headshot: p.headshot, injury: p.injury,
                salary: salary(p), proj: p.proj_dk, opp: opp.get(p.team) ?? "",
              }))}
              slots={DFS_SLOTS}
              cap={SALARY_CAP}
              initial={mine ? JSON.parse(mine.lineup) : null}
              submit={enterContest.bind(null, c.id)}
              fee={mine ? 0 : c.entry_fee}
            />
          </div>
          <div className="space-y-4">
            {games.length > 0 && (
              <div className="card p-4">
                <p className="label">Slate</p>
                <ul className="space-y-1 text-sm">
                  {games.map((g) => (
                    <li key={g.id} className="flex justify-between"><span>{g.away} @ {g.home}</span>
                      <span className="text-zinc-500">{new Date(g.start_ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="card p-4">
              <p className="label">Entries</p>
              <ul className="space-y-1 text-sm">
                {entries.map((e) => <li key={e.id}>{e.name ?? `🤖 ${e.bot_name}`}{e.user_id === u.id && " (you)"}</li>)}
                {entries.length === 0 && <li className="text-zinc-400">Nobody yet</li>}
              </ul>
              <p className="mt-3 text-xs text-zinc-400">
                {c.mode === "sim" ? "The host locks the contest to start the simulated slate. Need at least 2 entries; bots count." : "Lineups lock automatically at the first tip-off and the contest settles when every game is final. DraftKings-style scoring."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Leaderboard contestId={c.id} />
      )}
    </div>
  );
}
