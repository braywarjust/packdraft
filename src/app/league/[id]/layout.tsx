import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canView, getLeague, maybeFinalize, userTeam } from "@/lib/league";
import { LeagueTabs } from "@/components/LeagueTabs";

export default async function LeagueLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  maybeFinalize(Number(id));
  const l = getLeague(Number(id));
  if (!l || !canView(l, u.id)) notFound();
  const team = userTeam(l.id, u.id);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">
            {l.is_public ? "Public" : "Private"} league · {l.scoring.toUpperCase()} · {l.champion_team_id ? "Season over" : l.draft_status === "done" ? `Week ${l.current_week} of ${l.season_weeks}` : l.draft_status === "live" ? "Draft in progress" : "Pre-draft"}
          </p>
          <h1 className="text-2xl font-black">{l.name}</h1>
        </div>
        {l.week_started_at && <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300">● GAMES LIVE</span>}
      </div>
      <LeagueTabs id={l.id} isCommish={l.commissioner_id === u.id} hasTeam={!!team} drafting={l.draft_status === "live"} />
      {children}
    </div>
  );
}
