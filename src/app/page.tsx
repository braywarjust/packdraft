import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { Contest, maybeSettle } from "@/lib/dfs";
import { getLeague, maybeFinalize, teamWeek } from "@/lib/league";
import { unopenedPacks } from "@/lib/packs-server";
import { PACK_BY_ID, RARITIES, Rarity, fmtCoins } from "@/lib/packs";
import { ActionButton } from "@/components/ActionButton";
import { claimBonus } from "./actions";

export default async function Home() {
  const user = await requireUser();
  const myTeams = all<{ id: number; league_id: number; name: string; wins: number; losses: number; ties: number }>(
    "SELECT * FROM teams WHERE user_id = ?", user.id);
  const packs = unopenedPacks(user.id);
  const today = new Date().toISOString().slice(0, 10);
  const pulls = all<{ user: string; color: string; name: string; rarity: Rarity; value: number; grade: number }>(
    `SELECT u.name user, u.color, p.name, c.rarity, c.value, c.grade FROM cards c JOIN users u ON u.id = c.user_id JOIN players p ON p.id = c.player_id
     ORDER BY c.value DESC LIMIT 6`);
  const leaders = all<{ name: string; color: string; coins: number; vault: number }>(
    `SELECT u.name, u.color, u.coins, COALESCE((SELECT SUM(value) FROM cards c WHERE c.user_id = u.id AND c.sold = 0), 0) vault
     FROM users u ORDER BY (u.coins + vault) DESC LIMIT 8`);
  for (const c of all<Contest>("SELECT * FROM dfs_contests WHERE status = 'live'")) maybeSettle(c);
  const contests = all<{ id: number; name: string; prize_pack: string; status: string }>(
    "SELECT * FROM dfs_contests WHERE status != 'final' ORDER BY id DESC LIMIT 4");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">Welcome back</p>
          <h1 className="text-3xl font-black">{user.name}</h1>
        </div>
        <div className="flex gap-2">
          {user.last_bonus !== today ? (
            <ActionButton action={claimBonus} className="btn-lime">🎁 Claim daily $150</ActionButton>
          ) : (
            <span className="btn-ghost pointer-events-none opacity-60">Daily bonus claimed ✓</span>
          )}
          <Link href="/leagues/new" className="btn-primary">+ New league</Link>
        </div>
      </div>

      {packs.length > 0 && (
        <Link href="/packs" className="card flex items-center justify-between gap-4 bg-gradient-to-r from-fuchsia-600/30 via-amber-500/20 to-emerald-500/20 p-5 hover:border-amber-400/60">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Unopened packs</p>
            <p className="text-xl font-black">You have {packs.length} pack{packs.length > 1 ? "s" : ""} waiting to be ripped</p>
            <p className="text-sm text-slate-300">{packs.slice(0, 3).map((p) => `${PACK_BY_ID[p.pack_type]?.name} (${p.source})`).join(" · ")}</p>
          </div>
          <span className="btn-lime">Rip now →</span>
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-lg font-bold">My leagues</h2>
          {myTeams.length === 0 && (
            <div className="card p-6 text-slate-300">
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
                    <p className="text-xs uppercase tracking-wider text-slate-400">{l.name} · {l.draft_status === "done" ? `Week ${l.current_week}` : l.draft_status === "live" ? "Drafting now" : "Pre-draft"}</p>
                    <p className="text-lg font-bold">{t.name} <span className="text-sm font-normal text-slate-400">({t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""})</span></p>
                  </div>
                  {l.draft_status === "live" && <span className="btn-lime">Draft room →</span>}
                  {l.week_started_at && <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300">● LIVE</span>}
                </div>
                {mine && theirs && opp && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-ink/60 px-4 py-3">
                    <div><p className="text-xs text-slate-400">You</p><p className="text-2xl font-black">{mine.score.toFixed(1)}</p></div>
                    <p className="text-xs text-slate-500">proj {(mine.score + mine.remain).toFixed(0)} – {(theirs.score + theirs.remain).toFixed(0)}</p>
                    <div className="text-right"><p className="text-xs text-slate-400">{opp.name}</p><p className="text-2xl font-black">{theirs.score.toFixed(1)}</p></div>
                  </div>
                )}
              </Link>
            );
          })}

          <h2 className="pt-2 text-lg font-bold">DFS contests</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {contests.map((c) => (
              <Link key={c.id} href={`/dfs/${c.id}`} className="card p-4 hover:border-brand/60">
                <p className="font-bold">{c.name}</p>
                <p className="text-sm text-slate-400">1st place: {PACK_BY_ID[c.prize_pack]?.name} · {c.status === "live" ? "🔴 Live" : "Open"}</p>
              </Link>
            ))}
            <Link href="/dfs" className="card grid place-items-center p-4 text-sm text-brand hover:border-brand/60">+ Start a DFS contest</Link>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="card p-4">
            <h3 className="mb-3 font-bold">🏆 Biggest pulls</h3>
            {pulls.length === 0 && <p className="text-sm text-slate-400">No packs ripped yet.</p>}
            <ul className="space-y-2">
              {pulls.map((c, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span><span className={`font-semibold ${RARITIES[c.rarity].text}`}>{c.name}</span> <span className="text-slate-500">· {c.user}</span></span>
                  <span className="font-mono text-lime-300">{fmtCoins(c.value)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="mb-3 font-bold">💰 Net worth</h3>
            <ol className="space-y-2">
              {leaders.map((u, i) => (
                <li key={u.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="w-4 text-slate-500">{i + 1}</span><span className="h-3 w-3 rounded-full" style={{ background: u.color }} />{u.name}</span>
                  <span className="font-mono">{fmtCoins(u.coins + u.vault)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-slate-500">PackBucks + card vault value</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
