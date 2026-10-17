// Team branding presets: a manager sets up team names, colours and a transparent PNG logo once (Team Studio),
// then picks a preset when creating or joining a league. The preset is copied onto the league team, so editing
// a preset later doesn't change past leagues unless they re-apply it from the team page.
import { all, one, run } from "./db";
import { hash } from "./sim";

export type Preset = {
  id: number; user_id: number; name: string; abbr: string; color: string; alt_color: string; logo_url: string | null; created_at: number;
};
export type Brand = { name: string; abbr: string; color: string; alt: string; logo: string | null };

let ready = false;
export function ensureBranding() {
  if (ready) return;
  run(`CREATE TABLE IF NOT EXISTS team_presets (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, abbr TEXT NOT NULL, color TEXT NOT NULL,
    alt_color TEXT NOT NULL, logo_url TEXT, created_at INTEGER NOT NULL)`);
  const cols = all<{ name: string }>("PRAGMA table_info(teams)").map((c) => c.name);
  if (!cols.includes("color")) run("ALTER TABLE teams ADD COLUMN color TEXT");
  if (!cols.includes("alt_color")) run("ALTER TABLE teams ADD COLUMN alt_color TEXT");
  if (!cols.includes("abbr")) run("ALTER TABLE teams ADD COLUMN abbr TEXT");
  if (!cols.includes("logo_url")) run("ALTER TABLE teams ADD COLUMN logo_url TEXT");
  if (!cols.includes("preset_id")) run("ALTER TABLE teams ADD COLUMN preset_id INTEGER");
  const lcols = all<{ name: string }>("PRAGMA table_info(leagues)").map((c) => c.name);
  for (const c of ["color", "alt_color", "abbr", "logo_url"]) if (!lcols.includes(c)) run(`ALTER TABLE leagues ADD COLUMN ${c} TEXT`);
  const ucols = all<{ name: string }>("PRAGMA table_info(users)").map((c) => c.name);
  if (!ucols.includes("fav_preset_id")) run("ALTER TABLE users ADD COLUMN fav_preset_id INTEGER");
  ready = true;
}

const HEX = /^#[0-9a-f]{6}$/i;
const PALETTE = [["#1f63b5", "#d6363c"], ["#0f766e", "#f5c15c"], ["#7c3aed", "#f472b6"], ["#b45309", "#111827"], ["#be123c", "#e5e7eb"], ["#0369a1", "#a3e635"], ["#334155", "#f97316"], ["#166534", "#fde047"]];

export const autoAbbr = (name: string) =>
  (name.split(/\s+/).filter(Boolean).length > 1 ? name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("") : name).replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "TM";

/** The branding to show for a league team (falls back to stable auto colours for unbranded/CPU teams). */
export function teamBrand(t: { id: number; name: string; color?: string | null; alt_color?: string | null; abbr?: string | null; logo_url?: string | null }): Brand {
  const [c, a] = PALETTE[hash(`team:${t.id}`) % PALETTE.length];
  return { name: t.name, abbr: t.abbr || autoAbbr(t.name), color: t.color || c, alt: t.alt_color || a, logo: t.logo_url ?? null };
}

export function userPresets(userId: number) {
  ensureBranding();
  return all<Preset>("SELECT * FROM team_presets WHERE user_id = ? ORDER BY id", userId);
}

export function savePreset(userId: number, p: { id?: number; name: string; abbr: string; color: string; alt_color: string; logo_url: string | null }) {
  ensureBranding();
  const name = p.name.trim().slice(0, 32);
  if (name.length < 2) throw new Error("Give your team a name");
  const abbr = (p.abbr.trim() || autoAbbr(name)).replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
  if (!HEX.test(p.color) || !HEX.test(p.alt_color)) throw new Error("Pick two colours");
  if (p.logo_url && !/^\/api\/uploads\/[a-f0-9]{24}\.png$/.test(p.logo_url)) throw new Error("Logo must be an uploaded PNG");
  if (p.id) {
    const r = run("UPDATE team_presets SET name = ?, abbr = ?, color = ?, alt_color = ?, logo_url = ? WHERE id = ? AND user_id = ?",
      name, abbr, p.color, p.alt_color, p.logo_url, p.id, userId);
    if (!Number(r.changes)) throw new Error("Preset not found");
    return p.id;
  }
  if (userPresets(userId).length >= 12) throw new Error("That's a lot of teams. Delete one first (max 12).");
  return Number(run("INSERT INTO team_presets (user_id, name, abbr, color, alt_color, logo_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    userId, name, abbr, p.color, p.alt_color, p.logo_url, Date.now()).lastInsertRowid);
}

export function deletePreset(userId: number, id: number) {
  ensureBranding();
  run("DELETE FROM team_presets WHERE id = ? AND user_id = ?", id, userId);
}

export function getPreset(userId: number, id: number) {
  ensureBranding();
  return one<Preset>("SELECT * FROM team_presets WHERE id = ? AND user_id = ?", id, userId) ?? null;
}

/** Copy a preset's branding (and name) onto a league team. */
export function applyPreset(teamId: number, p: Preset) {
  ensureBranding();
  run("UPDATE teams SET name = ?, abbr = ?, color = ?, alt_color = ?, logo_url = ?, preset_id = ? WHERE id = ?",
    p.name, p.abbr, p.color, p.alt_color, p.logo_url, p.id, teamId);
}

/** The Team Studio team that brands your home page (null = use your newest league team). */
export function favoritePresetId(userId: number) {
  ensureBranding();
  return one<{ fav_preset_id: number | null }>("SELECT fav_preset_id FROM users WHERE id = ?", userId)?.fav_preset_id ?? null;
}

export function setFavoritePreset(userId: number, presetId: number | null) {
  ensureBranding();
  if (presetId && !getPreset(userId, presetId)) throw new Error("Preset not found");
  run("UPDATE users SET fav_preset_id = ? WHERE id = ?", presetId, userId);
}

// ---------- League branding ----------

const LEAGUE_PALETTE = [["#0253a4", "#cc2b31"], ["#111827", "#f5c15c"], ["#7c3aed", "#22d3ee"], ["#0f766e", "#f97316"], ["#be123c", "#111827"], ["#1e3a8a", "#facc15"]];

/** A league's branding (stable auto colours until the commish sets them). */
export function leagueBrand(l: { id: number; name: string; color?: string | null; alt_color?: string | null; abbr?: string | null; logo_url?: string | null }): Brand {
  const [c, a] = LEAGUE_PALETTE[hash(`league:${l.id}`) % LEAGUE_PALETTE.length];
  return { name: l.name, abbr: l.abbr || autoAbbr(l.name), color: l.color || c, alt: l.alt_color || a, logo: l.logo_url ?? null };
}

/** Validate and store a league's name + branding. */
export function saveLeagueBrand(leagueId: number, b: { name: string; abbr: string; color: string; alt_color: string; logo_url: string | null }) {
  ensureBranding();
  const name = b.name.trim().slice(0, 40);
  if (name.length < 2) throw new Error("League needs a name");
  const abbr = (b.abbr.trim() || autoAbbr(name)).replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
  if (!HEX.test(b.color) || !HEX.test(b.alt_color)) throw new Error("Pick two colours");
  if (b.logo_url && !/^\/api\/uploads\/[a-f0-9]{24}\.png$/.test(b.logo_url)) throw new Error("Logo must be an uploaded PNG");
  run("UPDATE leagues SET name = ?, abbr = ?, color = ?, alt_color = ?, logo_url = ? WHERE id = ?", name, abbr, b.color, b.alt_color, b.logo_url, leagueId);
}
