"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "node:crypto";
import { all, one, run, tx, ACQ_PRICE, TRADE_PRICE, League, Team, Player, User } from "@/lib/db";
import { clearSession, currentUser, hashPin, requireUser, setSession } from "@/lib/auth";
import {
  getLeague, userTeam, leagueTeams, startDraft, advanceDraft, makePick, autoLineup, moveToSlot, roster, ROSTER_MAX,
  isLocked, executeTrade, startWeek, finalizeWeek, postSystem, ROUNDS,
  startNewSeason, canStartNewSeason, acceptTrade, vetoTrade, tradesOpen,
} from "@/lib/league";
import { acquisitionBlock, logActivity, spendAcquisition, tradeBlock } from "@/lib/activity";
import { buyShopItem, type ShopItem } from "@/lib/shop";
import { etDate } from "@/lib/nba/espn";
import { placeBet } from "@/lib/bets";
import { applyPreset, deletePreset, getPreset, saveLeagueBrand, savePreset, setFavoritePreset } from "@/lib/branding";
import { ensureSchedule } from "@/lib/nba/sync";
import { PRESET_IDS, STATS, WEIGHT_MAX, WEIGHT_MIN, encodeWeights, scoringBlurb, scoringLabel, type Weights } from "@/lib/scoring";

type Result = { error?: string; ok?: boolean };
const wrap = async <T,>(fn: () => Promise<T> | T): Promise<T | { error: string }> => {
  try {
    return await fn();
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // let redirect() through
    return { error: e instanceof Error ? e.message : String(e) };
  }
};

const COLORS = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#6366f1", "#ef4444"];

// ---------- Auth ----------

