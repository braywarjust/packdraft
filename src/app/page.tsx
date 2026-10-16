import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { boostLive } from "@/lib/boost";
import { getLeague, maybeFinalize, teamWeek } from "@/lib/league";
import { unopenedPacks } from "@/lib/packs-server";
import { PACK_BY_ID, RARITIES, Rarity } from "@/lib/packs";
import { ActionButton } from "@/components/ActionButton";
import { LogoWatermark } from "@/components/Logo";
import { claimBonus } from "./actions";
import { Coins } from "@/components/Coins";

export default async function Home() {
  const user = await requireUser();
  const myTeams = all<{ id: number; league_id: number; name: string; wins: number; losses: number; ties: number }>(
    "SELECT * FROM teams WHERE user_id = ?", user.id);
  const packs = unopenedPacks(user.id);
  const today = new Date().toISOString().slice(0, 10);
  const pulls = all<{ user: string; color: string; name: string; rarity: Rarity; value: number; grade: number }>(
    `SELECT u.name user, u.color, COALESCE(s.player || ' · ' || s.year || ' ' || s.set_name, p.name) name, c.rarity, c.value, c.grade FROM cards c JOIN users u ON u.id = c.user_id LEFT JOIN slabs s ON s.id = c.slab_id LEFT JOIN players p ON p.id = c.player_id
     WHERE u.is_tester = 0 AND c.sold = 0 ORDER BY c.value DESC LIMIT 6`);
  const leaders = all<{ name: string; color: string; coins: number; vault: number }>(
    `SELECT u.name, u.color, u.coins, COALESCE((SELECT SUM(value) FROM cards c WHERE c.user_id = u.id AND c.sold = 0), 0) vault
     FROM users u WHERE u.is_tester = 0 ORDER BY (u.coins + vault) DESC LIMIT 8`);
  const boost = boostLive(user.id);

  return (
    <div className="space-y-6">
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <LogoWatermark opacity={0.05} height={260} className="-right-12 -top-6" />
        <div className="relative">
          <p className="text-sm text-zinc-500">Welcome back</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{user.name}</h1>
          <div className="mt-6 flex flex-wrap gap-3">
            {([
              ["Pack Points", <Coins key="c" n={user.coins} />],
              ["Unopened packs", String(packs.length)],
              ["Leagues", String(myTeams.length)],
            ] as [string, React.ReactNode][]).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs text-zinc-500">{k}</p>
                <p className="text-xl font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {user.last_bonus !== today ? (
              <ActionButton action={claimBonus} className="btn-lime">Claim daily <Coins n={150} /></ActionButton>
            ) : (
              <span className="btn pointer-events-none border border-zinc-200 text-zinc-400">Daily bonus claimed</span>
            )}
            <Link href="/leagues/new" className="btn-primary">Create a league</Link>
          </div>
        </div>
      </section>

      {packs.length > 0 && (
        <Link href="/packs" className="card flex items-center justify-between gap-4 overflow-hidden border-l-4 border-l-brand p-5 transition hover:border-zinc-300">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Unopened packs</p>
            <p className="text-lg font-semibold">You have {packs.length} pack{packs.length > 1 ? "s" : ""} waiting to be ripped</p>
            <p className="text-sm text-zinc-500">{packs.slice(0, 3).map((p) => `${PACK_BY_ID[p.pack_type]?.name} (${p.source})`).join(" · ")}</p>
          </div>
          <span className="btn-primary shrink-0 whitespace-nowrap">Open packs</span>
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-bold">My leagues</h2>
          {myTeams.length === 0 && (
            <div className="card p-6 text-zinc-700">
              No leagues yet. <Link href="/leagues/new" className="text-brand underline">Create one</Link> for the crew or <Link href="/leagues" className="text-brand underline">join with a code</Link>.
            </div>
          )}
          {myTeams.map((t) => {
            maybeFinalize(t.league_id);
            const l = getLeague(t.league_id)!;
            const m = all<{ id: number; home_team_id: number; away_team_id: number }>(
              "SELECT * FROM matchups WHERE league_id = ? AND week = ? AND (home_team_id = ? OR away_team_id = ?)", l.id, l.current_week, t.id, t.id)[0];
            const oppId = m ? (m.home_team_id === t.id ? m.away_team_id : m.home_team_id) : null;
            const opp = oppId ? all<{ name: string }>("SELECT name FROM teams WHERE id = ?", oppId)[0] : null;
            const mine = m ? teamWeek(l, t.id, l.current_week) : null;
            const theirs = m && oppId ? teamWeek(l, oppId, l.current_week) : null;
            return (
              <Link key={t.id} href={m && l.draft_status === "done" ? `/league/${l.id}/matchup/${m.id}` : `/league/${l.id}`} className="card block p-4 hover:border-brand/60">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500">{l.name} · {l.draft_status === "done" ? `Week ${l.current_week}` : l.draft_status === "live" ? "Drafting now" : "Pre-draft"}</p>
                    <p className="text-lg font-bold">{t.name} <span className="text-sm font-normal text-zinc-500">({t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""})</span></p>
                  </div>
                  {l.draft_status === "live" && <span className="btn-lime">Draft room →</span>}
                  {l.week_started_at && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-600">● LIVE</span>}
                </div>
                {mine && theirs && opp && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-ink/60 px-4 py-3">
                    <div><p className="text-xs text-zinc-500">You</p><p className="text-2xl font-black">{mine.score.toFixed(1)}</p></div>
                    <p className="text-xs text-zinc-400">proj {(mine.score + mine.remain).toFixed(0)} – {(theirs.score + theirs.remain).toFixed(0)}</p>
                    <div className="text-right"><p className="text-xs text-zinc-500">{opp.name}</p><p className="text-2xl font-black">{theirs.score.toFixed(1)}</p></div>
                  </div>
                )}
              </Link>
            );
          })}

          <h2 className="pt-2 text-lg font-bold">Slab Boost</h2>
          <Link href="/boost" className="card flex items-center justify-between gap-3 p-4 hover:border-brand/60">
            <div>
              <p className="font-bold">Today&apos;s boost</p>
              <p className="text-sm text-zinc-500">
                {boost.picks.length === 0 ? "Back tonight's players with your slabs to earn Pack Points."
                  : <>{boost.picks.length}/3 slots · {boost.picks.some((p) => p.game?.state === "in") ? "● Live · " : ""}<Coins n={Math.round(boost.total)} /> so far</>}
              </p>
            </div>
            <span className="btn-lime shrink-0">{boost.picks.length ? "Watch" : "Play"}</span>
          </Link>
        </section>

        <aside className="space-y-6">
          <div className="card p-4">
            <h3 className="mb-3 font-bold">Biggest pulls</h3>
            {pulls.length === 0 && <p className="text-sm text-zinc-500">No packs ripped yet.</p>}
            <ul className="space-y-2">
              {pulls.map((c, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span><span className={`font-semibold ${RARITIES[c.rarity].text}`}>{c.name}</span> <span className="text-zinc-400">· {c.user}</span></span>
                  <span className="font-mono text-emerald-600"><Coins n={c.value} /></span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="mb-3 font-bold">Net worth</h3>
            <ol className="space-y-2">
              {leaders.map((u, i) => (
                <li key={u.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="w-4 text-zinc-400">{i + 1}</span><span className="h-3 w-3 rounded-full" style={{ background: u.color }} />{u.name}</span>
                  <span className="font-mono"><Coins n={u.coins + u.vault} /></span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-zinc-400">Pack Points + card vault value</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
