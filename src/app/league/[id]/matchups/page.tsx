import { QueryArea } from "@/components/NavShell";
import { ForwardIcon, PlayIcon } from "@/components/Icons";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, Matchup } from "@/lib/db";
import { bracket, getLeague, leagueTeams, playoffInfo, teamWeek, userTeam, weekName, weekProgress, weekRange, weekShort, type BracketSlot } from "@/lib/league";
import type { Team } from "@/lib/db";
import { TeamBadge } from "@/components/TeamBadge";
import { ensureBranding, teamBrand } from "@/lib/branding";
import { dayLabel } from "@/lib/nba/espn";
import { ensureSchedule } from "@/lib/nba/sync";
import { winProb } from "@/lib/sim";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MatchupCard, topPerformers, type MatchSide } from "@/components/MatchupCard";
import { finishWeekNow, startWeekAction } from "../../../actions";

export default async function MatchupsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ week?: string }> }) {
  const { id } = await params;
  const { week: wq } = await searchParams;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  ensureBranding();
  if (l.draft_status !== "done") return <p className="card p-6 text-zinc-500">Matchups start once the draft is done.</p>;
  const { lastWeek, rounds } = playoffInfo(l);
  const week = Math.min(lastWeek, Math.max(1, Number(wq) || l.current_week));
  const playoffs = week > l.season_weeks;
  const future = week > l.current_week;
  // Upcoming weeks: make sure that week's NBA schedule is here so the projections count real games. The background
  // loop keeps the season loaded, so this only waits on days it hasn't reached yet (and fetches those all at once).
  if (future && l.mode !== "sim") await ensureSchedule(...weekRange(l, week), { onlyMissing: true });
  const current = week === l.current_week && !l.champion_team_id;
  const teams = new Map(leagueTeams(l.id).map((t) => [t.id, t]));
  const me = userTeam(l.id, u.id);
  const isCommish = l.commissioner_id === u.id;
  const progress = weekProgress(l);
  const ms = all<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND week = ?", l.id, week)
    .sort((a, b) => Number(me && (b.home_team_id === me.id || b.away_team_id === me.id)) - Number(me && (a.home_team_id === me.id || a.away_team_id === me.id)));
  const cards = ms.map((m) => {
    const h = teamWeek(l, m.home_team_id, week), a = teamWeek(l, m.away_team_id, week);
    const side = (tid: number, w: typeof h, stored: number | null): MatchSide => {
      const t = teams.get(tid)!;
      return { id: tid, brand: teamBrand(t), record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`, score: m.final && stored != null ? stored : w.score, proj: w.score + w.remain, top: topPerformers(w.players), lm: t.user_id === l.commissioner_id };
    };
    const live = !m.final && (l.mode === "sim" ? !!l.week_started_at && current : h.players.concat(a.players).some((p) => p.now?.state !== "pre" && p.now != null) && h.score + a.score > 0);
    const status: "pre" | "live" | "final" = m.final ? "final" : live ? "live" : "pre";
    // The LIVE badge only while one of its players' games is under way, not all week.
    const playing = l.mode === "sim" || h.players.concat(a.players).some((p) => p.now?.state === "in");
    return { m, playing, home: side(m.home_team_id, h, m.home_score), away: side(m.away_team_id, a, m.away_score), status, wp: m.final ? 0.5 : winProb(h, a), mine: !!me && (m.home_team_id === me.id || m.away_team_id === me.id) };
  });
  const anyLive = cards.some((c) => c.status === "live");

  return (
    <div className="space-y-5">
      {current && <AutoRefresh ms={anyLive ? 5000 : 30000} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">{playoffs ? weekName(l, week) : `Week ${week} matchups`}</h2>
          <p className="text-sm text-zinc-500">
            {l.mode === "sim" ? (current ? (l.week_started_at ? "Simulated week in progress." : "Simulated week: the League Manager tips it off.") : "Final scores.")
              : (() => { const [s, e] = weekRange(l, week); return `${dayLabel(s)} – ${dayLabel(e)}${current ? " · scores update live during games" : future ? " · upcoming" : " · final"}`; })()}
          </p>
        </div>
        {isCommish && current && l.mode === "sim" && (
          !l.week_started_at
            ? <ActionButton action={startWeekAction.bind(null, l.id)} className="btn-lime"><PlayIcon /> Kick off Week {l.current_week}</ActionButton>
            : <ActionButton action={finishWeekNow.bind(null, l.id)} confirm="Skip to final scores?"><ForwardIcon /> Fast-forward to final</ActionButton>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: lastWeek }, (_, i) => i + 1).map((w) => (
          <Link key={w} href={`/league/${l.id}/matchups?week=${w}`} scroll={false} title={weekName(l, w)}
            className={`tab shrink-0 ${w === week ? "tab-active" : w > l.current_week ? "opacity-60" : ""} ${w === l.season_weeks + 1 ? "ml-2" : ""}`}>
            {weekShort(l, w)}{w === l.current_week && !l.champion_team_id && w !== week ? " •" : ""}
          </Link>
        ))}
      </div>

      <QueryArea className="space-y-5">
      {current && l.week_started_at && (
        <div className="h-2 overflow-hidden rounded-full bg-panel2"><div className="h-full bg-gradient-to-r from-brand to-red-800 transition-all" style={{ width: `${progress * 100}%` }} /></div>
      )}

      <div className="grid gap-4">
        {cards.map((c, i) => (
          <div key={c.m.id} className="space-y-1.5">
            {c.m.kind && <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{c.m.kind === "consolation" ? "3rd place game" : roundTitle(lastWeek - week)}</p>}
            <MatchupCard href={`/league/${l.id}/matchup/${c.m.id}`} home={c.home} away={c.away} status={c.status} playing={c.playing} winProb={c.wp} mine={c.mine} big={i === 0 && c.mine} />
          </div>
        ))}
        {playoffs && cards.length === 0 && <p className="card p-6 text-center text-sm text-zinc-500">Matchups to be determined</p>}
      </div>

      {playoffs && rounds > 0 && <Bracket l={l} teams={teams} />}
      </QueryArea>
    </div>
  );
}

/** ESPN-style playoff bracket: projected from the standings until the regular season ends, then the real thing. */
function Bracket({ l, teams }: { l: Parameters<typeof bracket>[0]; teams: Map<number, Team> }) {
  const b = bracket(l);
  const row = (id: number | null, seed: number | null, score: number | null, won: boolean) => {
    const t = id != null ? teams.get(id) : null;
    return (
      <div className={`flex items-center gap-2 px-3 py-2 ${won ? "font-black text-white" : "text-zinc-400"}`}>
        <span className="w-4 text-right font-mono text-xs text-zinc-500">{seed ?? ""}</span>
        {t ? <TeamBadge brand={teamBrand(t)} size={22} /> : <span className="h-[22px] w-[22px] rounded-full bg-panel2" />}
        <span className="min-w-0 flex-1 truncate text-sm">{t ? t.name : "TBD"}</span>
        {score != null && <span className="font-mono text-sm">{score.toFixed(1)}</span>}
      </div>
    );
  };
  const slot = (s: BracketSlot, key: string) => {
    const m = s.matchup;
    const sc = (id: number | null) => (m?.final && id != null ? (id === m.home_team_id ? m.home_score : m.away_score) : null);
    if (s.a != null && s.b == null) return <div key={key} className="card overflow-hidden">{row(s.a, s.seedA, null, true)}<p className="px-3 pb-2 text-xs text-zinc-500">Bye</p></div>;
    return (
      <div key={key} className="card divide-y divide-line/50 overflow-hidden">
        {row(s.a, s.seedA, sc(s.a), s.winner != null && s.winner === s.a)}
        {row(s.b, s.seedB, sc(s.b), s.winner != null && s.winner === s.b)}
      </div>
    );
  };
  const range = (r: number) => { const [s, e] = weekRange(l, l.season_weeks + r); return `${dayLabel(s)} – ${dayLabel(e)}`; };
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-black">{b.projected ? "Projected playoff bracket" : "Playoff bracket"}</h3>
        <p className="text-sm text-zinc-500">
          Top {b.teams} make it. Seeds go by record, then head-to-head, then points for.{b.projected ? " Seeds lock when the regular season ends." : ""} A tied playoff matchup goes to the higher seed.
        </p>
      </div>
      <div className={`grid gap-4 ${["", "md:grid-cols-1", "md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4"][b.rounds.length] ?? ""}`}>
        {b.rounds.map((slots, i) => (
          <div key={i} className="flex flex-col justify-around gap-3">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">{weekName(l, l.season_weeks + i + 1)} · {roundTitle(b.rounds.length - i - 1)}<br /><span className="font-semibold normal-case tracking-normal">{range(i + 1)}</span></p>
            {slots.map((s, j) => slot(s, `${i}-${j}`))}
            {i + 1 === b.rounds.length && b.third && (
              <>
                <p className="pt-2 text-xs font-black uppercase tracking-widest text-zinc-500">3rd place game</p>
                {slot(b.third, "third")}
              </>
            )}
          </div>
        ))}
      </div>
      {b.champion != null && !b.projected && <p className="text-center text-lg font-black text-amber-300">Champion: {teams.get(b.champion)?.name}</p>}
    </section>
  );
}

const roundTitle = (fromEnd: number) => ["Championship", "Semifinals", "Quarterfinals"][fromEnd] ?? "First round";
