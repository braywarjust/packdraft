/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, one, Game, Matchup, Team } from "@/lib/db";
import { boostableGame, getLeague, maybeFinalize, roster, standings, teamWeek, STARTERS } from "@/lib/league";
import { unopenedPacks } from "@/lib/packs-server";
import { RARITIES, Rarity } from "@/lib/packs";
import { ensureBranding, favoritePresetId, leagueBrand, teamBrand, userPresets } from "@/lib/branding";
import { teamBoosts } from "@/lib/boost";
import { earnings } from "@/lib/economy";
import { winProb } from "@/lib/sim";
import { etDate } from "@/lib/nba/espn";
import { ActionButton } from "@/components/ActionButton";
import { Coins, CoinIcon } from "@/components/Coins";
import { TeamBadge, type BrandLite } from "@/components/TeamBadge";
import { TeamLogo } from "@/components/TeamLogo";
import { MatchupCard } from "@/components/MatchupCard";
import { PackThumb } from "@/components/PackThumb";
import { RarityBadge } from "@/components/PlayerCard";
import { BoltIcon } from "@/components/Icons";
import { claimBonus } from "./actions";

const DEFAULT_BRAND: BrandLite = { name: "PackDraft", abbr: "PD", color: "#0253a4", alt: "#cc2b31", logo: null };
type Alert = { href: string; tone: "red" | "amber" | "blue"; text: string; brand?: BrandLite };

