import { TeamBadge } from "@/components/TeamBadge";
import { ensureBranding, leagueBrand, userPresets } from "@/lib/branding";
import { PresetPicker } from "@/components/PresetPicker";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { scoringLabel } from "@/lib/scoring";
import { ActionForm } from "@/components/ActionForm";
import { joinLeague } from "../actions";
import { PageHeader } from "@/components/PageHeader";

export default async function LeaguesPage() {
  const u = await requireUser();
  ensureBranding();
  const presets = userPresets(u.id);
  const pickTeam = presets.length
    ? <select name="preset_id" className="input w-48" defaultValue={presets[0].id}>{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
    : <input name="team_name" className="input w-44" placeholder="Your team name" />;
  const mine = all<{ id: number; name: string; draft_status: string; current_week: number; n: number; team: string; color: string | null; alt_color: string | null; abbr: string | null; logo_url: string | null }>(
    `SELECT l.*, t.name team, (SELECT COUNT(*) FROM teams x WHERE x.league_id = l.id) n FROM leagues l JOIN teams t ON t.league_id = l.id AND t.user_id = ? ORDER BY l.id DESC`, u.id);
  const pub = all<{ id: number; name: string; max_teams: number; n: number; humans: number; scoring: string; commish: string; color: string | null; alt_color: string | null; abbr: string | null; logo_url: string | null }>(
    `SELECT l.*, u.name commish, (SELECT COUNT(*) FROM teams x WHERE x.league_id = l.id) n, (SELECT COUNT(*) FROM teams x WHERE x.league_id = l.id AND x.is_cpu = 0) humans
     FROM leagues l JOIN users u ON u.id = l.commissioner_id
     WHERE l.is_public = 1 AND (l.draft_status = 'pre' OR EXISTS (SELECT 1 FROM teams x WHERE x.league_id = l.id AND x.is_cpu = 1)) AND l.id NOT IN (SELECT league_id FROM teams WHERE user_id = ?) ORDER BY l.id DESC`, u.id);
  return (
    <>
    <PageHeader icon="leagues" eyebrow="Fantasy NBA" title="Leagues" description="Your leagues, public leagues looking for managers, and invite codes.">
      <Link href="/leagues/new" className="btn-primary">Create a league</Link>
    </PageHeader>
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="space-y-2">
          <h2 className="label">Your leagues</h2>
          {mine.length === 0 && <p className="text-zinc-500">You haven&apos;t joined any leagues yet.</p>}
          {mine.map((l) => (
            <Link key={l.id} href={`/league/${l.id}`} className="relative flex items-center gap-4 overflow-hidden rounded-xl p-4 shadow-lg ring-1 ring-white/10 transition hover:-translate-y-0.5"
              style={{ background: `linear-gradient(110deg, ${leagueBrand(l).color}, ${leagueBrand(l).color} 55%, ${leagueBrand(l).alt} 140%)` }}>
              <div className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 opacity-20"><TeamBadge brand={leagueBrand(l)} size={120} ghost /></div>
              <TeamBadge brand={leagueBrand(l)} size={48} className="relative" />
              <div className="relative min-w-0 flex-1">
                <p className="truncate text-lg font-black text-white">{l.name}</p>
                <p className="text-sm text-white/80">{l.team} · {l.n} teams</p>
              </div>
              <span className="relative rounded-full bg-black/30 px-3 py-1 text-sm font-semibold text-white">{l.draft_status === "done" ? `Week ${l.current_week}` : l.draft_status === "live" ? "Drafting now" : "Pre-draft"}</span>
            </Link>
          ))}
        </section>
        <section className="space-y-2">
          <h2 className="label">Public leagues looking for managers</h2>
          {pub.length === 0 && <p className="text-zinc-500">None right now.</p>}
          {pub.map((l) => (
            <div key={l.id} className="card flex flex-wrap items-center justify-between gap-3 border-l-4 p-4" style={{ borderLeftColor: leagueBrand(l).color }}>
              <div className="flex min-w-0 items-center gap-3">
              <TeamBadge brand={leagueBrand(l)} size={40} />
              <div className="min-w-0">
                <p className="font-bold">{l.name}</p>
                <p className="text-sm text-zinc-500">LM {l.commish} · {l.humans}/{l.max_teams} managers · {scoringLabel(l.scoring)}</p>
              </div>
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
        <p className="mb-4 text-sm text-zinc-500">Your League Manager can find it on the league page.</p>
        <ActionForm action={joinLeague} submit="Join league">
          <div><label className="label">Invite code</label><input name="code" className="input uppercase" placeholder="A1B2C3" required /></div>
          <PresetPicker presets={presets} compact />
        </ActionForm>
      </aside>
    </div>
    </>
  );
}
