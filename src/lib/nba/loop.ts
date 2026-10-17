import { all } from "../db";
import { addDays, etDate } from "./espn";
import { backfillFinals, ensureSchedule, maybeSyncPlayers, refreshLive } from "./sync";
import { dailyWaivers, getLeague, tickLeague, weekRange } from "../league";
import { ensureCatalog } from "../slabs";
import { settleBets } from "../bets";

let busy = false;
export async function tick() {
  if (busy) return;
  busy = true;
  try {
    ensureCatalog();
    await maybeSyncPlayers();
    const today = etDate();
    await ensureSchedule(today, addDays(today, 10));
    await refreshLive();
    for (const { id } of all<{ id: number }>("SELECT id FROM leagues WHERE draft_status = 'done' AND champion_team_id IS NULL")) {
      const l = getLeague(id)!;
      if (l.mode !== "sim") {
        const [from, to] = weekRange(l, l.current_week);
        await ensureSchedule(from, to);
        await backfillFinals(from, to);
        dailyWaivers(id);
      }
      tickLeague(id);
    }
    settleBets();
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
