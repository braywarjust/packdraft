import { all, one, run, tx, Player } from "./db";
import { finalStats, liveStats, score, rng, weekProj } from "./sim";
import { PACKS, PACK_BY_ID } from "./packs";
import { eligible, awardPack } from "./league";

export const SALARY_CAP = 50_000;
export const DFS_SLOTS = ["QB", "RB1", "RB2", "WR1", "WR2", "WR3", "TE", "FLEX", "DST"];

export type Contest = {
  id: number; name: string; creator_id: number; entry_fee: number; prize_pack: string; max_entries: number;
  status: string; started_at: number | null; sim_minutes: number; created_at: number;
};
export type Entry = { id: number; contest_id: number; user_id: number | null; bot_name: string | null; lineup: string; points: number | null; rank: number | null; user_name?: string };

export const contestSeed = (id: number) => `D${id}`;
// Salary scales with where a player sits in his position's projection range.
const SAL_RANGE: Record<string, [lo: number, hi: number, top: number]> = {
  QB: [14, 24, 8600], RB: [6, 20, 9400], WR: [6, 19, 9200], TE: [5, 14, 7400], DST: [5, 9.5, 5000],
};
export function salary(p: { proj: number; pos: string }) {
  const [lo, hi, top] = SAL_RANGE[p.pos] ?? [5, 20, 9000];
  const t = Math.min(1, Math.max(0, (p.proj - lo) / (hi - lo)));
  return Math.round((3000 + t * (top - 3000)) / 100) * 100;
}
export function contestProgress(c: Contest) {
  if (!c.started_at) return 0;
  return Math.min(1, (Date.now() - c.started_at) / (c.sim_minutes * 60_000));
}

export function validateLineup(lineup: number[]) {
  if (lineup.length !== DFS_SLOTS.length || new Set(lineup).size !== lineup.length) throw new Error("Fill every slot with different players");
  const players = lineup.map((id) => one<Player>("SELECT * FROM players WHERE id = ?", id));
  let total = 0;
  players.forEach((p, i) => {
    if (!p || !eligible(DFS_SLOTS[i], p.pos)) throw new Error(`Invalid player for ${DFS_SLOTS[i]}`);
    total += salary(p);
  });
  if (total > SALARY_CAP) throw new Error("Over the salary cap");
}

const BOT_NAMES = ["SharpShooter99", "GrinderGary", "StackMaster", "ChalkEater", "TiltedTom", "LateSwapLarry", "PuntGod", "OptimizerBot"];
export function botLineup(seed: string): number[] {
  const r = rng(seed);
  const players = all<Player>("SELECT * FROM players ORDER BY adp");
  for (let attempt = 0; attempt < 200; attempt++) {
    const picked: number[] = [];
    let spent = 0;
    for (let i = 0; i < DFS_SLOTS.length; i++) {
      const slotsLeft = DFS_SLOTS.length - i - 1;
      const opts = players.filter((p) => eligible(DFS_SLOTS[i], p.pos) && !picked.includes(p.id) && spent + salary(p) + slotsLeft * 3000 <= SALARY_CAP);
      if (!opts.length) break;
      const p = opts[Math.floor(Math.pow(r(), 1.8) * Math.min(opts.length, 30))];
      picked.push(p.id);
      spent += salary(p);
    }
    if (picked.length === DFS_SLOTS.length) return picked;
  }
  throw new Error("Could not build bot lineup");
}

export function addBots(c: Contest, count: number) {
  const existing = all<Entry>("SELECT * FROM dfs_entries WHERE contest_id = ?", c.id).length;
  const n = Math.min(count, c.max_entries - existing);
  for (let i = 0; i < n; i++) {
    const name = BOT_NAMES[(existing + i) % BOT_NAMES.length] + (existing + i >= BOT_NAMES.length ? `_${existing + i}` : "");
    run("INSERT INTO dfs_entries (contest_id, user_id, bot_name, lineup, created_at) VALUES (?, NULL, ?, ?, ?)",
      c.id, name, JSON.stringify(botLineup(`bot:${c.id}:${existing + i}`)), Date.now());
  }
}

export function entryLive(c: Contest, e: Entry, progress: number) {
  const seed = contestSeed(c.id);
  const ids: number[] = JSON.parse(e.lineup);
  let pts = 0, remain = 0;
  const players = ids.map((id, i) => {
    const p = one<Player>("SELECT * FROM players WHERE id = ?", id)!;
    const { stats, g } = liveStats(p, seed, progress);
    const s = score(stats, p.pos, "ppr");
    pts += s;
    remain += weekProj(p, seed) * (1 - g);
    return { slot: DFS_SLOTS[i], id: p.id, name: p.name, pos: p.pos, team: p.team, pts: s, g, salary: salary(p) };
  });
  return { pts: Math.round(pts * 100) / 100, remain, players };
}

export function settleContest(contestId: number) {
  tx(() => {
    const c = one<Contest>("SELECT * FROM dfs_contests WHERE id = ?", contestId)!;
    if (c.status !== "live") return;
    const seed = contestSeed(c.id);
    const entries = all<Entry>("SELECT * FROM dfs_entries WHERE contest_id = ?", c.id).map((e) => {
      const ids: number[] = JSON.parse(e.lineup);
      const pts = ids.reduce((s, id) => {
        const p = one<Player>("SELECT * FROM players WHERE id = ?", id)!;
        return s + score(finalStats(p, seed), p.pos, "ppr");
      }, 0);
      return { ...e, points: Math.round(pts * 100) / 100 };
    });
    entries.sort((a, b) => b.points - a.points);
    const idx = PACKS.findIndex((p) => p.id === c.prize_pack);
    const prizes = [c.prize_pack, PACKS[Math.max(0, idx - 1)].id, "rookie"];
    entries.forEach((e, i) => {
      run("UPDATE dfs_entries SET points = ?, rank = ? WHERE id = ?", e.points, i + 1, e.id);
      if (e.user_id && i < prizes.length) awardPack(e.user_id, prizes[i], `DFS: ${c.name} · ${["1st", "2nd", "3rd"][i]} place`);
    });
    run("UPDATE dfs_contests SET status = 'final' WHERE id = ?", c.id);
  });
}

export function maybeSettle(c: Contest) {
  if (c.status === "live" && contestProgress(c) >= 1) settleContest(c.id);
}

export const prizeLadder = (c: Contest) => {
  const idx = PACKS.findIndex((p) => p.id === c.prize_pack);
  return [PACK_BY_ID[c.prize_pack], PACKS[Math.max(0, idx - 1)], PACK_BY_ID.rookie];
};