export async function login(_: Result | undefined, form: FormData): Promise<Result> {
  const name = String(form.get("name") ?? "").trim().slice(0, 24);
  const pin = String(form.get("pin") ?? "").trim();
  if (name.length < 2) return { error: "Pick a name with at least 2 characters" };
  let user = one<User>("SELECT * FROM users WHERE name = ?", name);
  if (user) {
    if (user.pin_hash && user.pin_hash !== hashPin(pin)) return { error: "Wrong PIN for that name" };
  } else {
    const color = COLORS[all("SELECT id FROM users").length % COLORS.length];
    const r = run("INSERT INTO users (name, pin_hash, color, created_at) VALUES (?, ?, ?, ?)", name, pin ? hashPin(pin) : null, color, Date.now());
    user = one<User>("SELECT * FROM users WHERE id = ?", Number(r.lastInsertRowid))!;
    await setSession(user.id);
    redirect("/teams?welcome=1"); // first thing: set up your team branding
  }
  await setSession(user.id);
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

export async function claimBonus() {
  const u = await requireUser();
  const today = new Date().toISOString().slice(0, 10);
  if (u.last_bonus === today) return { error: "Already claimed today" };
  run("UPDATE users SET coins = coins + 150, last_bonus = ? WHERE id = ?", today, u.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Leagues ----------

function code() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function createLeague(_: Result | undefined, form: FormData): Promise<Result> {
  const u = await requireUser();
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  const maxTeams = Number(form.get("max_teams") ?? 8);
  if (!name) return { error: "League needs a name" };
  if (![4, 6, 8, 10, 12].includes(maxTeams)) return { error: "Pick 4, 6, 8, 10 or 12 teams" };
  if (maxTeams > 8 && u.coins < 2500) return { error: "Leagues over 8 teams cost 2,500 Fantasy Coins" };
  const id = tx(() => {
    if (maxTeams > 8) run("UPDATE users SET coins = coins - 2500 WHERE id = ?", u.id);
    const faab = Number(form.get("faab_budget") ?? 100);
    const r = run(
      `INSERT INTO leagues (name, commissioner_id, is_public, max_teams, scoring, mode, season_weeks, waiver_type, faab_budget, keeper_count, pick_seconds, sim_minutes, invite_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      name, u.id, form.get("is_public") ? 1 : 0, maxTeams, PRESET_IDS.includes(String(form.get("scoring"))) ? String(form.get("scoring")) : "espn", form.get("mode") === "sim" ? "sim" : "real",
      Math.min(24, Math.max(1, Number(form.get("season_weeks") ?? 20))), "free",
      faab, Number(form.get("keeper_count") ?? 0), Number(form.get("pick_seconds") ?? 60), Number(form.get("sim_minutes") ?? 5), code(), Date.now(),
    );
    const lid = Number(r.lastInsertRowid);
    const color = String(form.get("brand_color") ?? "");
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      saveLeagueBrand(lid, { name, abbr: String(form.get("brand_abbr") ?? ""), color, alt_color: String(form.get("brand_alt") ?? color),
        logo_url: String(form.get("brand_logo") ?? "") || null });
    }
    const preset = getPreset(u.id, Number(form.get("preset_id") ?? 0));
    const teamName = preset?.name ?? (String(form.get("team_name") ?? "").trim() || `${u.name}'s Team`);
    const tid = Number(run("INSERT INTO teams (league_id, user_id, name, faab) VALUES (?, ?, ?, ?)", lid, u.id, teamName.slice(0, 32), faab).lastInsertRowid);
    if (preset) applyPreset(tid, preset);
    postSystem(lid, `${u.name} created ${name}. Invite code: share it with the crew!`);
    return lid;
  });
  redirect(`/league/${id}`);
}

export async function joinLeague(_: Result | undefined, form: FormData): Promise<Result> {
  const u = await requireUser();
  const codeIn = String(form.get("code") ?? "").trim().toUpperCase();
  const leagueId = Number(form.get("league_id") ?? 0);
  const l = leagueId ? getLeague(leagueId) : one<League>("SELECT * FROM leagues WHERE invite_code = ?", codeIn);
  if (!l) return { error: "No league with that code" };
  if (leagueId && !l.is_public && l.invite_code !== codeIn) return { error: "That league is private" };
  if (userTeam(l.id, u.id)) redirect(`/league/${l.id}`);
  const teams = leagueTeams(l.id);
  const cpu = teams.find((t) => t.is_cpu);
  // After the draft, latecomers can still take over a CPU team (roster and all).
  if (l.draft_status !== "pre" && !cpu) return { error: "That league already drafted and has no CPU teams to take over" };
  const preset = getPreset(u.id, Number(form.get("preset_id") ?? 0));
  const teamName = (preset?.name ?? (String(form.get("team_name") ?? "").trim() || `${u.name}'s Team`)).slice(0, 32);
  let tid: number;
  if (cpu) {
    run("UPDATE teams SET user_id = ?, is_cpu = 0, name = ? WHERE id = ?", u.id, teamName, cpu.id);
    tid = cpu.id;
  } else {
    if (teams.length >= l.max_teams) return { error: "League is full" };
    tid = Number(run("INSERT INTO teams (league_id, user_id, name, faab) VALUES (?, ?, ?, ?)", l.id, u.id, teamName, l.faab_budget).lastInsertRowid);
  }
  if (preset) applyPreset(tid, preset);
  postSystem(l.id, `${u.name} joined as ${teamName}.`);
  redirect(`/league/${l.id}`);
}

async function commish(leagueId: number) {
  const u = await requireUser();
  const l = getLeague(leagueId);
  if (!l || l.commissioner_id !== u.id) throw new Error("League Manager only");
  return { u, l };
}

const CPU_NAMES = ["Bot Brady's Ghost", "CPU Gridiron Gang", "Silicon Sackers", "The Algorithm", "Robo Runners", "Deep Learning Deep Ball", "404 Defense Not Found", "Neural Nickelbacks", "Auto-Draft Andys", "Turing Tight Ends", "Binary Blitz"];

export async function fillCpu(leagueId: number) {
  return wrap(async () => {
    const { l } = await commish(leagueId);
    if (l.draft_status !== "pre") throw new Error("Draft already started");
    const teams = leagueTeams(l.id);
    for (let i = teams.length; i < l.max_teams; i++)
      run("INSERT INTO teams (league_id, user_id, name, is_cpu, faab) VALUES (?, NULL, ?, 1, ?)", l.id, CPU_NAMES[i % CPU_NAMES.length], l.faab_budget);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

export async function removeTeam(leagueId: number, teamId: number) {
  return wrap(async () => {
    const { l } = await commish(leagueId);
    if (l.draft_status !== "pre") throw new Error("Draft already started");
    const t = one<Team>("SELECT * FROM teams WHERE id = ? AND league_id = ?", teamId, leagueId);
    if (!t || t.user_id === l.commissioner_id) throw new Error("Can't remove that team");
    run("DELETE FROM teams WHERE id = ?", teamId);
    run("DELETE FROM keepers WHERE team_id = ?", teamId);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

export async function updateSettings(leagueId: number, form: FormData) {
  return wrap(async () => {
    const { l } = await commish(leagueId);
    const pre = l.draft_status === "pre";
    const num = (k: string, d: number) => (form.get(k) != null && form.get(k) !== "" ? Number(form.get(k)) : d);
    // Blank or "none" means no limit.
    const limit = (k: string, d: number | null | undefined) => {
      if (form.get(k) == null) return d ?? null;
      const v = String(form.get(k)).trim();
      return v === "" || v === "none" ? null : Math.max(0, Math.min(99, Math.round(Number(v) || 0)));
    };
    // League Shop prices in Fantasy Coins.
    const price = (k: string, d: number) => (form.get(k) == null ? d : Math.max(0, Math.min(1_000_000, Math.round(Number(form.get(k)) || 0))));
    const weights: Weights = {};
    for (const [k] of STATS) {
      const v = Number(form.get(`w_${k}`));
      if (Number.isFinite(v) && v) weights[k] = Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, Math.round(v * 100) / 100));
    }
    const scoring = STATS.some(([k]) => form.get(`w_${k}`) != null) ? encodeWeights(weights) : l.scoring;
    if (scoring === "c:") throw new Error("Give at least one stat some points");
    run(
      `UPDATE leagues SET name = ?, is_public = ?, scoring = ?, mode = ?, waiver_type = ?, pick_seconds = ?, sim_minutes = ?,
       keeper_count = ?, faab_budget = ?, season_weeks = ?, playoff_teams = ?,
       trade_review_hours = ?, trade_deadline_week = ?, trade_limit = ?, acq_per_week = ?, acq_price = ?, trade_price = ? WHERE id = ?`,
      String(form.get("name") || l.name).slice(0, 40), form.get("is_public") ? 1 : 0, scoring,
      pre && form.get("mode") ? (form.get("mode") === "sim" ? "sim" : "real") : l.mode,
      String(form.get("waiver_type") || l.waiver_type), Math.max(10, num("pick_seconds", l.pick_seconds)), Math.max(0.5, num("sim_minutes", l.sim_minutes)),
      pre ? num("keeper_count", l.keeper_count) : l.keeper_count, pre ? num("faab_budget", l.faab_budget) : l.faab_budget,
      pre ? Math.min(24, Math.max(1, num("season_weeks", l.season_weeks))) : l.season_weeks,
      pre ? Math.min(l.max_teams, Math.max(2, num("playoff_teams", l.playoff_teams ?? 4))) : l.playoff_teams ?? 4,
      Math.min(72, Math.max(0, num("trade_review_hours", l.trade_review_hours ?? 0))),
      form.get("trade_deadline_week") != null ? Number(form.get("trade_deadline_week")) || null : l.trade_deadline_week ?? null,
      limit("trade_limit", l.trade_limit), limit("acq_per_week", l.acq_per_week),
      price("acq_price", l.acq_price ?? ACQ_PRICE), price("trade_price", l.trade_price ?? TRADE_PRICE), l.id,
    );
    if (pre) run("UPDATE teams SET faab = ? WHERE league_id = ?", num("faab_budget", l.faab_budget), l.id);
    if (scoring !== l.scoring) postSystem(l.id, `The League Manager changed the scoring to ${scoringLabel(scoring)}: ${scoringBlurb(scoring)}.`);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

/** LM: hand the League Manager role to another manager in the league. */
export async function transferManager(leagueId: number, userId: number) {
  return wrap(async () => {
    const { u, l } = await commish(leagueId);
    const t = one<Team & { user: string }>("SELECT t.*, u.name user FROM teams t JOIN users u ON u.id = t.user_id WHERE t.league_id = ? AND t.user_id = ? AND t.is_cpu = 0", l.id, userId);
    if (!t || userId === u.id) throw new Error("Pick another manager in this league");
    run("UPDATE leagues SET commissioner_id = ? WHERE id = ?", userId, l.id);
    postSystem(l.id, `${u.name} made ${t.user} (${t.name}) the League Manager.`);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

export async function setKeeper(leagueId: number, teamId: number, playerId: number, round: number) {
  return wrap(async () => {
    const { l } = await commish(leagueId);
    if (l.draft_status !== "pre") throw new Error("Keepers lock when the draft starts");
    if (round < 1 || round > ROUNDS) throw new Error("Bad round");
    const existing = all("SELECT * FROM keepers WHERE league_id = ? AND team_id = ?", leagueId, teamId);
    if (existing.length >= l.keeper_count) throw new Error(`Max ${l.keeper_count} keepers per team`);
    if (one("SELECT 1 FROM keepers WHERE league_id = ? AND team_id = ? AND round = ?", leagueId, teamId, round)) throw new Error("That team already has a keeper in that round");
    run("INSERT INTO keepers (league_id, team_id, player_id, round) VALUES (?, ?, ?, ?)", leagueId, teamId, playerId, round);
    revalidatePath(`/league/${leagueId}/settings`);
    return { ok: true };
  });
}
export async function removeKeeper(leagueId: number, playerId: number) {
  return wrap(async () => {
    await commish(leagueId);
    run("DELETE FROM keepers WHERE league_id = ? AND player_id = ?", leagueId, playerId);
    revalidatePath(`/league/${leagueId}/settings`);
    return { ok: true };
  });
}

export async function startDraftAction(leagueId: number) {
  return wrap(async () => {
    const { l } = await commish(leagueId);
    if (l.draft_status !== "pre") throw new Error("Draft already started");
    startDraft(l);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

export async function draftPick(leagueId: number, playerId: number) {
  return wrap(async () => {
    const u = await requireUser();
    const l = getLeague(leagueId)!;
    const t = userTeam(leagueId, u.id);
    if (!t || l.draft_status !== "live") throw new Error("Can't pick right now");
    tx(() => makePick(l, t.id, playerId));
    advanceDraft(leagueId);
    return { ok: true };
  });
}

export async function toggleAutodraft(leagueId: number) {
  return wrap(async () => {
    const u = await requireUser();
    run("UPDATE teams SET autodraft = 1 - autodraft WHERE league_id = ? AND user_id = ?", leagueId, u.id);
    return { ok: true };
  });
}

export async function queuePlayer(leagueId: number, playerId: number, add: boolean) {
  return wrap(async () => {
    const u = await requireUser();
    const t = userTeam(leagueId, u.id);
    if (!t) throw new Error("No team");
    if (add) {
      const max = one<{ m: number | null }>("SELECT MAX(rank) m FROM draft_queue WHERE team_id = ?", t.id)?.m ?? 0;
      run("INSERT OR IGNORE INTO draft_queue (team_id, player_id, rank) VALUES (?, ?, ?)", t.id, playerId, max + 1);
    } else run("DELETE FROM draft_queue WHERE team_id = ? AND player_id = ?", t.id, playerId);
    return { ok: true };
  });
}

export async function renameTeam(leagueId: number, form: FormData) {
  return wrap(async () => {
    const u = await requireUser();
    const name = String(form.get("name") ?? "").trim().slice(0, 32);
    if (name) run("UPDATE teams SET name = ? WHERE league_id = ? AND user_id = ?", name, leagueId, u.id);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

// ---------- Roster ----------

async function myLeagueTeam(leagueId: number) {
  const u = await requireUser();
  const l = getLeague(leagueId);
  const t = l && userTeam(leagueId, u.id);
  if (!l || !t) throw new Error("You're not in this league");
  return { u, l, t };
}

export async function setSlot(leagueId: number, playerId: number, slot: string) {
  return wrap(async () => {
    const { l, t } = await myLeagueTeam(leagueId);
    // A manual move turns Auto Manager off; otherwise the next league tick would put the old lineup straight back.
    tx(() => { moveToSlot(l, t.id, playerId, slot); run("UPDATE teams SET auto_manage = 0 WHERE id = ?", t.id); });
    revalidatePath(`/league/${leagueId}/team`);
    return { ok: true };
  });
}

export async function autoSet(leagueId: number) {
  return wrap(async () => {
    const { l, t } = await myLeagueTeam(leagueId);
    tx(() => autoLineup(l, t.id));
    revalidatePath(`/league/${leagueId}/team`);
    return { ok: true };
  });
}

/** Auto Manager on or off for my team; turning it on sets today's best lineup straight away. */
export async function setAutoManage(leagueId: number, on: boolean) {
  return wrap(async () => {
    const { l, t } = await myLeagueTeam(leagueId);
    run("UPDATE teams SET auto_manage = ? WHERE id = ?", on ? 1 : 0, t.id);
    if (on) tx(() => autoLineup(l, t.id));
    revalidatePath(`/league/${leagueId}/team`);
    return { ok: true };
  });
}

export async function dropPlayer(leagueId: number, playerId: number) {
  return wrap(async () => {
    const { l, t } = await myLeagueTeam(leagueId);
    const p = one<Player>("SELECT * FROM players WHERE id = ?", playerId)!;
    if (isLocked(l, p)) throw new Error("Player's game has started");
    run("DELETE FROM roster WHERE team_id = ? AND player_id = ?", t.id, playerId);
    logActivity(l, t.id, "drop", { drop: playerId });
    postSystem(leagueId, `${t.name} dropped ${p.name}.`);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

/**
 * Add a free agent (Update 4.2: no waivers, every add is instant, including players another team just dropped). A full
 * roster has to drop someone in the same move; the add only uses an Acquisition once there's room.
 */
export async function addPlayer(leagueId: number, addId: number, dropId: number | null) {
  return wrap(async () => {
    const { l, t } = await myLeagueTeam(leagueId);
    if (l.draft_status !== "done") throw new Error("Draft hasn't finished");
    const p = one<Player>("SELECT * FROM players WHERE id = ?", addId)!;
    if (one("SELECT 1 FROM roster WHERE league_id = ? AND player_id = ?", leagueId, addId)) throw new Error("Already rostered");
    const mine = roster(t.id);
    if (dropId && !mine.some((x) => x.id === dropId)) throw new Error("That player isn't on your team");
    if (mine.length - (dropId ? 1 : 0) >= ROSTER_MAX) throw new Error(`Your roster is full (${ROSTER_MAX}/${ROSTER_MAX}). Drop a player to add ${p.name}`);
    const drop = dropId ? one<Player>("SELECT * FROM players WHERE id = ?", dropId)! : null;
    if (drop && isLocked(l, drop)) throw new Error(`${drop.name}'s game has started, so he can't be dropped yet`);
    const blocked = acquisitionBlock(l, t.id);
    if (blocked) throw new Error(blocked);
    if (isLocked(l, p)) throw new Error("Player's game has started");
    tx(() => {
      spendAcquisition(l, t.id);
      if (dropId) run("DELETE FROM roster WHERE team_id = ? AND player_id = ?", t.id, dropId);
      run("INSERT INTO roster (team_id, player_id, slot, league_id) VALUES (?, ?, 'BN', ?)", t.id, addId, leagueId);
      logActivity(l, t.id, "add", { add: addId, drop: dropId });
    });
    postSystem(leagueId, drop ? `${t.name} added ${p.name} and dropped ${drop.name}.` : `${t.name} added ${p.name}.`);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

// ---------- Trades ----------

export async function proposeTrade(leagueId: number, toTeamId: number, give: number[], get: number[], note: string) {
  return wrap(async () => {
    const { l, t } = await myLeagueTeam(leagueId);
    const open = tradesOpen(l);
    if (!open.ok) throw new Error(open.why);
    if (!give.length && !get.length) throw new Error("Add players to the trade");
    const to = one<Team>("SELECT * FROM teams WHERE id = ? AND league_id = ?", toTeamId, leagueId);
    if (!to || to.id === t.id) throw new Error("Pick a trade partner");
    const limited = tradeBlock(l, t.id) ?? tradeBlock(l, to.id, to.name);
    if (limited) throw new Error(limited);
    const r = run("INSERT INTO trades (league_id, from_team_id, to_team_id, give, get, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      leagueId, t.id, to.id, JSON.stringify(give), JSON.stringify(get), note.slice(0, 280), Date.now());
    const id = Number(r.lastInsertRowid);
    if (to.is_cpu) {
      // CPU GMs accept if they get at least 5% more projected value back.
      const val = (ids: number[]) => ids.reduce((s, pid) => s + (one<Player>("SELECT proj FROM players WHERE id = ?", pid)?.proj ?? 0), 0);
      if (val(give) >= val(get) * 1.05) {
        const r = acceptTrade(id);
        revalidatePath(`/league/${leagueId}`, "layout");
        return { ok: true, message: r === "review" ? `${to.name} accepted! It's in League Manager review now.` : `${to.name} accepted!` };
      }
      run("UPDATE trades SET status = 'rejected' WHERE id = ?", id);
      return { ok: true, message: `${to.name} rejected it. The algorithm says sweeten the deal.` };
    }
    postSystem(leagueId, `${t.name} sent a trade offer to ${to.name}.`);
    revalidatePath(`/league/${leagueId}/trades`);
    return { ok: true, message: "Offer sent" };
  });
}

export async function respondTrade(leagueId: number, tradeId: number, accept: boolean) {
  return wrap(async () => {
    const { l, t } = await myLeagueTeam(leagueId);
    const tr = one<{ to_team_id: number; from_team_id: number; status: string }>("SELECT * FROM trades WHERE id = ? AND league_id = ?", tradeId, leagueId);
    if (!tr || tr.status !== "pending") throw new Error("Trade not pending");
    if (accept) {
      if (tr.to_team_id !== t.id) throw new Error("Not your trade to accept");
      const open = tradesOpen(l);
      if (!open.ok) throw new Error(open.why);
      acceptTrade(tradeId);
    } else {
      if (tr.to_team_id !== t.id && tr.from_team_id !== t.id) throw new Error("Not your trade");
      run("UPDATE trades SET status = ? WHERE id = ?", tr.from_team_id === t.id ? "cancelled" : "rejected", tradeId);
    }
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

/** LM: veto a trade in review, or push it through now. */
export async function reviewTrade(leagueId: number, tradeId: number, approve: boolean) {
  return wrap(async () => {
    await commish(leagueId);
    const tr = one<{ status: string }>("SELECT status FROM trades WHERE id = ? AND league_id = ?", tradeId, leagueId);
    if (!tr || tr.status !== "review") throw new Error("That trade isn't in review");
    if (approve) executeTrade(tradeId);
    else vetoTrade(tradeId);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

// ---------- Weeks ----------

export async function startWeekAction(leagueId: number) {
  return wrap(async () => {
    const { l } = await commish(leagueId);
    startWeek(l);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

/** LM: close out the finished season and reset the league for the next draft. */
export async function newSeasonAction(leagueId: number) {
  return wrap(async () => {
    const { l } = await commish(leagueId);
    const next = canStartNewSeason(l);
    if (!next.ok) throw new Error(next.why);
    startNewSeason(l, next.year);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

export async function finishWeekNow(leagueId: number) {
  return wrap(async () => {
    const { l } = await commish(leagueId);
    if (l.mode !== "sim") throw new Error("Real-NBA weeks finish when the games do");
    if (!l.week_started_at) throw new Error("Week hasn't started");
    run("UPDATE leagues SET week_started_at = ? WHERE id = ?", Date.now() - l.sim_minutes * 60_000 - 1000, l.id);
    finalizeWeek(getLeague(l.id)!);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

// ---------- Chat ----------

export async function sendMessage(leagueId: number, body: string, imageUrl: string | null) {
  return wrap(async () => {
    const { u } = await myLeagueTeam(leagueId).catch(async () => {
      const u = await requireUser();
      const l = getLeague(leagueId);
      if (!l || l.commissioner_id !== u.id) throw new Error("Join the league to chat");
      return { u };
    });
    const text = body.trim().slice(0, 1000);
    if (!text && !imageUrl) throw new Error("Empty message");
    if (imageUrl && !/^(https:\/\/|\/api\/uploads\/)/.test(imageUrl)) throw new Error("Images must be https links or uploads");
    run("INSERT INTO messages (league_id, user_id, kind, body, image_url, created_at) VALUES (?, ?, 'text', ?, ?, ?)", leagueId, u.id, text, imageUrl, Date.now());
    return { ok: true };
  });
}

// ---------- League Shop (Update 4.0-R) ----------

/** Buy Acquisitions or Trades for your team in this league with Fantasy Coins. */
export async function buyShopItemAction(leagueId: number, item: ShopItem, qty: number) {
  return wrap(async () => {
    const { l, t, u } = await myLeagueTeam(leagueId);
    const r = buyShopItem(l, t, u.id, item, qty);
    revalidatePath("/", "layout");
    return { ok: true, ...r };
  });
}

export async function whoami() {
  return currentUser();
}

// ---------- Sportsbook ----------

export async function placeBetAction(picks: { key: string; odds: number }[], stake: number) {
  return wrap(async () => {
    const u = await requireUser();
    const r = placeBet(u.id, picks, stake);
    revalidatePath("/bets");
    return { ok: true, ...r };
  });
}

// ---------- Team branding presets ----------

export async function savePresetAction(p: { id?: number; name: string; abbr: string; color: string; alt_color: string; logo_url: string | null }) {
  return wrap(async () => {
    const u = await requireUser();
    const id = savePreset(u.id, p);
    revalidatePath("/teams");
    return { ok: true, id };
  });
}

export async function deletePresetAction(id: number) {
  return wrap(async () => {
    const u = await requireUser();
    deletePreset(u.id, id);
    revalidatePath("/teams");
    return { ok: true };
  });
}

/** Re-brand one of my league teams from a preset. */
export async function applyPresetAction(leagueId: number, presetId: number) {
  return wrap(async () => {
    const { t, u } = await myLeagueTeam(leagueId);
    const p = getPreset(u.id, presetId);
    if (!p) throw new Error("Preset not found");
    applyPreset(t.id, p);
    revalidatePath(`/league/${leagueId}`, "layout");
    return { ok: true };
  });
}

export async function favoritePresetAction(presetId: number | null) {
  return wrap(async () => {
    const u = await requireUser();
    setFavoritePreset(u.id, presetId);
    revalidatePath("/teams");
    revalidatePath("/");
    return { ok: true };
  });
}

/** LM: rename and re-brand the league (logo, colours, short name) any time. */
export async function updateLeagueBrandAction(leagueId: number, b: { name: string; abbr: string; color: string; alt_color: string; logo_url: string | null }) {
  return wrap(async () => {
    await commish(leagueId);
    saveLeagueBrand(leagueId, b);
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
