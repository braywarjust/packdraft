import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { ActionForm } from "@/components/ActionForm";
import { joinLeague } from "../actions";

export default async function LeaguesPage() {
  const u = await requireUser();
  const mine = all<{ id: number; name: string; draft_status: string; current_week: number; n: number; team: string }>(
    `SELECT l.*, t.name team, (SELECT COUNT(*) FROM teams x WHERE x.league_id = l.id) n FROM leagues l JOIN teams t ON t.league_id = l.id AND t.user_id = ? ORDER BY l.id DESC`, u.id);
  const pub = all<{ id: number; name: string; max_teams: number; n: number; humans: number; scoring: string; commish: string }>(
    `SELECT l.*, u.name commish, (SELECT COUNT(*) FROM teams x WHERE x.league_id = l.id) n, (SELECT COUNT(*) FROM teams x WHERE x.league_id = l.id AND x.is_cpu = 0) humans
     FROM leagues l JOIN users u ON u.id = l.commissioner_id
     WHERE l.is_public = 1 AND (l.draft_status = 'pre' OR EXISTS (SELECT 1 FROM teams x WHERE x.league_id = l.id AND x.is_cpu = 1)) AND l.id NOT IN (SELECT league_id FROM teams WHERE user_id = ?) ORDER BY l.id DESC`, u.id);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Leagues</h1>
          <Link href="/leagues/new" className="btn-primary">+ Create league</Link>
        </div>
        <section className="space-y-2">
          <h2 className="label">Your leagues</h2>
          {mine.length === 0 && <p className="text-slate-400">You haven&apos;t joined any leagues yet.</p>}
          {mine.map((l) => (
            <Link key={l.id} href={`/league/${l.id}`} className="card flex items-center justify-between p-4 hover:border-brand/60">
              <div>
                <p className="font-bold">{l.name}</p>
                <p className="text-sm text-slate-400">{l.team} · {l.n} teams</p>
              </div>
              <span className="text-sm text-slate-300">{l.draft_status === "done" ? `Week ${l.current_week}` : l.draft_status === "live" ? "🔴 Drafting" : "Pre-draft"}</span>
            </Link>
          ))}
        </section>
        <section className="space-y-2">
          <h2 className="label">Public leagues looking for managers</h2>
          {pub.length === 0 && <p className="text-slate-400">None right now.</p>}
          {pub.map((l) => (
            <div key={l.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">{l.name}</p>
                <p className="text-sm text-slate-400">Commish {l.commish} · {l.humans}/{l.max_teams} managers · {l.scoring.toUpperCase()}</p>
              </div>
              <ActionForm action={joinLeague} submit="Join" className="flex gap-2" submitClass="btn-primary">
                <input type="hidden" name="league_id" value={l.id} />
                <input name="team_name" className="input w-44" placeholder="Your team name" />
              </ActionForm>
            </div>
          ))}
        </section>
      </div>
      <aside className="card h-fit p-5">
        <h2 className="mb-1 font-bold">Join with invite code</h2>
        <p className="mb-4 text-sm text-slate-400">Your commish can find it on the league page.</p>
        <ActionForm action={joinLeague} submit="Join league">
          <div><label className="label">Invite code</label><input name="code" className="input uppercase" placeholder="A1B2C3" required /></div>
          <div><label className="label">Team name</label><input name="team_name" className="input" placeholder="Hurts So Good" /></div>
        </ActionForm>
      </aside>
    </div>
  );
}
