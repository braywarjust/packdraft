// Thin client for ESPN's public (unofficial, keyless) NBA endpoints.
const SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const WEB = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba";

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Mozilla/5.0 PackDraft" } });
  if (!r.ok) throw new Error(`ESPN ${r.status} for ${url}`);
  return r.json() as Promise<T>;
}

// ---------- Dates (NBA days are Eastern time) ----------
const etFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
export const etDate = (ts: number = Date.now()) => etFmt.format(new Date(ts)); // YYYY-MM-DD
export const compact = (d: string) => d.replaceAll("-", "");
export function addDays(d: string, n: number) {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
export const weekday = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay(); // 0 = Sunday
export const dayLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// ---------- Teams & rosters ----------
export type EspnTeam = { id: string; abbreviation: string; displayName: string; shortDisplayName: string; color?: string; alternateColor?: string; logos?: { href: string }[] };
export async function fetchTeams() {
  const d = await get<{ sports: { leagues: { teams: { team: EspnTeam }[] }[] }[] }>(`${SITE}/teams`);
  return d.sports[0].leagues[0].teams.map((t) => t.team);
}

export type EspnRosterAthlete = {
  id: string; displayName: string; jersey?: string; position?: { abbreviation: string };
  headshot?: { href: string }; injuries?: { status: string }[]; status?: { type: string };
};
export async function fetchRoster(teamId: string) {
  const d = await get<{ athletes: EspnRosterAthlete[] }>(`${SITE}/teams/${teamId}/roster`);
  return d.athletes;
}

// ---------- Season averages ----------
export type Averages = { gp: number; min: number; pts: number; fgm: number; fga: number; tpm: number; tpa: number; ftm: number; fta: number; reb: number; ast: number; stl: number; blk: number; to: number };
export async function fetchSeasonAverages(seasonYear: number): Promise<Map<string, Averages>> {
  type Row = { athlete: { id: string }; categories: { name: string; totals: string[] }[] };
  type Resp = { athletes?: Row[]; categories?: { name: string; names: string[] }[] };
  const d = await get<Resp>(`${WEB}/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&limit=1000&page=1&season=${seasonYear}&seasontype=2`);
  const out = new Map<string, Averages>();
  if (!d.athletes || !d.categories) return out;
  const idx = new Map(d.categories.map((c) => [c.name, c.names]));
  for (const a of d.athletes) {
    const val = (cat: string, name: string) => {
      const names = idx.get(cat) ?? [];
      const c = a.categories.find((x) => x.name === cat);
      const i = names.indexOf(name);
      return c && i >= 0 ? Number(c.totals[i]) || 0 : 0;
    };
    out.set(a.athlete.id, {
      gp: val("general", "gamesPlayed"), min: val("general", "avgMinutes"), reb: val("general", "avgRebounds"),
      pts: val("offensive", "avgPoints"), fgm: val("offensive", "avgFieldGoalsMade"), fga: val("offensive", "avgFieldGoalsAttempted"),
      tpm: val("offensive", "avgThreePointFieldGoalsMade"), tpa: val("offensive", "avgThreePointFieldGoalsAttempted"),
      ftm: val("offensive", "avgFreeThrowsMade"), fta: val("offensive", "avgFreeThrowsAttempted"),
      ast: val("offensive", "avgAssists"), to: val("offensive", "avgTurnovers"),
      stl: val("defensive", "avgSteals"), blk: val("defensive", "avgBlocks"),
    });
  }
  return out;
}

// ---------- Schedule & live games ----------
export type EspnGame = {
  id: string; date: string; dateEt: string; startTs: number; state: "pre" | "in" | "post"; detail: string;
  period: number; clock: string; home: string; away: string; homeScore: number; awayScore: number; seasonType: number;
};
type ScoreboardEvent = {
  id: string; date: string; season?: { type: number };
  status: { period?: number; displayClock?: string; type: { state: "pre" | "in" | "post"; shortDetail: string } };
  competitions: { competitors: { homeAway: string; score?: string; team: { abbreviation: string } }[] }[];
};
export async function fetchScoreboard(dateEt: string): Promise<{ games: EspnGame[]; season: number; seasonType: number }> {
  const d = await get<{ events: ScoreboardEvent[]; leagues?: { season?: { year: number; type?: { type: number } } }[] }>(`${SITE}/scoreboard?dates=${compact(dateEt)}&limit=50`);
  const games = d.events.map((e) => {
    const c = e.competitions[0].competitors;
    const home = c.find((x) => x.homeAway === "home")!;
    const away = c.find((x) => x.homeAway === "away")!;
    const startTs = Date.parse(e.date);
    return {
      id: e.id, date: e.date, dateEt: etDate(startTs), startTs, state: e.status.type.state, detail: e.status.type.shortDetail,
      period: e.status.period ?? 0, clock: e.status.displayClock ?? "", home: home.team.abbreviation, away: away.team.abbreviation,
      homeScore: Number(home.score ?? 0), awayScore: Number(away.score ?? 0), seasonType: e.season?.type ?? 2,
    };
  });
  return { games, season: d.leagues?.[0]?.season?.year ?? 0, seasonType: d.leagues?.[0]?.season?.type?.type ?? 2 };
}

export type BoxLine = { athleteId: string; name: string; team: string; dnp: boolean; stats: Record<string, string> };
export async function fetchBoxScore(gameId: string): Promise<BoxLine[]> {
  type Resp = { boxscore?: { players?: { team: { abbreviation: string }; statistics: { keys: string[]; athletes: { athlete: { id: string; displayName: string }; stats: string[]; didNotPlay?: boolean }[] }[] }[] } };
  const d = await get<Resp>(`${SITE}/summary?event=${gameId}`);
  const out: BoxLine[] = [];
  for (const side of d.boxscore?.players ?? []) {
    const s = side.statistics[0];
    if (!s) continue;
    for (const a of s.athletes) {
      const stats: Record<string, string> = {};
      s.keys.forEach((k, i) => (stats[k] = a.stats[i] ?? ""));
      out.push({ athleteId: a.athlete.id, name: a.athlete.displayName, team: side.team.abbreviation, dnp: !!a.didNotPlay || !a.stats.length, stats });
    }
  }
  return out;
}
