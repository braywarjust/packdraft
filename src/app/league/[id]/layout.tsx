import { dayLabel } from "@/lib/nba/espn";
import { TeamBadge } from "@/components/TeamBadge";
import { ensureBranding, leagueBrand } from "@/lib/branding";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { seasonLabel } from "@/lib/nba/season";
import { beforeOpener, canView, getLeague, maybeFinalize, userTeam, weekName } from "@/lib/league";
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
              <TeamBadge brand={b} size={64} className="drop-shadow-xl max-sm:!h-12 max-sm:!w-12" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[10px] font-bold uppercase tracking-widest text-white/70 sm:text-[11px]">
                  {b.abbr} · {l.season ? `${seasonLabel(l.season)} · ` : ""}{l.is_public ? "Public" : "Private"} league · {l.mode === "sim" ? "Simulated" : "Real NBA"} · {SCORING[l.scoring]?.label ?? l.scoring} · {l.champion_team_id ? "Offseason" : l.draft_status === "done" ? (l.current_week > l.season_weeks ? weekName(l, l.current_week) : `Week ${l.current_week} of ${l.season_weeks}`) : l.draft_status === "live" ? "Draft in progress" : "Pre-draft"}
                </p>
                <h1 className="line-clamp-2 text-2xl font-black leading-tight text-white sm:truncate sm:text-3xl">{l.name}</h1>
              </div>
              {l.week_started_at && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">● GAMES LIVE</span>}
            </div>
            <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${b.alt}, ${b.color}, ${b.alt})` }} />
          </header>
        );
      })()}
      {l.draft_status === "done" && beforeOpener(l) && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-amber-400 px-4 py-3">
          <div>
            <p className="font-bold">The season tips off {dayLabel(l.start_date!)}</p>
            <p className="text-sm text-zinc-500">Week 1 starts on NBA opening night. Set your lineup until then.</p>
          </div>
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase text-black">Preseason</span>
        </div>
      )}
      <LeagueTabs id={l.id} isCommish={l.commissioner_id === u.id} hasTeam={!!team} drafting={l.draft_status === "live"} />
      {children}
    </div>
  );
}
