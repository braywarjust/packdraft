import { requireUser } from "@/lib/auth";
import { all, one, Player } from "@/lib/db";
import { getLeague, leagueTeams, roster, userTeam } from "@/lib/league";
import { ActionButton } from "@/components/ActionButton";
import { TradeBuilder } from "./TradeBuilder";
import { proposeTrade, respondTrade } from "../../../actions";

type Trade = { id: number; from_team_id: number; to_team_id: number; give: string; get: string; note: string | null; status: string; created_at: number };

export default async function Trades({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ to?: string }> }) {
  const { id } = await params;
  const { to } = await searchParams;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  const me = userTeam(l.id, u.id);
  const teams = leagueTeams(l.id);
  const name = new Map(teams.map((t) => [t.id, t.name]));
  const pname = (ids: string) => (JSON.parse(ids) as number[]).map((pid) => one<Player>("SELECT name FROM players WHERE id = ?", pid)?.name).join(", ") || "nothing";
  const trades = all<Trade>("SELECT * FROM trades WHERE league_id = ? ORDER BY id DESC LIMIT 40", l.id);
  const rosters = Object.fromEntries(teams.map((t) => [t.id, roster(t.id).map((p) => ({ id: p.id, name: p.name, pos: p.pos, proj: p.proj }))]));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        {me && l.draft_status === "done" ? (
          <TradeBuilder
            myTeamId={me.id}
            teams={teams.filter((t) => t.id !== me.id).map((t) => ({ id: t.id, name: t.name, cpu: !!t.is_cpu }))}
            rosters={rosters}
            initialTo={to ? Number(to) : undefined}
            propose={proposeTrade.bind(null, l.id)}
          />
        ) : (
          <p className="text-slate-400">Trading opens once the draft is done.</p>
        )}
      </div>
      <div className="space-y-3 lg:col-span-2">
        <h2 className="text-lg font-bold">Trade block activity</h2>
        {trades.length === 0 && <p className="text-sm text-slate-500">No trades yet. Someone make a move.</p>}
        {trades.map((t) => {
          const incoming = me && t.to_team_id === me.id && t.status === "pending";
          const outgoing = me && t.from_team_id === me.id && t.status === "pending";
          return (
            <div key={t.id} className={`card p-3 text-sm ${incoming ? "border-lime-400/50" : ""}`}>
              <p className="text-xs text-slate-400">{name.get(t.from_team_id)} → {name.get(t.to_team_id)} · <span className={t.status === "accepted" ? "text-lime-300" : t.status === "pending" ? "text-amber-300" : "text-slate-500"}>{t.status}</span></p>
              <p><span className="text-slate-400">Sends:</span> {pname(t.give)}</p>
              <p><span className="text-slate-400">Gets:</span> {pname(t.get)}</p>
              {t.note && <p className="mt-1 italic text-slate-300">&ldquo;{t.note}&rdquo;</p>}
              {incoming && (
                <div className="mt-2 flex gap-2">
                  <ActionButton action={respondTrade.bind(null, l.id, t.id, true)} className="btn-lime px-3 py-1 text-xs">Accept</ActionButton>
                  <ActionButton action={respondTrade.bind(null, l.id, t.id, false)} className="btn-ghost px-3 py-1 text-xs">Reject</ActionButton>
                </div>
              )}
              {outgoing && <div className="mt-2"><ActionButton action={respondTrade.bind(null, l.id, t.id, false)} className="btn-ghost px-3 py-1 text-xs">Cancel offer</ActionButton></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
