import { QueryArea } from "@/components/NavShell";
import { posLabel } from "@/lib/scoring";
import { LockIcon } from "@/components/Icons";
import { TeamLogo } from "@/components/TeamLogo";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { getLeague, roster, userTeam, isLocked, playerGames, projFor } from "@/lib/league";
import { Player } from "@/lib/db";
import { Headshot, InjuryTag } from "@/components/Headshot";
import { ActionButton } from "@/components/ActionButton";
import { AddPlayer } from "./AddPlayer";
import { addPlayer, cancelClaim, runWaivers } from "../../../actions";
import { Fpts } from "@/components/Fpts";
import { PlayerButton } from "@/components/PlayerInspector";
import { newsAgo } from "@/lib/news-time";
import { leagueNewsPlayers, newsFeed, refreshNews } from "@/lib/news";

export default async function Players({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; pos?: string; view?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  const me = userTeam(l.id, u.id);
  const pos = sp.pos ?? "ALL";
  const q = (sp.q ?? "").trim();
  const view = sp.view ?? "fa";
  const owners = new Map(all<{ player_id: number; team: string }>("SELECT r.player_id, t.name team FROM roster r JOIN teams t ON t.id = r.team_id WHERE r.league_id = ?", l.id).map((r) => [r.player_id, r.team]));
  const players = all<Player>(
    `SELECT * FROM players WHERE active = 1 AND (? = 'ALL' OR (',' || COALESCE(elig, pos) || ',') LIKE ?) AND name LIKE ? ORDER BY ${l.scoring === "dk" ? "proj_dk" : "proj"} DESC LIMIT 400`, pos, `%,${pos},%`, `%${q}%`)
    .filter((p) => (view === "fa" ? !owners.has(p.id) : true))
    .slice(0, 80);
  let news: { item: ReturnType<typeof newsFeed>[number]; p: Player }[] = [];
  if (view === "news") {
    const ids = leagueNewsPlayers(l.id);
    await refreshNews(ids, 16);
    const byId = new Map(all<Player>(`SELECT * FROM players WHERE id IN (${ids.map(() => "?").join(",") || "NULL"})`, ...ids).map((p) => [p.id, p]));
    const match = (p: Player) => (pos === "ALL" || `,${p.elig || p.pos},`.includes(`,${pos},`)) && p.name.toLowerCase().includes(q.toLowerCase());
    news = newsFeed(ids.filter((id) => byId.has(id) && match(byId.get(id)!)), 40).map((item) => ({ item, p: byId.get(item.player_id)! }));
  }
  const myRoster = me ? roster(me.id).map((p) => ({ id: p.id, name: p.name, pos: p.pos })) : [];
  const claims = me ? all<{ id: number; add: string; drop: string | null; bid: number; status: string }>(
    `SELECT c.id, a.name "add", d.name "drop", c.bid, c.status FROM waiver_claims c JOIN players a ON a.id = c.add_player_id LEFT JOIN players d ON d.id = c.drop_player_id
     WHERE c.team_id = ? ORDER BY c.id DESC LIMIT 10`, me.id) : [];
  const faab = l.waiver_type === "faab";
  const qs = (o: Record<string, string>) => `?${new URLSearchParams({ q, pos, view, ...o })}`;

  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <div className="space-y-3 lg:col-span-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {[["fa", "Free agents"], ["all", "All players"], ["news", "News"]].map(([v, label]) => (
              <Link key={v} href={qs({ view: v })} scroll={false} className={`tab ${view === v ? "tab-active" : ""}`}>{label}</Link>
            ))}
          </div>
          <div className="flex gap-1">
            {["ALL", "PG", "SG", "SF", "PF", "C"].map((p) => (
              <Link key={p} href={qs({ pos: p })} scroll={false} className={`tab ${pos === p ? "tab-active" : ""}`}>{p}</Link>
            ))}
          </div>
          <form className="w-full sm:ml-auto sm:w-auto">
            <input type="hidden" name="pos" value={pos} /><input type="hidden" name="view" value={view} />
            <input name="q" defaultValue={q} placeholder="Search players" className="input w-full sm:w-56" />
          </form>
        </div>
        <QueryArea>
        {view === "news" ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">The latest ESPN fantasy news on every rostered player and the top free agents. Tap a name for the full player card.</p>
            {news.length === 0 && <p className="card p-6 text-center text-sm text-zinc-500">No news yet. It fills in over the next few minutes.</p>}
            {news.map(({ item, p }) => {
              const owner = owners.get(p.id);
              return (
                <article key={item.id} className="card flex gap-3 p-3">
                  <Headshot src={p.headshot} name={p.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                      <PlayerButton id={p.id} league={l.id} className="inline font-bold text-white">{p.name}</PlayerButton>
                      <span className="text-xs text-zinc-400"><TeamLogo team={p.team} size={14} className="mx-0.5 -mt-0.5 align-middle" />{p.team} {posLabel(p.elig || p.pos)}</span>
                      <InjuryTag injury={p.injury} />
                      <span className={`rounded-full px-1.5 text-[10px] font-bold ${owner ? "bg-panel2 text-zinc-600" : "bg-emerald-500/15 text-emerald-600"}`}>{owner ?? (faab ? "Waivers" : "Free agent")}</span>
                      <span className="ml-auto text-[11px] text-zinc-500">{newsAgo(item.published)}</span>
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-snug text-white">{item.headline}</p>
                    {item.story && <p className="mt-1 text-xs leading-relaxed text-zinc-600"><b className="text-fpts">Spin:</b> {item.story}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (<>
        <p className="text-xs text-zinc-500">
          {faab ? `FAAB waivers: put in blind bids. Claims process every night at midnight ET (sim leagues: at each tip-off). Highest bid wins; ties go to the worse record.` : "Free agency: adds are instant."}
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel2 text-xs uppercase text-zinc-500">
              <tr><th className="py-2 pl-3 text-left">Player</th><th className="hidden sm:table-cell">Last season</th><th>Proj/g</th><th className="hidden sm:table-cell">Games wk</th><th className="hidden text-left sm:table-cell">Status</th><th /></tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const owner = owners.get(p.id);
                const avg = p.avg ? (JSON.parse(p.avg) as Record<string, number>) : null;
                const games = l.draft_status === "done" ? playerGames(l, p, l.current_week) : [];
                const left = games.filter((g) => g.state === "pre").length;
                return (
                  <tr key={p.id} className="border-t border-line/60">
                    <td className="py-2 pl-3">
                      <div className="flex items-center gap-2">
                        <Headshot src={p.headshot} name={p.name} size={32} />
                        <div>
                          <p><PlayerButton id={p.id} league={l.id} className="inline font-semibold">{p.name}</PlayerButton> <InjuryTag injury={p.injury} />{l.draft_status === "done" && isLocked(l, p) && <LockIcon className="ml-1 text-zinc-500" title="Locked: game started" />}</p>
                          <p className="text-xs text-zinc-400"><span className="mr-1 font-semibold text-zinc-300">{posLabel(p.elig || p.pos)}</span><TeamLogo team={p.team} size={14} className="mx-0.5 -mt-0.5 align-middle" />{p.team}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden text-center text-xs text-zinc-500 sm:table-cell">{avg ? `${avg.pts.toFixed(1)}/${avg.reb.toFixed(1)}/${avg.ast.toFixed(1)}` : "Rookie"}</td>
                    <td className="text-center font-mono"><Fpts n={projFor(p, l.scoring)} /></td>
                    <td className="hidden text-center text-xs sm:table-cell">{games.length ? `${left} of ${games.length} left` : "—"}</td>
                    <td className="hidden text-zinc-500 sm:table-cell">{owner ?? (faab ? "Waivers" : "FA")}</td>
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
        </>)}
        </QueryArea>
      </div>
      <aside className="space-y-4">
        {me && (
          <div className="card p-4">
            <h3 className="font-bold">My claims</h3>
            {faab && <p className="mb-2 text-xs text-zinc-500">${me.faab} FAAB remaining</p>}
            {claims.length === 0 && <p className="text-sm text-zinc-400">No claims yet.</p>}
            <ul className="space-y-2 text-sm">
              {claims.map((c) => (
                <li key={c.id} className="rounded-lg bg-ink/60 p-2">
                  <p>+ {c.add}{c.drop && <span className="text-zinc-500"> / − {c.drop}</span>}</p>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>${c.bid} · <span className={c.status === "won" ? "text-emerald-600" : c.status === "failed" ? "text-red-600" : ""}>{c.status}</span></span>
                    {c.status === "pending" && <ActionButton action={cancelClaim.bind(null, l.id, c.id)} className="text-xs text-red-600">Cancel</ActionButton>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {l.commissioner_id === u.id && faab && l.draft_status === "done" && (
          <div className="card p-4">
            <p className="mb-2 text-sm text-zinc-700">Commish: process all pending claims right now.</p>
            <ActionButton action={runWaivers.bind(null, l.id)}>Run waivers now</ActionButton>
          </div>
        )}
      </aside>
    </div>
  );
}
