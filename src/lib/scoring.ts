// Basketball stat lines and fantasy scoring. Pure functions, safe to import from client components.

export type Line = { min: number; pts: number; fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number; reb: number; ast: number; stl: number; blk: number; to: number };
export const EMPTY: Line = { min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0 };

export const SCORING: Record<string, { label: string; blurb: string }> = {
  espn: { label: "ESPN Points", blurb: "PTS 1, 3PM 1, FGM 2, FGA -1, FTM 1, FTA -1, REB 1, AST 2, STL 4, BLK 4, TO -2" },
  dk: { label: "DraftKings Style", blurb: "PTS 1, 3PM 0.5, REB 1.25, AST 1.5, STL 2, BLK 2, TO -0.5, double-double +1.5, triple-double +3" },
};

export function fpts(s: Line, scoring: string): number {
  let v: number;
  if (scoring === "dk") {
    v = s.pts + s.tpm * 0.5 + s.reb * 1.25 + s.ast * 1.5 + s.stl * 2 + s.blk * 2 - s.to * 0.5;
    const doubles = [s.pts, s.reb, s.ast, s.stl, s.blk].filter((x) => x >= 10).length;
    if (doubles >= 3) v += 3;
    else if (doubles >= 2) v += 1.5;
  } else {
    v = s.pts + s.tpm + s.fgm * 2 - s.fga + s.ftm - s.fta + s.reb + s.ast * 2 + s.stl * 4 + s.blk * 4 - s.to * 2;
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
