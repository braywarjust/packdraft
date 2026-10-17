import { TeamBadge } from "@/components/TeamBadge";
import { ensureBranding, leagueBrand } from "@/lib/branding";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canView, getLeague, maybeFinalize, userTeam } from "@/lib/league";
import { LeagueTabs } from "@/components/LeagueTabs";
import { SCORING } from "@/lib/scoring";

export default async function LeagueLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  maybeFinalize(Number(id));
  ensureBranding();
  const l = getLeague(Number(id));
  if (!l || !canView(l, u.id)) notFound();
  const team = userTeam(l.id, u.id);
  return (
    <div className="space-y-5">
      {(() => {
        const b = leagueBrand(l);
        return (
          <header className="relative overflow-hidden rounded-2xl border border-white/10 shadow-xl" style={{ background: `linear-gradient(115deg, ${b.color} 0%, ${b.color} 55%, ${b.alt} 135%)` }}>
            <div className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 opacity-20"><TeamBadge brand={b} size={220} ghost /></div>
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)" }} />
            <div className="relative flex flex-wrap items-center gap-4 px-5 py-4">
              <TeamBadge brand={b} size={64} className="drop-shadow-xl" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">
                  {b.abbr} · {l.is_public ? "Public" : "Private"} league · {l.mode === "sim" ? "Simulated" : "Real NBA"} · {SCORING[l.scoring]?.label ?? l.scoring} · {l.champion_team_id ? "Season over" : l.draft_status === "done" ? `Week ${l.current_week} of ${l.season_weeks}` : l.draft_status === "live" ? "Draft in progress" : "Pre-draft"}
                </p>
                <h1 className="truncate text-3xl font-black text-white drop-shadow">{l.name}</h1>
              </div>
              {l.week_started_at && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">● GAMES LIVE</span>}
            </div>
            <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${b.alt}, ${b.color}, ${b.alt})` }} />
          </header>
        );
      })()}
      <LeagueTabs id={l.id} isCommish={l.commissioner_id === u.id} hasTeam={!!team} drafting={l.draft_status === "live"} />
      {children}
    </div>
  );
}
