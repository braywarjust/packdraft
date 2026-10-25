import { all } from "../db";
import { addDays, etDate } from "./espn";
import { backfillFinals, ensureSchedule, maybeSyncPlayers, refreshLive } from "./sync";
import { dailyWaivers, getLeague, playoffInfo, rolloverLeagues, tickLeague, weekRange } from "../league";
import { settleBets } from "../bets";
import { tickNews } from "../news";

let busy = false;
export async function tick() {
  if (busy) return;
  busy = true;
  try {
    await maybeSyncPlayers();
    // New NBA season: finished leagues reset for their next draft.
    rolloverLeagues();
    const today = etDate();
    await ensureSchedule(today, addDays(today, 10));
    await refreshLive();
    for (const { id } of all<{ id: number }>("SELECT id FROM leagues WHERE draft_status = 'done' AND champion_team_id IS NULL")) {
      const l = getLeague(id)!;
      if (l.mode !== "sim") {
        const [from, to] = weekRange(l, l.current_week);
        await ensureSchedule(from, to);
        await backfillFinals(from, to);
        // Keep the rest of the season's schedule loaded too, so upcoming weeks on Matchups open instantly. A week's worth
        // of days per tick at most, so the first warm-up spreads over a few minutes instead of hammering ESPN.
        await ensureSchedule(addDays(to, 1), weekRange(l, playoffInfo(l).lastWeek)[1], { limit: 7 });
        dailyWaivers(id);
      }
      tickLeague(id);
    }
    settleBets();
    await tickNews().catch(() => undefined);
  } finally {
    busy = false;
  }
}

export function startLoop() {
  const g = globalThis as unknown as { __pdLoop?: boolean };
  if (g.__pdLoop) return;
  g.__pdLoop = true;
  const go = () => tick().catch((e) => console.warn("[packdraft] tick failed", (e as Error).message));
  setTimeout(go, 2_000);
  setInterval(go, 30_000);
}
