// Deterministic stat simulator. Every (player, seed) pair produces the same final stat line,
// and a "progress" value (0..1 through the week) reveals it gradually for live scoring.

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
  const L = Math.exp(-Math.max(lambda, 0));
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L && k < 12);
  return k - 1;
}

export type Stats = {
  passYds: number; passTD: number; int: number; rushYds: number; rushTD: number;
  rec: number; recYds: number; recTD: number; fum: number;
  sacks: number; defInt: number; fumRec: number; defTD: number; ptsAllowed: number;
};
const ZERO: Stats = { passYds: 0, passTD: 0, int: 0, rushYds: 0, rushTD: 0, rec: 0, recYds: 0, recTD: 0, fum: 0, sacks: 0, defInt: 0, fumRec: 0, defTD: 0, ptsAllowed: 0 };

type P = { id: number; pos: string; team: string; proj: number };

/** Opponent defensive strength vs. this position for a week: 1 = toughest, 32 = easiest. */
export function oppRank(p: { pos: string; team: string }, seed: string) {
  return (hash(`opp:${p.team}:${p.pos}:${seed}`) % 32) + 1;
}
export function matchupGrade(rank: number) {
  if (rank >= 28) return "A+";
  if (rank >= 23) return "A";
  if (rank >= 18) return "B";
  if (rank >= 12) return "C";
  if (rank >= 6) return "D";
  return "F";
}
export function weekProj(p: P, seed: string) {
  return +(p.proj * (1 + (oppRank(p, seed) - 16.5) / 110)).toFixed(1);
}

export function finalStats(p: P, seed: string): Stats {
  const r = rng(`stats:${p.id}:${seed}`);
  const m = Math.exp(normal(r) * 0.42 - 0.09); // game script multiplier, mean ~1
  const wp = weekProj(p, seed);
  const s = { ...ZERO };
  const yds = (mean: number) => Math.max(0, Math.round(mean * m + normal(r) * mean * 0.18));
  switch (p.pos) {
    case "QB": {
      const k = wp / 20;
      s.passYds = yds(245 * k);
      s.passTD = poisson(r, 1.7 * k * m);
      s.int = poisson(r, 0.8 / Math.max(0.6, m));
      s.rushYds = yds(18 * k);
      s.rushTD = poisson(r, 0.15 * k * m);
      s.fum = poisson(r, 0.12);
      break;
    }
    case "RB": {
      const k = wp / 14;
      s.rushYds = yds(66 * k);
      s.rushTD = poisson(r, 0.5 * k * m);
      s.rec = poisson(r, 3 * k);
      s.recYds = s.rec ? yds(7.5 * s.rec) : 0;
      s.recTD = poisson(r, 0.12 * k * m);
      s.fum = poisson(r, 0.08);
      break;
    }
    case "WR":
    case "TE": {
      const k = wp / (p.pos === "WR" ? 14 : 10);
      s.rec = poisson(r, (p.pos === "WR" ? 5.5 : 4.5) * k * m);
      s.recYds = s.rec ? yds((p.pos === "WR" ? 13 : 10.5) * s.rec) : 0;
      s.recTD = poisson(r, (p.pos === "WR" ? 0.45 : 0.35) * k * m);
      s.rushYds = p.pos === "WR" && r() < 0.25 ? Math.round(r() * 18) : 0;
      s.fum = poisson(r, 0.04);
      break;
    }
    case "DST": {
      const k = wp / 7;
      s.sacks = poisson(r, 2.5 * k * m);
      s.defInt = poisson(r, 0.9 * k * m);
      s.fumRec = poisson(r, 0.6 * k);
      s.defTD = poisson(r, 0.12 * k * m);
      s.ptsAllowed = Math.max(0, Math.round(22 / (k * m) + normal(r) * 6));
      break;
    }
  }
  return s;
}

