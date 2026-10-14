import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { seedPlayers } from "./players";

export const DATA_DIR = path.join(process.cwd(), "data");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL COLLATE NOCASE, pin_hash TEXT, color TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 1000, last_bonus TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, pos TEXT NOT NULL, team TEXT NOT NULL,
  proj REAL NOT NULL, adp INTEGER NOT NULL, pos_rank INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS leagues (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, commissioner_id INTEGER NOT NULL, is_public INTEGER NOT NULL DEFAULT 0,
  max_teams INTEGER NOT NULL DEFAULT 8, scoring TEXT NOT NULL DEFAULT 'ppr', waiver_type TEXT NOT NULL DEFAULT 'faab',
  faab_budget INTEGER NOT NULL DEFAULT 100, keeper_count INTEGER NOT NULL DEFAULT 0, pick_seconds INTEGER NOT NULL DEFAULT 60,
  sim_minutes REAL NOT NULL DEFAULT 5, season_weeks INTEGER NOT NULL DEFAULT 14, invite_code TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS dfs_contests (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, creator_id INTEGER NOT NULL, entry_fee INTEGER NOT NULL DEFAULT 0,
  prize_pack TEXT NOT NULL DEFAULT 'pro', max_entries INTEGER NOT NULL DEFAULT 20, status TEXT NOT NULL DEFAULT 'open',
  started_at INTEGER, sim_minutes REAL NOT NULL DEFAULT 3, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS dfs_entries (
  id INTEGER PRIMARY KEY, contest_id INTEGER NOT NULL, user_id INTEGER, bot_name TEXT, lineup TEXT NOT NULL,
  points REAL, rank INTEGER, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roster_team ON roster(team_id);
CREATE INDEX IF NOT EXISTS idx_msgs ON messages(league_id, id);
CREATE INDEX IF NOT EXISTS idx_picks ON draft_picks(league_id, overall);
`;

function open(): DatabaseSync {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "packdraft.db"));
  db.exec("PRAGMA busy_timeout = 10000;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("BEGIN IMMEDIATE");
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) n FROM players").get() as { n: number };
  if (n === 0) {
    const ins = db.prepare("INSERT INTO players (name, pos, team, proj, adp, pos_rank) VALUES (?, ?, ?, ?, ?, ?)");
    for (const p of seedPlayers()) ins.run(p.name, p.pos, p.team, p.proj, p.adp, p.posRank);
  }
  db.exec("COMMIT");
  return db;
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

export type User = { id: number; name: string; color: string; coins: number; last_bonus: string | null; pin_hash: string | null };
export type Player = { id: number; name: string; pos: string; team: string; proj: number; adp: number; pos_rank: number };
export type League = {
  id: number; name: string; commissioner_id: number; is_public: number; max_teams: number; scoring: string;
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