export default async function Home() {
  const user = await requireUser();
  ensureBranding();
  const presets = userPresets(user.id);
  const myTeams = all<Team>("SELECT * FROM teams WHERE user_id = ? ORDER BY id DESC", user.id);
  const packs = unopenedPacks(user.id);
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = etDate();
  const vault = one<{ v: number; n: number }>("SELECT COALESCE(SUM(value), 0) v, COUNT(*) n FROM cards WHERE user_id = ? AND sold = 0", user.id)!;
  const bestSlabs = all<{ id: number; slab_id: number; player: string; rarity: Rarity; value: number; grade: string; company: string }>(
    `SELECT c.id, c.slab_id, s.player, c.rarity, c.value, s.grade, s.company FROM cards c JOIN slabs s ON s.id = c.slab_id
     WHERE c.user_id = ? AND c.sold = 0 ORDER BY c.value DESC LIMIT 4`, user.id);
  const bets = (() => {
    try {
      return one<{ n: number; stake: number; toWin: number }>(
        "SELECT COUNT(*) n, COALESCE(SUM(stake), 0) stake, COALESCE(SUM(CAST(stake * odds AS INTEGER)), 0) toWin FROM bets WHERE user_id = ? AND status = 'open'", user.id)!;
    } catch { return { n: 0, stake: 0, toWin: 0 }; }
  })();
  const games = all<Game>("SELECT * FROM games WHERE date_et = ? ORDER BY state = 'in' DESC, start_ts", today);
  const pulls = all<{ user: string; name: string; rarity: Rarity; value: number; slab_id: number | null }>(
    `SELECT u.name user, COALESCE(s.player, p.name) name, c.rarity, c.value, c.slab_id FROM cards c JOIN users u ON u.id = c.user_id LEFT JOIN slabs s ON s.id = c.slab_id LEFT JOIN players p ON p.id = c.player_id
     WHERE u.is_tester = 0 AND c.sold = 0 ORDER BY c.value DESC LIMIT 5`);
  const leaders = all<{ name: string; color: string; coins: number; vault: number }>(
    `SELECT u.name, u.color, u.coins, COALESCE((SELECT SUM(value) FROM cards c WHERE c.user_id = u.id AND c.sold = 0), 0) vault
     FROM users u WHERE u.is_tester = 0 ORDER BY (u.coins + vault) DESC LIMIT 6`);

  // Per-league snapshot + things that need attention.
  const alerts: Alert[] = [];
  const leagues = myTeams.map((t) => {
    maybeFinalize(t.league_id);
    const l = getLeague(t.league_id)!;
    const fresh = one<Team>("SELECT * FROM teams WHERE id = ?", t.id)!;
    const brand = teamBrand(fresh);
    const table = standings(l.id);
    const rank = table.findIndex((x) => x.id === t.id) + 1;
    const base = { t: fresh, l, brand, rank, size: table.length };
    if (l.draft_status === "live") alerts.push({ href: `/league/${l.id}/draft`, tone: "red", text: `${l.name}: the draft is live`, brand });
    if (l.draft_status !== "done" || l.champion_team_id) return { ...base, card: null, earned: null };
    const tw = teamWeek(l, t.id, l.current_week);
    const filled = new Set(tw.players.filter((p) => p.slot !== "BN").map((p) => p.slot));
    const empty = STARTERS.filter((s) => !filled.has(s)).length;
    const hurt = tw.players.filter((p) => p.slot !== "BN" && p.injury && /^out/i.test(p.injury)).length;
    if (empty) alerts.push({ href: `/league/${l.id}/team`, tone: "red", text: `${l.name}: ${empty} empty starting slot${empty > 1 ? "s" : ""}`, brand });
    if (hurt) alerts.push({ href: `/league/${l.id}/team`, tone: "amber", text: `${l.name}: ${hurt} starter${hurt > 1 ? "s are" : " is"} listed OUT`, brand });
    // Unused slab boost today (real leagues: someone plays today and nobody is boosted for today).
    if (vault.n > 0 && l.mode !== "sim") {
      const boosts = teamBoosts(t.id);
      const canBoostToday = roster(t.id).some((p) => boostableGame(l, p)?.key === today);
      if (canBoostToday && ![...boosts.values()].some((b) => b.day_key === today))
        alerts.push({ href: `/league/${l.id}/team`, tone: "blue", text: `${l.name}: today's slab boost is unused`, brand });
    }
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
      card = { href: `/league/${l.id}/matchup/${m.id}`, home: h.s, away: a.s, status: (m.final ? "final" : live ? "live" : "pre") as "final" | "live" | "pre", wp: winProb(h.w, a.w) };
    }
    return { ...base, card, earned: earnings(l.id, user.id, l.current_week) };
  });
  if (packs.length) alerts.push({ href: "/packs", tone: "blue", text: `${packs.length} unopened pack${packs.length > 1 ? "s" : ""} waiting to be ripped` });
  if (user.last_bonus !== todayIso) alerts.push({ href: "#bonus", tone: "amber", text: "Your daily Pack Points bonus is ready" });

  // Banner team: your starred Team Studio favourite, else your newest league team, else your first preset.
  const fav = presets.find((p) => p.id === favoritePresetId(user.id)) ?? null;
  const asBrand = (p: (typeof presets)[number]): BrandLite => ({ name: p.name, abbr: p.abbr, color: p.color, alt: p.alt_color, logo: p.logo_url });
  const heroLeague = fav ? leagues.find((x) => x.t.preset_id === fav.id) : leagues[0];
  const hero = fav ? asBrand(fav) : leagues[0]?.brand ?? (presets[0] ? asBrand(presets[0]) : DEFAULT_BRAND);
  const otherTeams = leagues.filter((x) => x !== heroLeague);
  const tones = { red: "border-l-red-500", amber: "border-l-amber-400", blue: "border-l-brand" };

  return (
    <div className="space-y-6">
      {/* Hero in your team's colours */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl" style={{ background: `linear-gradient(115deg, ${hero.color} 0%, ${hero.color} 50%, ${hero.alt} 140%)` }}>
        <div className="pointer-events-none absolute -right-10 top-1/2 -translate-y-1/2 opacity-20"><TeamBadge brand={hero} size={380} ghost /></div>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 2px, transparent 2px 14px)" }} />
        <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-8">
          <TeamBadge brand={hero} size={112} className="drop-shadow-2xl" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/70">Welcome back</p>
            <h1 className="text-4xl font-black leading-none tracking-tight text-white drop-shadow-lg sm:text-5xl">{user.name}</h1>
            <p className="mt-2 text-sm text-white/80">
              {hero === DEFAULT_BRAND ? "Set up your team in Team Studio to brand your app." : <>{hero.name}{heroLeague ? ` · ${heroLeague.l.name}` : ""}</>}
            </p>
            {otherTeams.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">{heroLeague ? "Your other teams" : "Your teams"}</span>
                {otherTeams.map((x) => (
                  <Link key={x.t.id} href={`/league/${x.l.id}`} title={`${x.t.name} · ${x.l.name}`}
                    className="flex items-center gap-1.5 rounded-full bg-black/25 py-1 pl-1 pr-3 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-black/40">
                    <TeamBadge brand={x.brand} size={24} />
                    <span className="max-w-[9rem] truncate">{x.l.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div id="bonus" className="flex flex-wrap gap-2">
            {user.last_bonus !== todayIso
              ? <ActionButton action={claimBonus} className="btn bg-[#fff] text-black hover:bg-[#e5e7eb]">Claim daily <Coins n={150} /></ActionButton>
              : <span className="btn pointer-events-none bg-black/25 text-white/70">Daily bonus claimed</span>}
          </div>
        </div>
        <div className="relative grid grid-cols-2 gap-px bg-black/20 sm:grid-cols-4">
          {([
            ["Pack Points", user.is_tester ? "Unlimited" : <Coins key="c" n={user.coins} />, "/packs"],
            ["Vault value", <Coins key="v" n={vault.v} />, "/collection"],
            ["Unopened packs", String(packs.length), "/packs"],
            ["Open bets", bets.n ? <span key="b">{bets.n} · to win <Coins n={bets.toWin} /></span> : "None", "/bets"],
          ] as [string, React.ReactNode, string][]).map(([k, v, href]) => (
            <Link key={k} href={href} className="bg-black/25 px-5 py-3 backdrop-blur transition hover:bg-black/35">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{k}</p>
              <p className="truncate font-mono text-xl font-black text-white">{v}</p>
            </Link>
          ))}
        </div>
        <div className="h-2" style={{ background: `linear-gradient(90deg, ${hero.alt}, ${hero.color}, ${hero.alt})` }} />
      </section>

      {presets.length === 0 && (
        <Link href="/teams?welcome=1" className="card flex items-center justify-between gap-4 border-l-4 border-l-accent p-5 transition hover:border-zinc-300">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Start here</p>
            <p className="text-lg font-semibold">Set up your team: name, colours and logo</p>
            <p className="text-sm text-zinc-500">Do it once in Team Studio, then pick it whenever you join a league.</p>
          </div>
          <span className="btn-primary shrink-0">Open Team Studio</span>
        </Link>
      )}

      {alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">Needs your attention</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {alerts.map((a, i) => (
              <Link key={i} href={a.href} className={`card flex items-center gap-3 border-l-4 px-4 py-3 text-sm font-semibold transition hover:border-zinc-300 ${tones[a.tone]}`}>
                {a.brand ? <TeamBadge brand={a.brand} size={24} /> : <BoltIcon className="text-amber-600" />}
                <span className="min-w-0 flex-1">{a.text}</span>
                <span className="text-xs text-brand">Go →</span>
              </Link>
            ))}
          </div>
        </section>
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
          {leagues.map(({ t, l, brand, rank, size, card, earned }) => (
            <div key={t.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link href={`/league/${l.id}`} className="flex min-w-0 items-center gap-2 font-bold hover:underline">
                  <TeamBadge brand={leagueBrand(l)} size={24} />
                  <span className="truncate">{l.name}</span>
                  <span className="font-normal text-zinc-500">
                    · {l.champion_team_id ? "Season over" : l.draft_status === "done" ? `Week ${l.current_week}` : l.draft_status === "live" ? "Drafting now" : "Pre-draft"}
                    {rank ? ` · ${rank} of ${size}` : ""}
                  </span>
                </Link>
                {earned && <span className="flex items-center gap-1 text-xs text-zinc-500">Earned this week <span className="font-bold text-emerald-600"><Coins n={earned.week} /></span></span>}
              </div>
              {card ? (
                <MatchupCard href={card.href} home={card.home} away={card.away} status={card.status} winProb={card.wp} mine />
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
            <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">My best slabs</h3><Link href="/collection" className="text-xs text-brand hover:underline">Collection</Link></div>
            {bestSlabs.length === 0 ? (
              <p className="text-sm text-zinc-500">No slabs yet. <Link href="/packs" className="text-brand underline">Rip a pack</Link>.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {bestSlabs.map((c) => (
                  <Link key={c.id} href="/collection" className="flex flex-col items-center gap-1 text-center" title={`${c.player} · ${c.company} ${c.grade}`}>
                    <img src={`/api/slabs/${c.slab_id}`} alt="" className="h-24 w-full object-contain drop-shadow-lg" />
                    <RarityBadge rarity={c.rarity} className="px-1.5 text-[8px]" />
                    <span className="text-[11px] font-semibold text-emerald-600"><Coins n={c.value} /></span>
                  </Link>
                ))}
              </div>
            )}
            {packs.length > 0 && (
              <Link href="/packs" className="mt-3 flex items-center gap-3 rounded-lg bg-ink/40 p-2 text-sm hover:bg-panel2">
                <PackThumb id={packs[0].pack_type} height={40} showName={false} />
                <span className="flex-1"><b>{packs.length}</b> unopened pack{packs.length > 1 ? "s" : ""}</span>
                <span className="btn-primary px-3 py-1 text-xs">Rip</span>
              </Link>
            )}
          </div>

          <div className="card p-4">
            <h3 className="mb-3 font-bold">Biggest pulls</h3>
            {pulls.length === 0 && <p className="text-sm text-zinc-500">No packs ripped yet.</p>}
            <ul className="space-y-2">
              {pulls.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate"><span className={`font-semibold ${RARITIES[c.rarity].text}`}>{c.name}</span> <span className="text-zinc-400">· {c.user}</span></span>
                  <span className="shrink-0 font-mono text-emerald-600"><Coins n={c.value} /></span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 font-bold">Net worth</h3>
            <ol className="space-y-2">
              {leaders.map((u, i) => (
                <li key={u.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="w-4 text-zinc-400">{i + 1}</span><span className="h-3 w-3 rounded-full" style={{ background: u.color }} />{u.name}</span>
                  <span className="font-mono"><Coins n={u.coins + u.vault} /></span>
                </li>
              ))}
            </ol>
            <p className="mt-2 flex items-center gap-1 text-xs text-zinc-400"><CoinIcon /> Pack Points + slab vault value</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
