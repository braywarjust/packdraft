import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getLeague, roster, userTeam, weekProgress, isLocked } from "@/lib/league";
import { leagueSeed, matchupGrade, oppRank, weekProj } from "@/lib/sim";
import { ActionButton } from "@/components/ActionButton";
import { AddPlayer } from "./AddPlayer";
import { addPlayer, cancelClaim, runWaivers } from "../../../actions";

export default async function Players({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; pos?: string; view?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  const me = userTeam(l.id, u.id);
  const seed = leagueSeed(l.id, l.current_week);
  const pos = sp.pos ?? "ALL";
  const q = (sp.q ?? "").trim();
  const view = sp.view ?? "fa";
  const owners = new Map(all<{ player_id: number; team: string }>("SELECT r.player_id, t.name team FROM roster r JOIN teams t ON t.id = r.team_id WHERE r.league_id = ?", l.id).map((r) => [r.player_id, r.team]));
  const players = all<{ id: number; name: string; pos: string; team: string; proj: number; adp: number }>(
    `SELECT * FROM players WHERE (? = 'ALL' OR pos = ?) AND name LIKE ? ORDER BY adp LIMIT 400`, pos, pos, `%${q}%`)
    .filter((p) => (view === "fa" ? !owners.has(p.id) : true))
    .slice(0, 80);
  const myRoster = me ? roster(me.id).map((p) => ({ id: p.id, name: p.name, pos: p.pos })) : [];
  const claims = me ? all<{ id: number; add: string; drop: string | null; bid: number; status: string }>(
    `SELECT c.id, a.name "add", d.name "drop", c.bid, c.status FROM waiver_claims c JOIN players a ON a.id = c.add_player_id LEFT JOIN players d ON d.id = c.drop_player_id
     WHERE c.team_id = ? ORDER BY c.id DESC LIMIT 10`, me.id) : [];
  const faab = l.waiver_type === "faab";
  const progress = weekProgress(l);
  void progress;
  const qs = (o: Record<string, string>) => `?${new URLSearchParams({ q, pos, view, ...o })}`;

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <div className="space-y-3 lg:col-span-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {[["fa", "Free agents"], ["all", "All players"]].map(([v, label]) => (
              <Link key={v} href={qs({ view: v })} className={`tab ${view === v ? "tab-active" : ""}`}>{label}</Link>
            ))}
          </div>
          <div className="flex gap-1">
            {["ALL", "QB", "RB", "WR", "TE", "DST"].map((p) => (
              <Link key={p} href={qs({ pos: p })} className={`tab ${pos === p ? "tab-active" : ""}`}>{p}</Link>
            ))}
          </div>
          <form className="ml-auto">
            <input type="hidden" name="pos" value={pos} /><input type="hidden" name="view" value={view} />
            <input name="q" defaultValue={q} placeholder="Search players" className="input w-56" />
          </form>
        </div>
        <p className="text-xs text-slate-400">
          {faab ? `FAAB waivers: put in blind bids. Claims process when the commish kicks off the week and after each week ends. Highest bid wins; ties go to the worse record.` : "Free agency: adds are instant."}
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel2 text-xs uppercase text-slate-400">
              <tr><th className="py-2 pl-3 text-left">Player</th><th>ADP</th><th>Avg</th><th>Wk proj</th><th>Matchup</th><th className="text-left">Status</th><th /></tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const owner = owners.get(p.id);
                const grade = matchupGrade(oppRank(p, seed));
                return (
                  <tr key={p.id} className="border-t border-line/60">
                    <td className="py-2 pl-3"><span className={`pos pos-${p.pos} mr-2`}>{p.pos}</span><span className="font-semibold">{p.name}</span> <span className="text-xs text-slate-500">{p.team}</span>{isLocked(l, p) && " 🔒"}</td>
                    <td className="text-center text-slate-400">{p.adp}</td>
                    <td className="text-center">{p.proj.toFixed(1)}</td>
                    <td className="text-center">{weekProj(p, seed).toFixed(1)}</td>
                    <td className="text-center">{grade}</td>
                    <td className="text-slate-400">{owner ?? (faab ? "Waivers" : "FA")}</td>
                    <td className="py-1 pr-3 text-right">
                      {!owner && me && l.draft_status === "done" && (
                        <AddPlayer player={{ id: p.id, name: p.name }} roster={myRoster} faab={faab ? me.faab : null} action={addPlayer.bind(null, l.id, p.id)} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <aside className="space-y-4">
        {me && (
          <div className="card p-4">
            <h3 className="font-bold">My claims</h3>
            {faab && <p className="mb-2 text-xs text-slate-400">${me.faab} FAAB remaining</p>}
            {claims.length === 0 && <p className="text-sm text-slate-500">No claims yet.</p>}
            <ul className="space-y-2 text-sm">
              {claims.map((c) => (
                <li key={c.id} className="rounded-lg bg-ink/60 p-2">
                  <p>+ {c.add}{c.drop && <span className="text-slate-400"> / − {c.drop}</span>}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>${c.bid} · <span className={c.status === "won" ? "text-lime-300" : c.status === "failed" ? "text-rose-300" : ""}>{c.status}</span></span>
                    {c.status === "pending" && <ActionButton action={cancelClaim.bind(null, l.id, c.id)} className="text-xs text-rose-300">Cancel</ActionButton>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {l.commissioner_id === u.id && faab && l.draft_status === "done" && (
          <div className="card p-4">
            <p className="mb-2 text-sm text-slate-300">Commish: process all pending claims right now.</p>
            <ActionButton action={runWaivers.bind(null, l.id)}>Run waivers now</ActionButton>
          </div>
        )}
      </aside>
    </div>
  );
}
