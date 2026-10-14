// Deterministic basketball simulator used by "simulated" leagues and DFS contests (handy between real games).
import { EMPTY, Line, fpts } from "./scoring";

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: () => number) {
  const u = Math.max(r(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
function poisson(r: () => number, lambda: number) {
  if (lambda > 30) return Math.max(0, Math.round(lambda + normal(r) * Math.sqrt(lambda)));
  const L = Math.exp(-Math.max(lambda, 0));
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L && k < 80);
  return k - 1;
}

type SimPlayer = { id: number; team: string; avg: string | null; proj: number };

function averages(p: SimPlayer): Line {
  if (p.avg) return { ...EMPTY, ...JSON.parse(p.avg) };
  // No history: back into a plausible line from the projection.
  const k = Math.max(p.proj, 4) / 25;
  return { min: 24 * k, pts: 12 * k, fgm: 4.5 * k, fga: 10 * k, tpm: 1.2 * k, tpa: 3.4 * k, ftm: 1.8 * k, fta: 2.3 * k, reb: 4.5 * k, ast: 2.5 * k, stl: 0.8 * k, blk: 0.5 * k, to: 1.3 * k };
}

/** One simulated game for a player. */
export function simGame(p: SimPlayer, seed: string): Line {
  const r = rng(`g:${p.id}:${seed}`);
  const a = averages(p);
  const m = Math.exp(normal(r) * 0.3 - 0.045); // hot/cold night
  const tpm = poisson(r, a.tpm * m), fgm2 = poisson(r, Math.max(0, a.fgm - a.tpm) * m), ftm = poisson(r, a.ftm * m);
  const fgm = fgm2 + tpm;
  const miss = (made: number, avgM: number, avgA: number) => made + poisson(r, Math.max(0, avgA - avgM) * (0.8 + r() * 0.5));
  return {
    min: Math.round(a.min * (0.85 + r() * 0.3)), pts: fgm2 * 2 + tpm * 3 + ftm, fgm, fga: miss(fgm, a.fgm, a.fga), tpm, tpa: miss(tpm, a.tpm, a.tpa),
    ftm, fta: miss(ftm, a.ftm, a.fta), reb: poisson(r, a.reb * m), ast: poisson(r, a.ast * m), stl: poisson(r, a.stl), blk: poisson(r, a.blk), to: poisson(r, a.to),
  };
}

const GAME_LEN = 0.22;
/** A simulated week: each NBA team plays 3 or 4 games spread across the week's progress. */
export function simSchedule(team: string, seed: string) {
  const n = 3 + (hash(`n:${team}:${seed}`) % 2);
  const offset = (hash(`o:${team}:${seed}`) % 100) / 1000;
  return Array.from({ length: n }, (_, i) => ({ i, start: Math.min(1 - GAME_LEN, offset + (i * (1 - GAME_LEN)) / n) }));
}
export const gameProgress = (start: number, progress: number) => Math.min(1, Math.max(0, (progress - start) / GAME_LEN));

/** Reveal part of a stat line as a game progresses (0..1). Monotonic in g. */
export function partial(full: Line, g: number, seed: string): Line {
  if (g >= 1) return full;
  if (g <= 0) return { ...EMPTY };
  const r = rng(`live:${seed}`);
  const out = { ...EMPTY };
  for (const k of Object.keys(full) as (keyof Line)[]) {
    const total = full[k];
    if (total <= 8) {
      let c = 0;
      for (let i = 0; i < total; i++) if (r() < g) c++;
      out[k] = c;
    } else out[k] = Math.round(total * Math.pow(g, 0.8 + r() * 0.4));
  }
  // Keep the line internally consistent.
  out.fgm = Math.min(out.fgm, out.fga); out.tpm = Math.min(out.tpm, out.tpa, out.fgm); out.ftm = Math.min(out.ftm, out.fta);
  out.pts = (out.fgm - out.tpm) * 2 + out.tpm * 3 + out.ftm;
  return out;
}

export function simClock(g: number) {
  if (g >= 1) return "Final";
  if (g <= 0) return "Upcoming";
  const q = Math.min(4, Math.floor(g * 4) + 1);
  const left = 12 - Math.floor(((g * 4) % 1) * 12);
  return `Q${q} ${left}:00`;
}

/** Simulated week for one player: points scored so far, games played/left, latest line. */
export function simWeek(p: SimPlayer, seed: string, progress: number, scoring: string) {
  let pts = 0, done = 0, live: { g: number; line: Line } | null = null, lastLine: Line | null = null;
  const games = simSchedule(p.team, seed);
  for (const gm of games) {
    const g = gameProgress(gm.start, progress);
    if (g <= 0) continue;
    const line = partial(simGame(p, `${seed}:${gm.i}`), g, `${p.id}:${seed}:${gm.i}`);
    pts += fpts(line, scoring);
    lastLine = line;
    if (g >= 1) done++;
    else live = { g, line };
  }
  return { pts: Math.round(pts * 100) / 100, games: games.length, done, live, lastLine };
}

function phi(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** Win probability for side A given live scores plus remaining projection/variance. */
export function winProb(a: { score: number; remain: number; variance: number }, b: { score: number; remain: number; variance: number }) {
  const diff = a.score + a.remain - (b.score + b.remain);
  const sd = Math.sqrt(a.variance + b.variance);
  if (sd < 0.01) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
  return phi(diff / sd);
}

export const leagueSeed = (leagueId: number, week: number) => `L${leagueId}W${week}`;
