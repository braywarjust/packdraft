// Basketball stat lines and fantasy scoring. Pure functions, safe to import from client components.

export type Line = { min: number; pts: number; fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number; reb: number; ast: number; stl: number; blk: number; to: number };
export const EMPTY: Line = { min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0 };

/** Scoring categories a league can put points on (ESPN's basketball list, minus stats the box score doesn't carry). */
export const STATS = [
  ["pts", "PTS", "Points"], ["tpm", "3PM", "Three pointers made"], ["tpa", "3PA", "Three pointers attempted"],
  ["fgm", "FGM", "Field goals made"], ["fga", "FGA", "Field goals attempted"], ["ftm", "FTM", "Free throws made"],
  ["fta", "FTA", "Free throws attempted"], ["reb", "REB", "Rebounds"], ["ast", "AST", "Assists"], ["stl", "STL", "Steals"],
  ["blk", "BLK", "Blocks"], ["to", "TO", "Turnovers"], ["dd", "DD", "Double-double"], ["td", "TD", "Triple-double"],
] as const;
export type StatKey = (typeof STATS)[number][0];
export type Weights = Partial<Record<StatKey, number>>;
/** Points per stat are kept between these so a typo can't flood the league with Pack Points. */
export const WEIGHT_MIN = -10, WEIGHT_MAX = 10;

const PRESETS: Record<string, { label: string; w: Weights }> = {
  espn: { label: "ESPN Points", w: { pts: 1, tpm: 1, fgm: 2, fga: -1, ftm: 1, fta: -1, reb: 1, ast: 2, stl: 4, blk: 4, to: -2 } },
  // DK's double-double and triple-double bonuses don't stack: a triple-double is worth 3 in all.
  dk: { label: "DraftKings Style", w: { pts: 1, tpm: 0.5, reb: 1.25, ast: 1.5, stl: 2, blk: 2, to: -0.5, dd: 1.5, td: 3 } },
};
export const PRESET_IDS = Object.keys(PRESETS);

/** A league's `scoring` is a preset id ("espn", "dk") or custom points written as "c:pts=1,fgm=2,…". */
export function encodeWeights(w: Weights): string {
  const raw = (x: Weights) => `c:${STATS.filter(([k]) => x[k]).map(([k]) => `${k}=${x[k]}`).join(",")}`;
  const key = raw(w);
  return PRESET_IDS.find((id) => raw(PRESETS[id].w) === key) ?? key;
}

const parsed = new Map<string, Weights>();
export function weightsOf(scoring: string): Weights {
  const preset = PRESETS[scoring];
  if (preset) return preset.w;
  let w = parsed.get(scoring);
  if (!w) {
    w = {};
    for (const part of scoring.replace(/^c:/, "").split(",")) {
      const [k, v] = part.split("=");
      if (STATS.some(([s]) => s === k) && Number.isFinite(Number(v))) w[k as StatKey] = Number(v);
    }
    if (!scoring.startsWith("c:")) w = PRESETS.espn.w; // unknown id: fall back to ESPN
    parsed.set(scoring, w);
  }
  return w;
}

export const scoringLabel = (scoring: string) => PRESETS[scoring]?.label ?? "Custom Points";
/** "PTS 1, 3PM 1, FGM 2, …" */
export const scoringBlurb = (scoring: string) => {
  const w = weightsOf(scoring);
  return STATS.filter(([k]) => w[k]).map(([k, abbr]) => `${abbr} ${w[k]}`).join(", ");
};

export function fpts(s: Line, scoring: string): number {
  const w = weightsOf(scoring);
  let v = 0;
  for (const [k] of STATS) if (k !== "dd" && k !== "td" && w[k]) v += ((s as Record<string, number>)[k] || 0) * w[k]!;
  if (w.dd || w.td) {
    const doubles = [s.pts, s.reb, s.ast, s.stl, s.blk].filter((x) => x >= 10).length;
    if (doubles >= 3 && w.td) v += w.td;
    else if (doubles >= 2) v += w.dd ?? 0;
  }
  return Math.round(v * 100) / 100;
}

export function statLine(s: Line) {
  if (!s.min && !s.pts && !s.reb && !s.ast) return "—";
  const parts = [`${s.pts} PTS`, `${s.reb} REB`, `${s.ast} AST`];
  if (s.stl) parts.push(`${s.stl} STL`);
  if (s.blk) parts.push(`${s.blk} BLK`);
  if (s.tpm) parts.push(`${s.tpm} 3PM`);
  if (s.to) parts.push(`${s.to} TO`);
  return `${parts.join(", ")} · ${s.fgm}-${s.fga} FG`;
}

/** Parse an ESPN box score row (keys like "fieldGoalsMade-fieldGoalsAttempted"). */
export function fromEspn(stats: Record<string, string>): Line {
  const n = (k: string) => Number(stats[k]) || 0;
  const pair = (k: string) => (stats[k] ?? "0-0").split("-").map((x) => Number(x) || 0);
  const [fgm, fga] = pair("fieldGoalsMade-fieldGoalsAttempted");
  const [tpm, tpa] = pair("threePointFieldGoalsMade-threePointFieldGoalsAttempted");
  const [ftm, fta] = pair("freeThrowsMade-freeThrowsAttempted");
  return { min: n("minutes"), pts: n("points"), fgm, fga, tpm, tpa, ftm, fta, reb: n("rebounds"), ast: n("assists"), stl: n("steals"), blk: n("blocks"), to: n("turnovers") };
}

export const POSITIONS = ["G", "F", "C"] as const;
// ESPN-style lineup: the five positions, a G and an F flex, then three UTIL spots.
export const STARTERS = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3"] as const;
export const ROSTER_MAX = 13;
export const slotLabel = (slot: string) => slot.replace(/\d$/, "");
/** A player's fantasy positions, e.g. "PG,SG" → ["PG", "SG"]. Old single-letter G/F cover both of theirs. */
export function positionsOf(pos: string) {
  return pos.split(",").flatMap((x) => (x === "G" ? ["PG", "SG"] : x === "F" ? ["SF", "PF"] : [x]));
}
/** "PG,SG" → "PG, SG" for display. */
export const posLabel = (pos: string) => pos.split(",").join(", ");
const SLOT_TAKES: Record<string, string[]> = { G: ["PG", "SG"], F: ["SF", "PF"] };
/** Can a player with these positions (a player's `elig`, e.g. "SF,PF", or old "G") play this slot? */
export function eligible(slot: string, pos: string) {
  if (slot === "BN") return true;
  const s = slotLabel(slot);
  if (s === "UTIL") return true;
  const mine = positionsOf(pos);
  return (SLOT_TAKES[s] ?? [s]).some((x) => mine.includes(x));
}
