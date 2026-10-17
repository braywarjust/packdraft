import { PresetPicker } from "@/components/PresetPicker";
import { userPresets } from "@/lib/branding";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { ActionForm } from "@/components/ActionForm";
import { joinLeague } from "../actions";
import { PageHeader } from "@/components/PageHeader";

export default async function LeaguesPage() {
  const u = await requireUser();
  const presets = userPresets(u.id);
  const pickTeam = presets.length
    ? <select name="preset_id" className="input w-48" defaultValue={presets[0].id}>{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    : <input name="team_name" className="input w-44" placeholder="Your team name" />;
  const mine = all<{ id: number; name: string; draft_status: string; current_week: number; n: number; team: string }>(
    `SELECT l.*, t.name team, (SELECT COUNT(*) FROM teams x WHERE x.league_id = l.id) n FROM leagues l JOIN teams t ON t.league_id = l.id AND t.user_id = ? ORDER BY l.id DESC`, u.id);
  const pub = all<{ id: number; name: string; max_teams: number; n: number; humans: number; scoring: string; commish: string }>(
    `SELECT l.*, u.name commish, (SELECT COUNT(*) FROM teams x WHERE x.league_id = l.id) n, (SELECT COUNT(*) FROM teams x WHERE x.league_id = l.id AND x.is_cpu = 0) humans
     FROM leagues l JOIN users u ON u.id = l.commissioner_id
     WHERE l.is_public = 1 AND (l.draft_status = 'pre' OR EXISTS (SELECT 1 FROM teams x WHERE x.league_id = l.id AND x.is_cpu = 1)) AND l.id NOT IN (SELECT league_id FROM teams WHERE user_id = ?) ORDER BY l.id DESC`, u.id);
  return (
    <>
    <PageHeader eyebrow="Fantasy NBA" title="Leagues" description="Your leagues, public leagues looking for managers, and invite codes.">
      <Link href="/leagues/new" className="btn-primary">Create a league</Link>
    </PageHeader>
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="space-y-2">
          <h2 className="label">Your leagues</h2>
          {mine.length === 0 && <p className="text-zinc-500">You haven&apos;t joined any leagues yet.</p>}
          {mine.map((l) => (
            <Link key={l.id} href={`/league/${l.id}`} className="card flex items-center justify-between p-4 hover:border-brand/60">
              <div>
                <p className="font-bold">{l.name}</p>
                <p className="text-sm text-zinc-500">{l.team} · {l.n} teams</p>
              </div>
              <span className="text-sm text-zinc-700">{l.draft_status === "done" ? `Week ${l.current_week}` : l.draft_status === "live" ? "🔴 Drafting" : "Pre-draft"}</span>
            </Link>
          ))}
        </section>
        <section className="space-y-2">
          <h2 className="label">Public leagues looking for managers</h2>
          {pub.length === 0 && <p className="text-zinc-500">None right now.</p>}
          {pub.map((l) => (
            <div key={l.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold">{l.name}</p>
                <p className="text-sm text-zinc-500">Commish {l.commish} · {l.humans}/{l.max_teams} managers · {l.scoring === "dk" ? "DK scoring" : "ESPN scoring"}</p>
              </div>
              <ActionForm action={joinLeague} submit="Join" className="flex gap-2" submitClass="btn-primary">
                <input type="hidden" name="league_id" value={l.id} />
                {pickTeam}
              </ActionForm>
            </div>
          ))}
        </section>
      </div>
      <aside className="card h-fit p-5">
        <h2 className="mb-1 font-bold">Join with invite code</h2>
        <p className="mb-4 text-sm text-zinc-500">Your commish can find it on the league page.</p>
        <ActionForm action={joinLeague} submit="Join league">
          <div><label className="label">Invite code</label><input name="code" className="input uppercase" placeholder="A1B2C3" required /></div>
          <PresetPicker presets={presets} compact />
        </ActionForm>
      </aside>
    </div>
    </>
  );
}
