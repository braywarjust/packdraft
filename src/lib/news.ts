// Player News (Update 3.1): ESPN's fantasy blurbs (RotoWire) per player, cached in player_news.
import { all, one, run } from "./db";

const NEWS = "https://site.api.espn.com/apis/fantasy/v2/games/fba/news/players";
/** A player's news is re-fetched at most this often. */
const STALE_MS = 30 * 60_000;

export type NewsItem = { id: number; player_id: number; headline: string; story: string | null; published: string };

async function fetchPlayer(playerId: number) {
  type Item = { id: number; type: string; headline?: string; story?: string; published?: string; playerId?: number };
  const r = await fetch(`${NEWS}?limit=10&playerId=${playerId}`, { cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Mozilla/5.0 PackDraft" } });
  if (!r.ok) throw new Error(`ESPN news ${r.status}`);
  const { feed = [] } = (await r.json()) as { feed?: Item[] };
  for (const x of feed) {
    // Only the player blurbs; the feed also mixes in general articles and videos.
    if (x.type !== "Rotowire" || !x.headline || !x.published || (x.playerId && x.playerId !== playerId)) continue;
    run("INSERT INTO player_news (id, player_id, headline, story, published) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET headline = excluded.headline, story = excluded.story",
      x.id, playerId, x.headline, x.story ?? null, x.published);
  }
  run("INSERT INTO player_news_fetch (player_id, fetched_at) VALUES (?, ?) ON CONFLICT(player_id) DO UPDATE SET fetched_at = excluded.fetched_at", playerId, Date.now());
}

/** Fetch news for whichever of these players is stale, a few at a time. Failures are skipped (tried again next time). */
export async function refreshNews(playerIds: number[], max = 40) {
  const fresh = new Map(all<{ player_id: number; fetched_at: number }>("SELECT * FROM player_news_fetch").map((r) => [r.player_id, r.fetched_at]));
  const due = playerIds.filter((id) => Date.now() - (fresh.get(id) ?? 0) > STALE_MS).slice(0, max);
  for (let i = 0; i < due.length; i += 8) {
    await Promise.all(due.slice(i, i + 8).map((id) => fetchPlayer(id).catch(() => undefined)));
  }
}

export const playerNews = (playerId: number, limit = 5) =>
  all<NewsItem>("SELECT * FROM player_news WHERE player_id = ? ORDER BY published DESC LIMIT ?", playerId, limit);

/** Latest news across a set of players (a league's), newest first. */
export function newsFeed(playerIds: number[], limit = 40) {
  if (!playerIds.length) return [];
  return all<NewsItem>(`SELECT * FROM player_news WHERE player_id IN (${playerIds.map(() => "?").join(",")}) ORDER BY published DESC LIMIT ?`, ...playerIds, limit);
}

/** Players a league cares about: everyone rostered, plus the best free agents. */
export function leagueNewsPlayers(leagueId: number, freeAgents = 60) {
  const rostered = all<{ player_id: number }>("SELECT player_id FROM roster WHERE league_id = ?", leagueId).map((r) => r.player_id);
  const fa = all<{ id: number }>(
    "SELECT id FROM players WHERE active = 1 AND id NOT IN (SELECT player_id FROM roster WHERE league_id = ?) ORDER BY proj DESC LIMIT ?", leagueId, freeAgents).map((r) => r.id);
  return [...rostered, ...fa];
}

/** Background refresh (from the 30-second loop): a slice of each league's players per tick, so nothing waits on ESPN. */
export async function tickNews() {
  const ids = new Set<number>();
  for (const { id } of all<{ id: number }>("SELECT id FROM leagues WHERE draft_status = 'done'")) for (const p of leagueNewsPlayers(id)) ids.add(p);
  const oldest = one<{ n: number }>("SELECT COUNT(*) n FROM player_news_fetch")?.n ?? 0;
  await refreshNews([...ids], oldest ? 12 : 40);
}
