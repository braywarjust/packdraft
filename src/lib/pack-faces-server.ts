// Pack cover players kept current: each face's team, number, colours and photo come from today's player data, so a
// trade or a new season's photos show up on the packs by themselves. A cover player who's no longer in the league
// (retired, unsigned) is swapped for the best active player not already on that pack.
import { all } from "./db";
import { PACK_FACES } from "./pack-faces";
import { slabPlayerPhoto } from "./nba/photos";

type Row = { name: string; pos: string; jersey: string | null; headshot: string | null; team: string; team_name: string; color: string | null; alt: string | null; proj: number };

let cache: { at: number; faces: typeof PACK_FACES } | null = null;
export function livePackFaces(): typeof PACK_FACES {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.faces;
  try {
    const rows = all<Row>(
      `SELECT p.name, p.pos, p.jersey, p.headshot, p.team, t.name team_name, t.color, t.alt, p.proj
       FROM players p JOIN nba_teams t ON t.abbr = p.team WHERE p.active = 1 ORDER BY p.proj DESC`);
    const byName = new Map(rows.map((r) => [r.name, r]));
    const face = (r: Row) => ({ name: r.name, team: r.team, team_name: r.team_name, pos: r.pos, jersey: r.jersey, color: r.color, alt: r.alt, photo: slabPlayerPhoto(r.name) ?? r.headshot });
    const faces = Object.fromEntries(Object.entries(PACK_FACES).map(([id, list]) => {
      const used = new Set(list.map((f) => f.player.name));
      return [id, list.map((f) => {
        const r = byName.get(f.player.name) ?? rows.find((x) => !used.has(x.name));
        if (!r) return f;
        used.add(r.name);
        return { ...f, player: face(r) };
      })];
    })) as typeof PACK_FACES;
    cache = { at: Date.now(), faces };
    return faces;
  } catch {
    return PACK_FACES;
  }
}
