import { requireUser } from "@/lib/auth";
import { all, one, Player } from "@/lib/db";
import { getLeague, leagueTeams, processTradeReviews, roster, tradesOpen, userTeam, weekName } from "@/lib/league";
import { tradeCount } from "@/lib/activity";
import { ActionButton } from "@/components/ActionButton";
import { TradeBuilder } from "./TradeBuilder";
import { proposeTrade, respondTrade, reviewTrade } from "../../../actions";

type Trade = { id: number; from_team_id: number; to_team_id: number; give: string; get: string; note: string | null; status: string; created_at: number; review_until: number | null };

const STATUS: Record<string, [string, string]> = {
  accepted: ["accepted", "text-emerald-600"], pending: ["pending", "text-amber-600"], review: ["in LM review", "text-amber-600"],
  vetoed: ["vetoed", "text-red-600"], voided: ["voided", "text-red-600"],
};

export default async function Trades({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ to?: string }> }) {
  const { id } = await params;
  const { to } = await searchParams;
  const u = await requireUser();
  processTradeReviews(Number(id));
  const l = getLeague(Number(id))!;
  const me = userTeam(l.id, u.id);
  const isCommish = l.commissioner_id === u.id;
  const open = tradesOpen(l);
  const hoursLeft = (t: Trade) => Math.max(1, Math.ceil(((t.review_until ?? 0) - Date.now()) / 3600_000));
  const teams = leagueTeams(l.id);
  const name = new Map(teams.map((t) => [t.id, t.name]));
  const pname = (ids: string) => (JSON.parse(ids) as number[]).map((pid) => one<Player>("SELECT name FROM players WHERE id = ?", pid)?.name).join(", ") || "nothing";
  const trades = all<Trade>("SELECT * FROM trades WHERE league_id = ? ORDER BY id DESC LIMIT 40", l.id);
  const rosters = Object.fromEntries(teams.map((t) => [t.id, roster(t.id).map((p) => ({ id: p.id, name: p.name, pos: p.pos, proj: p.proj }))]));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        {me && open.ok ? (
          <>
          <TradeBuilder
            myTeamId={me.id}
            teams={teams.filter((t) => t.id !== me.id).map((t) => ({ id: t.id, name: t.name, cpu: !!t.is_cpu }))}
            rosters={rosters}
            initialTo={to ? Number(to) : undefined}
            propose={proposeTrade.bind(null, l.id)}
          />
          <p className="mt-3 text-xs text-zinc-500">
            {(l.trade_review_hours ?? 0) > 0 ? `Accepted trades wait ${l.trade_review_hours} hours for the League Manager to review before they go through.` : "Accepted trades go through right away."}
            {l.trade_deadline_week ? ` Trade deadline: end of ${weekName(l, l.trade_deadline_week)}.` : ""}
            {l.trade_limit != null ? ` Free trades: ${l.trade_limit} per team this season (you've made ${tradeCount(l, me.id)}). After that each trade uses a Trade from the League Shop (you have ${me.trade_tokens ?? 0}).` : ""}
          </p>
          </>
        ) : (
          <p className="text-zinc-500">{me ? (open.ok ? "" : `${open.why}.`) : "Join the league to trade."}</p>
        )}
      </div>
      <div className="space-y-3 lg:col-span-2">
        <h2 className="text-lg font-bold">Trade block activity</h2>
        {trades.length === 0 && <p className="text-sm text-zinc-400">No trades yet. Someone make a move.</p>}
        {trades.map((t) => {
          const incoming = me && t.to_team_id === me.id && t.status === "pending";
          const outgoing = me && t.from_team_id === me.id && t.status === "pending";
          const review = t.status === "review";
          const [label, tone] = STATUS[t.status] ?? [t.status, "text-zinc-400"];
          return (
            <div key={t.id} className={`card p-3 text-sm ${incoming || (review && isCommish) ? "border-brand/40" : ""}`}>
              <p className="text-xs text-zinc-500">{name.get(t.from_team_id)} → {name.get(t.to_team_id)} · <span className={tone}>{label}</span>{review && <> · goes through in {hoursLeft(t)}h</>}</p>
              <p><span className="text-zinc-500">Sends:</span> {pname(t.give)}</p>
              <p><span className="text-zinc-500">Gets:</span> {pname(t.get)}</p>
              {t.note && <p className="mt-1 italic text-zinc-700">&ldquo;{t.note}&rdquo;</p>}
              {incoming && (
                <div className="mt-2 flex gap-2">
                  <ActionButton action={respondTrade.bind(null, l.id, t.id, true)} className="btn-lime px-3 py-1 text-xs">Accept</ActionButton>
                  <ActionButton action={respondTrade.bind(null, l.id, t.id, false)} className="btn-ghost px-3 py-1 text-xs">Reject</ActionButton>
                </div>
              )}
              {review && isCommish && (
                <div className="mt-2 flex gap-2">
                  <ActionButton action={reviewTrade.bind(null, l.id, t.id, false)} className="btn-ghost px-3 py-1 text-xs text-red-600" confirm="Veto this trade? Both teams keep their players.">Veto</ActionButton>
                  <ActionButton action={reviewTrade.bind(null, l.id, t.id, true)} className="btn-lime px-3 py-1 text-xs">Approve now</ActionButton>
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
