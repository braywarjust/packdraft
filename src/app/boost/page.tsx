import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { BOOST_SLOTS, OWN_PLAYER_BONUS, boostHistory, boostLive, boostPlayers, boostSlabs } from "@/lib/boost";
import { dayLabel, etDate, addDays } from "@/lib/nba/espn";
import { ensureSchedule, refreshLive } from "@/lib/nba/sync";
import { PageHeader } from "@/components/PageHeader";
import { BoostBoard } from "./BoostBoard";

export default async function BoostPage() {
  const u = await requireUser();
  const today = etDate();
  await ensureSchedule(today, addDays(today, 7));
  await refreshLive();
  const players = boostPlayers(today);
  const next = players.length ? null : all<{ date_et: string }>("SELECT date_et FROM games WHERE date_et > ? ORDER BY date_et LIMIT 1", today)[0]?.date_et ?? null;
  return (
    <>
      <PageHeader eyebrow="Daily · play with your slabs" title="Slab Boost"
        description={<>Every day, put {BOOST_SLOTS} of your slabs to work. Pick a player in tonight&apos;s real games and back him with a slab: his fantasy points × the slab&apos;s multiplier pay you Pack Points, live as he plays. The more a slab is worth on the market, the bigger its multiplier, and backing a player with his own slab adds +{OWN_PLAYER_BONUS.toFixed(1)}×.</>} />
      <BoostBoard
        initial={boostLive(u.id, today)}
        slots={BOOST_SLOTS}
        ownBonus={OWN_PLAYER_BONUS}
        players={players.map((p) => ({ id: p.id, name: p.name, pos: p.pos, team: p.team, headshot: p.headshot, injury: p.injury, proj: p.proj_dk, opp: p.opp, start: p.game.start_ts, locked: p.locked }))}
        slabs={boostSlabs(u.id).map((s) => ({ cardId: s.card_id, slabId: s.slab_id, playerId: s.player_id, label: `${s.year ?? ""} ${s.set_name ?? ""}`.trim(), player: s.player, grade: `${s.company} ${s.grade}`, rarity: s.rarity, value: s.value, mult: s.mult }))}
        history={boostHistory(u.id).filter((h) => h.date_et !== today).map((h) => ({ ...h, label: dayLabel(h.date_et) }))}
        noGames={next ? `No NBA games today. Next games: ${dayLabel(next)}.` : players.length ? null : "No NBA games scheduled this week."}
      />
    </>
  );
}