export function score(s: Stats, pos: string, scoring: string): number {
  if (pos === "DST") {
    const pa = s.ptsAllowed;
    const paPts = pa === 0 ? 10 : pa <= 6 ? 7 : pa <= 13 ? 4 : pa <= 20 ? 1 : pa <= 27 ? 0 : pa <= 34 ? -1 : -4;
    return s.sacks + 2 * s.defInt + 2 * s.fumRec + 6 * s.defTD + paPts;
  }
  const ppr = scoring === "ppr" ? 1 : scoring === "half" ? 0.5 : 0;
  const pts = s.passYds * 0.04 + s.passTD * 4 - s.int * 2 + s.rushYds * 0.1 + s.rushTD * 6 + s.rec * ppr + s.recYds * 0.1 + s.recTD * 6 - s.fum * 2;
  return Math.round(pts * 100) / 100;
}

/** When this player's game kicks off, as a fraction of the week's progress. */
export function kickoff(p: { team: string }, seed: string) {
  const slots = [0, 0.04, 0.3, 0.3, 0.3, 0.56, 0.62];
  return slots[hash(`ko:${p.team}:${seed}`) % slots.length];
}
const GAME_LEN = 0.38;
export function gameProgress(p: { team: string }, seed: string, progress: number) {
  return Math.min(1, Math.max(0, (progress - kickoff(p, seed)) / GAME_LEN));
}

export function liveStats(p: P, seed: string, progress: number): { stats: Stats; g: number } {
  const g = gameProgress(p, seed, progress);
  const f = finalStats(p, seed);
  if (g >= 1) return { stats: f, g: 1 };
  if (g <= 0) return { stats: { ...ZERO }, g: 0 };
  const r = rng(`live:${p.id}:${seed}`);
  const s = { ...ZERO };
  for (const key of Object.keys(f) as (keyof Stats)[]) {
    const total = f[key];
    if (key === "ptsAllowed") {
      s[key] = Math.round(total * Math.pow(g, 0.9 + r() * 0.3));
      continue;
    }
    if (total <= 6) {
      // Discrete events (TDs, catches, sacks): each happens at its own random moment.
      let c = 0;
      for (let i = 0; i < total; i++) if (r() < g) c++;
      s[key] = c;
    } else {
      s[key] = Math.round(total * Math.pow(g, 0.8 + r() * 0.45));
    }
  }
  return { stats: s, g };
}

export function gameClock(g: number, p: { team: string }, seed: string, progress: number) {
  if (g >= 1) return "Final";
  if (g <= 0) {
    const ko = kickoff(p, seed);
    return progress <= 0 ? (ko === 0 ? "Thu" : ko < 0.3 ? "Sun 1:00" : ko < 0.5 ? "Sun 4:25" : "SNF") : "Pregame";
  }
  const q = Math.min(4, Math.floor(g * 4) + 1);
  const left = Math.max(0, 15 - Math.floor(((g * 4) % 1) * 15));
  return `Q${q} ${left}:00`.replace(/^Q(\d) 15:00$/, "Q$1 15:00");
}

export function statLine(s: Stats, pos: string) {
  const parts: string[] = [];
  if (pos === "DST") {
    parts.push(`${s.ptsAllowed} PA`);
    if (s.sacks) parts.push(`${s.sacks} SCK`);
    if (s.defInt) parts.push(`${s.defInt} INT`);
    if (s.fumRec) parts.push(`${s.fumRec} FR`);
    if (s.defTD) parts.push(`${s.defTD} TD`);
    return parts.join(", ");
  }
  if (s.passYds || s.passTD) parts.push(`${s.passYds} PaYd${s.passTD ? `, ${s.passTD} PaTD` : ""}${s.int ? `, ${s.int} INT` : ""}`);
  if (s.rushYds || s.rushTD) parts.push(`${s.rushYds} RuYd${s.rushTD ? `, ${s.rushTD} RuTD` : ""}`);
  if (s.rec || s.recYds) parts.push(`${s.rec} Rec, ${s.recYds} ReYd${s.recTD ? `, ${s.recTD} ReTD` : ""}`);
  if (s.fum) parts.push(`${s.fum} FUM`);
  return parts.join(" · ") || "—";
}

function phi(x: number) {
  // Abramowitz-Stegun approximation of the standard normal CDF.
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

export function leagueSeed(leagueId: number, week: number) {
  return `L${leagueId}W${week}`;
}
