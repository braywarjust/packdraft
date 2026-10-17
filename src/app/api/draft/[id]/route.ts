import { ensureBranding, teamBrand } from "@/lib/branding";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { advanceDraft, availablePlayers, canView, draftOrder, getLeague, leagueTeams, picksMade, pickTeam, projFor, ROUNDS, userTeam } from "@/lib/league";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await currentUser();
  const l0 = getLeague(Number(id));
  if (!u || !l0 || !canView(l0, u.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  advanceDraft(l0.id);
  const l = getLeague(l0.id)!;
  ensureBranding();
  const teams = leagueTeams(l.id);
  const users = new Map(all<{ id: number; name: string; color: string }>("SELECT id, name, color FROM users").map((x) => [x.id, x]));
  const orderIds = l.draft_order ? draftOrder(l) : teams.map((t) => t.id);
  const me = userTeam(l.id, u.id);
  const picks = all<{ overall: number; round: number; team_id: number; is_keeper: number; player_id: number; name: string; pos: string; team: string }>(
    "SELECT d.overall, d.round, d.team_id, d.is_keeper, d.player_id, p.name, p.pos, p.team FROM draft_picks d JOIN players p ON p.id = d.player_id WHERE d.league_id = ? ORDER BY d.overall", l.id);
  const made = picksMade(l.id);
  const current = l.draft_status === "live" ? { overall: made + 1, ...pickTeam(orderIds, made + 1) } : null;
  const keepers = all<{ team_id: number; round: number; name: string; pos: string }>(
    "SELECT k.team_id, k.round, p.name, p.pos FROM keepers k JOIN players p ON p.id = k.player_id WHERE k.league_id = ?", l.id);
  return NextResponse.json({
    status: l.draft_status,
    rounds: ROUNDS,
    order: orderIds.map((tid) => {
      const t = teams.find((x) => x.id === tid)!;
      const owner = t.user_id ? users.get(t.user_id) : null;
      return { id: t.id, name: t.name, cpu: !!t.is_cpu, auto: !!t.autodraft, owner: owner?.name ?? "CPU", color: teamBrand(t).color, brand: teamBrand(t) };
    }),
    picks,
    keepers,
    current,
    deadline: l.pick_deadline,
    now: Date.now(),
    myTeamId: me?.id ?? null,
    autodraft: !!me?.autodraft,
    isCommish: l.commissioner_id === u.id,
    available: availablePlayers(l.id).sort((a, b) => projFor(b, l.scoring) - projFor(a, l.scoring)).slice(0, 250).map((p, i) => ({ id: p.id, name: p.name, pos: p.pos, team: p.team, adp: i + 1, proj: projFor(p, l.scoring), headshot: p.headshot, injury: p.injury })),
    queue: me ? all<{ player_id: number }>("SELECT player_id FROM draft_queue WHERE team_id = ? ORDER BY rank", me.id).map((q) => q.player_id) : [],
  });
}
