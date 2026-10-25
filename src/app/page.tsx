import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, one, Game, Matchup, Team } from "@/lib/db";
import { beforeOpener, getLeague, maybeFinalize, standings, teamWeek } from "@/lib/league";
import { ensureBranding, leagueBrand, teamBrand, userPresets } from "@/lib/branding";
import { earnings } from "@/lib/economy";
import { winProb } from "@/lib/sim";
import { dayLabel, etDate } from "@/lib/nba/espn";
import { ActionButton } from "@/components/ActionButton";
import { Coins, CoinIcon } from "@/components/Coins";
import { TeamBadge } from "@/components/TeamBadge";
import { TeamLogo } from "@/components/TeamLogo";
import { MatchupStrip } from "@/components/MatchupCard";
import { AcqIcon, ACQ_COLOR, MoveCount, TradeIcon, TRADE_COLOR } from "@/components/Currencies";
import { movesLeft } from "@/lib/activity";
import { Headshot } from "@/components/Headshot";
import { PlayerButton } from "@/components/PlayerInspector";
import { Fpts } from "@/components/Fpts";
import { claimBonus } from "./actions";
import { getProfile } from "@/lib/profile";
import { Avatar, profileColors } from "@/components/ProfileView";


export default async function Home() {
  const user = await requireUser();
  ensureBranding();
  const presets = userPresets(user.id);
  const myTeams = all<Team>("SELECT * FROM teams WHERE user_id = ? ORDER BY id DESC", user.id);
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = etDate();
  // Acquisitions and Trades belong to a team, so the banner shows your newest league's.
  const home = myTeams[0] ?? null;
  const homeMoves = home ? movesLeft(getLeague(home.league_id)!, home.id) : null;
  const bets = (() => {
    try {
      return one<{ n: number; stake: number; toWin: number }>(
        "SELECT COUNT(*) n, COALESCE(SUM(stake), 0) stake, COALESCE(SUM(CAST(stake * odds AS INTEGER)), 0) toWin FROM bets WHERE user_id = ? AND status = 'open'", user.id)!;
    } catch { return { n: 0, stake: 0, toWin: 0 }; }
  })();
  const games = all<Game>("SELECT * FROM games WHERE date_et = ? ORDER BY state = 'in' DESC, start_ts", today);
  // Fantasy Coins leaders (testers left out).
  const leaders = all<{ name: string; color: string; coins: number }>(
    "SELECT u.name, u.color, u.coins FROM users u WHERE u.is_tester = 0 ORDER BY u.coins DESC LIMIT 6");

  // Per-league snapshot + things that need attention.
  const leagues = myTeams.map((t) => {
    maybeFinalize(t.league_id);
    const l = getLeague(t.league_id)!;
    const fresh = one<Team>("SELECT * FROM teams WHERE id = ?", t.id)!;
    const brand = teamBrand(fresh);
    const table = standings(l.id);
    const rank = table.findIndex((x) => x.id === t.id) + 1;
    const base = { t: fresh, l, brand, rank, size: table.length };
    if (l.draft_status !== "done" || l.champion_team_id) return { ...base, card: null, earned: null, top: [] };
    const tw = teamWeek(l, t.id, l.current_week);
    const m = one<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND week = ? AND (home_team_id = ? OR away_team_id = ?)", l.id, l.current_week, t.id, t.id);
    let card = null;
    if (m) {
      const side = (tid: number, stored: number | null) => {
        const team = one<Team>("SELECT * FROM teams WHERE id = ?", tid)!;
        const w = tid === t.id ? tw : teamWeek(l, tid, l.current_week);
        return { w, s: { id: tid, brand: teamBrand(team), record: `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}`, score: m.final && stored != null ? stored : w.score, proj: w.score + w.remain } };
      };
      const h = side(m.home_team_id, m.home_score), a = side(m.away_team_id, m.away_score);
      const live = l.mode === "sim" ? !!l.week_started_at : h.w.score + a.w.score > 0;
      // The LIVE badge only while one of its players' games is under way, not all week.
      const playing = l.mode === "sim" || [...h.w.players, ...a.w.players].some((p) => p.now?.state === "in");
      card = { href: `/league/${l.id}/matchup/${m.id}`, home: h.s, away: a.s, status: (m.final ? "final" : live ? "live" : "pre") as "final" | "live" | "pre", playing, wp: winProb(h.w, a.w) };
    }
    // Top performers this week: fantasy points each rostered player has earned for his team (games he started), best first.
    const top = all<Team>("SELECT * FROM teams WHERE league_id = ?", l.id)
      .flatMap((x) => (x.id === t.id ? tw : teamWeek(l, x.id, l.current_week)).players.map((p) => ({ p, team: teamBrand(x), mine: x.id === t.id })))
      .filter((r) => r.p.pts > 0)
      .sort((a, b) => b.p.pts - a.p.pts)
      .slice(0, 10);
    return { ...base, card, earned: earnings(l.id, user.id, l.current_week), top };
  });


  const profile = getProfile(user.id);
  const [pc1, pc2] = profile ? profileColors(profile) : [user.color, "#cc2b31"];

  return (
    <div className="space-y-6">
      {/* Compact banner in your profile colours, with your profile photo */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 shadow-xl" style={{ background: `linear-gradient(115deg, ${pc1} 0%, ${pc1} 55%, ${pc2} 140%)` }}>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)" }} />
        <div className="relative flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
          <Link href="/profile" className="shrink-0"><Avatar src={profile?.user.avatar ?? null} name={user.name} color={user.color} size={56} ring={profile?.look.ring ? pc2 : undefined} /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/70">Welcome back</p>
            <Link href="/profile" className="block truncate text-xl font-black leading-tight text-white hover:underline sm:text-2xl">{user.name}</Link>
            {profile?.user.tagline && <p className="truncate text-xs text-white/75">{profile.user.tagline}</p>}
          </div>
          <div id="bonus" className="shrink-0">
            {user.last_bonus !== todayIso
              ? <ActionButton action={claimBonus} className="btn bg-[#fff] px-3 py-1.5 text-sm text-black hover:bg-[#e5e7eb]">Claim <Coins n={150} /></ActionButton>
              : <span className="hidden rounded-full bg-black/25 px-3 py-1 text-xs text-white/70 sm:inline">Bonus claimed</span>}
          </div>
        </div>
        <div className="relative flex gap-px overflow-x-auto bg-black/20 text-white scrollbar-thin">
          {([
            ["Fantasy Coins", <Coins key="c" n={user.coins} live />, home ? `/league/${home.league_id}/shop` : "/leagues"],
            ["Acquisitions", <span key="a" className="inline-flex items-center gap-1"><AcqIcon className={ACQ_COLOR} />{homeMoves ? <MoveCount m={homeMoves.adds} /> : 0}</span>, home ? `/league/${home.league_id}/shop` : "/leagues"],
            ["Trades", <span key="t" className="inline-flex items-center gap-1"><TradeIcon className={TRADE_COLOR} />{homeMoves ? <MoveCount m={homeMoves.trades} /> : 0}</span>, home ? `/league/${home.league_id}/shop` : "/leagues"],
            ["Open bets", bets.n ? <span key="b">{bets.n}</span> : "0", "/bets"],
          ] as [string, React.ReactNode, string][]).map(([k, v, href]) => (
            <Link key={k} href={href} className="min-w-[5.5rem] flex-1 bg-black/25 px-3 py-1.5 backdrop-blur transition hover:bg-black/35">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/60">{k}</p>
              <p className="truncate font-mono text-sm font-black">{v}</p>
            </Link>
          ))}
        </div>
      </section>

      {presets.length === 0 && (
        <Link href="/teams?welcome=1" className="card flex items-center justify-between gap-4 border-l-4 border-l-accent p-5 transition hover:border-zinc-300">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Start here</p>
            <p className="text-lg font-semibold">Set up your team: name, colours and logo</p>
            <p className="text-sm text-zinc-500">Set it once in Team Studio, use it in every league.</p>
          </div>
          <span className="btn-primary shrink-0">Open Team Studio</span>
        </Link>
      )}


      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">My leagues</h2>
            <Link href="/leagues/new" className="text-sm text-brand hover:underline">Create a league</Link>
          </div>
          {leagues.length === 0 && (
            <div className="card p-6 text-zinc-700">
              No leagues yet. <Link href="/leagues/new" className="text-brand underline">Create one</Link> for the crew or <Link href="/leagues" className="text-brand underline">join with a code</Link>.
            </div>
          )}
          {leagues.map(({ t, l, brand, rank, size, card, earned, top }) => (
            <div key={t.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link href={`/league/${l.id}`} className="flex min-w-0 items-center gap-2 font-bold hover:underline">
                  <TeamBadge brand={leagueBrand(l)} size={24} />
                  <span className="truncate">{l.name}</span>
                  <span className="font-normal text-zinc-500">
                    · {l.champion_team_id ? "Season over" : l.draft_status === "done" ? (beforeOpener(l) ? `Starts ${dayLabel(l.start_date!)}` : `Week ${l.current_week}`) : l.draft_status === "live" ? "Drafting now" : "Pre-draft"}
                    {rank ? ` · ${rank} of ${size}` : ""}
                  </span>
                </Link>
                {earned && <span className="flex items-center gap-1 text-xs text-zinc-500">Earned this week <span className="font-bold text-coin"><Coins n={earned.week} live /></span></span>}
              </div>
              {card ? (
                <MatchupStrip href={card.href} home={card.home} away={card.away} status={card.status} playing={card.playing} winProb={card.wp} />
              ) : (
                <Link href={l.draft_status === "live" ? `/league/${l.id}/draft` : `/league/${l.id}`}
                  className="relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 shadow-xl ring-1 ring-white/10 transition hover:-translate-y-0.5"
                  style={{ background: `linear-gradient(110deg, ${brand.color}, ${brand.color} 55%, ${brand.alt} 140%)` }}>
                  <div className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 opacity-20"><TeamBadge brand={brand} size={180} ghost /></div>
                  <TeamBadge brand={brand} size={56} />
                  <div className="relative min-w-0 flex-1">
                    <p className="truncate text-xl font-black text-white">{t.name}</p>
                    <p className="text-sm text-white/80">{l.draft_status === "live" ? "The draft is live. Get in the room." : l.champion_team_id ? "Season complete." : "Waiting for the draft."}</p>
                  </div>
                  <span className="btn relative bg-[#fff] text-black">{l.draft_status === "live" ? "Draft room" : "Open league"}</span>
                </Link>
              )}
              {top.length > 0 && (
                <div className="card p-3 sm:p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Top performers · Week {l.current_week}</h3>
                    <Link href={`/league/${l.id}/matchups`} className="text-xs text-brand hover:underline">Matchups</Link>
                  </div>
                  {/* The top 10, about five rows tall (the sixth peeks out): scroll for the rest. */}
                  <ol className="max-h-[17rem] space-y-1 overflow-y-auto overscroll-contain pr-1 scrollbar-thin">
                    {top.map(({ p, team, mine }, i) => (
                      <li key={p.id} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${i === 0 ? "bg-amber-400/10 ring-1 ring-amber-400/30" : "bg-ink/40"}`}>
                        <span className={`w-4 text-center font-mono text-sm font-black ${i === 0 ? "text-amber-400" : "text-zinc-500"}`}>{i + 1}</span>
                        <Headshot src={p.headshot} name={p.name} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                            <PlayerButton id={p.id} league={l.id} className="truncate">{p.name}</PlayerButton>
                            <TeamLogo team={p.team} size={14} />
                          </span>
                          <span className="flex items-center gap-1 truncate text-[11px] text-zinc-500">
                            <TeamBadge brand={team} size={14} /><span className="truncate">{team.name}{mine ? " · You" : ""}</span> · {p.played} GP
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block font-mono text-base font-black text-white"><Fpts n={p.pts} /></span>
                          <span className="block text-[10px] text-zinc-500">{(p.pts / Math.max(1, p.played)).toFixed(1)}/g</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </section>

        <aside className="space-y-5">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Tonight&apos;s NBA games</h3><Link href="/bets" className="text-xs text-brand hover:underline">Sportsbook</Link></div>
            {games.length === 0 && <p className="text-sm text-zinc-500">No games today.</p>}
            <ul className="space-y-1.5">
              {games.slice(0, 8).map((g) => (
                <li key={g.id} className="rounded-lg bg-ink/40 px-2.5 py-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <TeamLogo team={g.away} size={20} /><span className="font-semibold">{g.away}</span>
                    <span className="ml-auto font-mono font-bold">{g.state === "pre" ? "" : `${g.away_score} – ${g.home_score}`}</span>
                    <span className="ml-auto font-semibold">{g.home}</span><TeamLogo team={g.home} size={20} />
                  </div>
                  <p className="mt-0.5 text-center text-[10px] text-zinc-500">
                    {g.state === "in" ? <span className="font-bold text-red-600">● LIVE · {g.detail}</span> : g.state === "post" ? "Final" : new Date(g.start_ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET"}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 font-bold">Coin leaders</h3>
            <ol className="space-y-2">
              {leaders.map((u, i) => (
                <li key={u.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="w-4 text-zinc-400">{i + 1}</span><span className="h-3 w-3 rounded-full" style={{ background: u.color }} />{u.name}</span>
                  <span className="font-mono"><Coins n={u.coins} live /></span>
                </li>
              ))}
            </ol>
            <p className="mt-2 flex items-center gap-1 text-xs text-zinc-400"><CoinIcon /> Fantasy Coins</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
