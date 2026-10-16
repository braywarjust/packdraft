import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL COLLATE NOCASE, pin_hash TEXT, color TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 1000, last_bonus TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, pos TEXT NOT NULL, team TEXT NOT NULL, jersey TEXT, headshot TEXT,
  injury TEXT, avg TEXT, proj REAL NOT NULL DEFAULT 0, proj_dk REAL NOT NULL DEFAULT 0, adp INTEGER NOT NULL DEFAULT 999,
  pos_rank INTEGER NOT NULL DEFAULT 99, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS nba_teams (
  abbr TEXT PRIMARY KEY, espn_id TEXT NOT NULL, name TEXT NOT NULL, short TEXT NOT NULL, color TEXT, alt TEXT, logo TEXT
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY, date_et TEXT NOT NULL, start_ts INTEGER NOT NULL, home TEXT NOT NULL, away TEXT NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0, away_score INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, detail TEXT,
  period INTEGER NOT NULL DEFAULT 0, clock TEXT, season_type INTEGER NOT NULL DEFAULT 2, box_at INTEGER, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS player_games (game_id TEXT NOT NULL, player_id INTEGER NOT NULL, stats TEXT NOT NULL, PRIMARY KEY (game_id, player_id));
CREATE TABLE IF NOT EXISTS daily_slots (
  team_id INTEGER NOT NULL, date_et TEXT NOT NULL, player_id INTEGER NOT NULL, slot TEXT NOT NULL, PRIMARY KEY (team_id, date_et, player_id)
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS leagues (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, commissioner_id INTEGER NOT NULL, is_public INTEGER NOT NULL DEFAULT 0,
  max_teams INTEGER NOT NULL DEFAULT 8, scoring TEXT NOT NULL DEFAULT 'espn', mode TEXT NOT NULL DEFAULT 'real', start_date TEXT, waiver_type TEXT NOT NULL DEFAULT 'faab',
  faab_budget INTEGER NOT NULL DEFAULT 100, keeper_count INTEGER NOT NULL DEFAULT 0, pick_seconds INTEGER NOT NULL DEFAULT 60,
  sim_minutes REAL NOT NULL DEFAULT 5, season_weeks INTEGER NOT NULL DEFAULT 20, invite_code TEXT NOT NULL,
  reward_win TEXT NOT NULL DEFAULT 'pro', reward_loss TEXT NOT NULL DEFAULT 'rookie', reward_top TEXT NOT NULL DEFAULT 'hof',
  draft_status TEXT NOT NULL DEFAULT 'pre', draft_order TEXT, pick_deadline INTEGER, last_pick_at INTEGER,
  current_week INTEGER NOT NULL DEFAULT 1, week_started_at INTEGER, champion_team_id INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY, league_id INTEGER NOT NULL, user_id INTEGER, name TEXT NOT NULL, is_cpu INTEGER NOT NULL DEFAULT 0,
  autodraft INTEGER NOT NULL DEFAULT 0, faab INTEGER NOT NULL DEFAULT 100, wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0, ties INTEGER NOT NULL DEFAULT 0, points_for REAL NOT NULL DEFAULT 0,
  points_against REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS roster (
  team_id INTEGER NOT NULL, player_id INTEGER NOT NULL, slot TEXT NOT NULL, league_id INTEGER NOT NULL,
  PRIMARY KEY (league_id, player_id)
);
CREATE TABLE IF NOT EXISTS keepers (
  league_id INTEGER NOT NULL, team_id INTEGER NOT NULL, player_id INTEGER NOT NULL, round INTEGER NOT NULL,
  PRIMARY KEY (league_id, player_id)
);
CREATE TABLE IF NOT EXISTS draft_picks (
  id INTEGER PRIMARY KEY, league_id INTEGER NOT NULL, overall INTEGER NOT NULL, round INTEGER NOT NULL,
  team_id INTEGER NOT NULL, player_id INTEGER NOT NULL, is_keeper INTEGER NOT NULL DEFAULT 0, made_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS draft_queue (team_id INTEGER NOT NULL, player_id INTEGER NOT NULL, rank INTEGER NOT NULL, PRIMARY KEY (team_id, player_id));
CREATE TABLE IF NOT EXISTS matchups (
  id INTEGER PRIMARY KEY, league_id INTEGER NOT NULL, week INTEGER NOT NULL, home_team_id INTEGER NOT NULL,
  away_team_id INTEGER NOT NULL, home_score REAL, away_score REAL, final INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS waiver_claims (
  id INTEGER PRIMARY KEY, league_id INTEGER NOT NULL, team_id INTEGER NOT NULL, add_player_id INTEGER NOT NULL,
  drop_player_id INTEGER, bid INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY, league_id INTEGER NOT NULL, from_team_id INTEGER NOT NULL, to_team_id INTEGER NOT NULL,
  give TEXT NOT NULL, get TEXT NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY, league_id INTEGER NOT NULL, user_id INTEGER, kind TEXT NOT NULL DEFAULT 'text',
  body TEXT, image_url TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS user_packs (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, pack_type TEXT NOT NULL, source TEXT NOT NULL,
  opened_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, pack_id INTEGER NOT NULL, player_id INTEGER NOT NULL,
  rarity TEXT NOT NULL, grade REAL NOT NULL, serial INTEGER NOT NULL, print_run INTEGER NOT NULL, value INTEGER NOT NULL,
  sold INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS slabs (
  id INTEGER PRIMARY KEY, file TEXT UNIQUE NOT NULL, era TEXT, year INTEGER, set_name TEXT, card_no TEXT, player TEXT NOT NULL,
  variant TEXT, company TEXT NOT NULL, grade TEXT NOT NULL, grade_num REAL, cert TEXT NOT NULL, flags TEXT NOT NULL,
  factors TEXT NOT NULL, player_tier TEXT, player_id INTEGER, score REAL NOT NULL, rarity TEXT NOT NULL, est_value INTEGER NOT NULL,
  mkt_value INTEGER, mkt_source TEXT, mkt_detail TEXT, mkt_at INTEGER, pop INTEGER, pop_higher INTEGER, pop_at INTEGER,
  card_id INTEGER, missing INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_slabs_pick ON slabs(rarity, card_id, est_value);
CREATE TABLE IF NOT EXISTS dfs_contests (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, creator_id INTEGER NOT NULL, entry_fee INTEGER NOT NULL DEFAULT 0,
  prize_pack TEXT NOT NULL DEFAULT 'pro', max_entries INTEGER NOT NULL DEFAULT 20, status TEXT NOT NULL DEFAULT 'open',
  started_at INTEGER, sim_minutes REAL NOT NULL DEFAULT 3, mode TEXT NOT NULL DEFAULT 'real', slate_date TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dfs_entries (
  id INTEGER PRIMARY KEY, contest_id INTEGER NOT NULL, user_id INTEGER, bot_name TEXT, lineup TEXT NOT NULL,
  points REAL, rank INTEGER, created_at INTEGER NOT NULL
);
-- Pack Points paid out for each started player-game in a league (one row per team, player and game).
CREATE TABLE IF NOT EXISTS pp_earnings (
  league_id INTEGER NOT NULL, week INTEGER NOT NULL, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL, game_key TEXT NOT NULL, fpts REAL NOT NULL, rate REAL NOT NULL, pp INTEGER NOT NULL,
  created_at INTEGER NOT NULL, PRIMARY KEY (team_id, player_id, game_key)
);
CREATE INDEX IF NOT EXISTS idx_pp_user ON pp_earnings(user_id, league_id, week);
CREATE INDEX IF NOT EXISTS idx_roster_team ON roster(team_id);
CREATE INDEX IF NOT EXISTS idx_msgs ON messages(league_id, id);
CREATE INDEX IF NOT EXISTS idx_picks ON draft_picks(league_id, overall);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(date_et);
CREATE INDEX IF NOT EXISTS idx_pg_player ON player_games(player_id);
`;

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, "packdraft-nba.db");
  const fresh = !fs.existsSync(file);
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 10000;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("BEGIN IMMEDIATE");
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) n FROM players").get() as { n: number };
  if (n === 0) seedFromSnapshot(db);
  // Migrations for databases created before slabs existed.
  const cardCols = (db.prepare("PRAGMA table_info(cards)").all() as { name: string }[]).map((c) => c.name);
  if (!cardCols.includes("slab_id")) db.exec("ALTER TABLE cards ADD COLUMN slab_id INTEGER");
  const userCols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
  if (!userCols.includes("is_tester")) db.exec("ALTER TABLE users ADD COLUMN is_tester INTEGER NOT NULL DEFAULT 0");
  if (fresh) carryOverUsers(db);
  db.exec("COMMIT");
  return db;
}

// Bundled snapshot of NBA rosters/averages so the app works before the first live sync.
function seedFromSnapshot(db: DatabaseSync) {
  const snap = path.join(process.cwd(), "src", "lib", "nba", "seed.json");
  if (!fs.existsSync(snap)) return;
  const { teams, players } = JSON.parse(fs.readFileSync(snap, "utf8")) as { teams: Record<string, unknown>[]; players: Record<string, unknown>[] };
  const t = db.prepare("INSERT OR REPLACE INTO nba_teams (abbr, espn_id, name, short, color, alt, logo) VALUES (?, ?, ?, ?, ?, ?, ?)");
  for (const x of teams) t.run(x.abbr as string, x.espn_id as string, x.name as string, x.short as string, x.color as string, x.alt as string, x.logo as string);
  const p = db.prepare("INSERT OR REPLACE INTO players (id, name, pos, team, jersey, headshot, injury, avg, proj, proj_dk, adp, pos_rank, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
  for (const x of players)
    p.run(x.id as number, x.name as string, x.pos as string, x.team as string, (x.jersey as string) ?? null, (x.headshot as string) ?? null,
      (x.injury as string) ?? null, (x.avg as string) ?? null, x.proj as number, x.proj_dk as number, x.adp as number, x.pos_rank as number);
}

// Accounts from the original football build come along so nobody has to re-register.
function carryOverUsers(db: DatabaseSync) {
  const old = path.join(DATA_DIR, "packdraft.db");
  if (!fs.existsSync(old)) return;
  try {
    const o = new DatabaseSync(old, { readOnly: true });
    const rows = o.prepare("SELECT name, pin_hash, color, created_at FROM users").all() as { name: string; pin_hash: string | null; color: string; created_at: number }[];
    const ins = db.prepare("INSERT OR IGNORE INTO users (name, pin_hash, color, created_at) VALUES (?, ?, ?, ?)");
    for (const r of rows) ins.run(r.name, r.pin_hash, r.color, r.created_at);
    o.close();
  } catch {
    // Old file unreadable: start fresh.
  }
}

const g = globalThis as unknown as { __pdDb?: DatabaseSync };
// Opened lazily so importing this module (e.g. during `next build`) never touches the file.
function db(): DatabaseSync {
  return g.__pdDb ?? (g.__pdDb = open());
}

type Param = string | number | null | bigint;
export function all<T>(sql: string, ...params: Param[]): T[] {
  // node:sqlite returns null-prototype rows; spread them into plain objects so React can serialize them.
  return db().prepare(sql).all(...params).map((r) => ({ ...r })) as T[];
}
export function one<T>(sql: string, ...params: Param[]): T | undefined {
  const r = db().prepare(sql).get(...params);
  return (r ? { ...r } : undefined) as T | undefined;
}
export function run(sql: string, ...params: Param[]) {
  return db().prepare(sql).run(...params);
}
export function tx<T>(fn: () => T): T {
  db().exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db().exec("COMMIT");
    return r;
  } catch (e) {
    db().exec("ROLLBACK");
    throw e;
  }
}

export type User = { id: number; name: string; color: string; coins: number; last_bonus: string | null; pin_hash: string | null; is_tester: number };
export type Player = {
  id: number; name: string; pos: string; team: string; jersey: string | null; headshot: string | null; injury: string | null;
  avg: string | null; proj: number; proj_dk: number; adp: number; pos_rank: number; active: number;
};
export type Game = {
  id: string; date_et: string; start_ts: number; home: string; away: string; home_score: number; away_score: number;
  state: string; detail: string | null; period: number; clock: string | null; season_type: number; box_at: number | null; updated_at: number;
};
export type League = {
  id: number; name: string; commissioner_id: number; is_public: number; max_teams: number; scoring: string; mode: string; start_date: string | null;
  waiver_type: string; faab_budget: number; keeper_count: number; pick_seconds: number; sim_minutes: number;
  season_weeks: number; invite_code: string; reward_win: string; reward_loss: string; reward_top: string;
  draft_status: string; draft_order: string | null; pick_deadline: number | null; last_pick_at: number | null;
  current_week: number; week_started_at: number | null; champion_team_id: number | null; created_at: number;
};
export type Team = {
  id: number; league_id: number; user_id: number | null; name: string; is_cpu: number; autodraft: number; faab: number;
  wins: number; losses: number; ties: number; points_for: number; points_against: number;
};
export type Matchup = {
  id: number; league_id: number; week: number; home_team_id: number; away_team_id: number;
  home_score: number | null; away_score: number | null; final: number;
};
