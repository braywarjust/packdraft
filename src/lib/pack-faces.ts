// The well-known players shown face-up on each pack's cover (PackArt). A static snapshot of their team, number,
// colours and NBA.com photo (taken 2026-10-19) so the pack art needs no data loading; refresh it if one is traded.
import type { Rarity } from "./packs";

type Face = { name: string; team: string; team_name: string; pos: string; jersey: string | null; color: string | null; alt: string | null; photo: string | null; action?: string };
const P: Record<string, Face> = {
  "Cooper Flagg": { name: "Cooper Flagg", team: "DAL", team_name: "Dallas Mavericks", pos: "F", jersey: "32", color: "0064b1", alt: "bbc4ca", photo: "https://cdn.nba.com/headshots/nba/latest/1040x760/1642843.png" },
  "Anthony Edwards": { name: "Anthony Edwards", team: "MIN", team_name: "Minnesota Timberwolves", pos: "G", jersey: "5", color: "266092", alt: "79bc43", photo: "https://cdn.nba.com/headshots/nba/latest/1040x760/1630162.png" },
  "Victor Wembanyama": { name: "Victor Wembanyama", team: "SA", team_name: "San Antonio Spurs", pos: "F", jersey: "1", color: "000000", alt: "c4ced4", photo: "https://cdn.nba.com/headshots/nba/latest/1040x760/1641705.png" },
  "Stephen Curry": { name: "Stephen Curry", team: "GS", team_name: "Golden State Warriors", pos: "G", jersey: "30", color: "fdb927", alt: "1d428a", photo: "https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png" },
  "Giannis Antetokounmpo": { name: "Giannis Antetokounmpo", team: "MIA", team_name: "Miami Heat", pos: "F", jersey: "7", color: "98002e", alt: "000000", photo: "https://cdn.nba.com/headshots/nba/latest/1040x760/203507.png" },
  "LeBron James": { name: "LeBron James", team: "PHI", team_name: "Philadelphia 76ers", pos: "F", jersey: "23", color: "1d428a", alt: "e01234", photo: "https://cdn.nba.com/headshots/nba/latest/1040x760/2544.png" },
  "Luka Doncic": { name: "Luka Doncic", team: "LAL", team_name: "Los Angeles Lakers", pos: "G", jersey: "77", color: "552583", alt: "fdb927", photo: "https://a.espncdn.com/i/headshots/nba/players/full/3945274.png" },
  "Nikola Jokic": { name: "Nikola Jokic", team: "DEN", team_name: "Denver Nuggets", pos: "C", jersey: "15", color: "0e2240", alt: "fec524", photo: "https://a.espncdn.com/i/headshots/nba/players/full/3112335.png" },
  "Shai Gilgeous-Alexander": { name: "Shai Gilgeous-Alexander", team: "OKC", team_name: "Oklahoma City Thunder", pos: "G", jersey: "2", color: "007ac1", alt: "ef3b24", photo: "https://cdn.nba.com/headshots/nba/latest/1040x760/1628983.png" },
};

/** Cover slabs per pack: the player and the tier he's shown at (the tier the pack is about). */
export const PACK_FACES: Record<string, { player: Face; rarity: Rarity }[]> = {
  rookie: [{ player: P["Cooper Flagg"], rarity: "common" }],
  starter: [{ player: P["Anthony Edwards"], rarity: "rare" }],
  pro: [{ player: P["Victor Wembanyama"], rarity: "epic" }],
  allpro: [{ player: P["Stephen Curry"], rarity: "epic" }],
  hof: [{ player: P["Giannis Antetokounmpo"], rarity: "legendary" }],
  goat: [{ player: P["LeBron James"], rarity: "legendary" }],
  megacase: [
    { player: P["Anthony Edwards"], rarity: "epic" }, { player: P["Luka Doncic"], rarity: "legendary" }, { player: { ...P["Nikola Jokic"], action: "/immortal/3112335.webp" }, rarity: "grail" },
    { player: P["Shai Gilgeous-Alexander"], rarity: "legendary" }, { player: P["Victor Wembanyama"], rarity: "epic" },
  ],
};
