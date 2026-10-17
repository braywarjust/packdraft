// Player profiles: photo, username, tagline/bio, a look (colours from the favourite team preset, an NBA team or
// custom picks; banner style; showcase layout), up to 6 featured slabs, and which sections show in what order.
import { all, one, run } from "./db";
import { ensureBranding, favoritePresetId, getPreset, teamBrand, userPresets } from "./branding";
import { userCards } from "./packs-server";
import { PROFILE_SECTIONS, defaultLook, type ProfileLook, type ProfileSection } from "./profile-look";

export const MAX_FEATURED = 6;

let ready = false;
export function ensureProfile() {
  if (ready) return;
  ensureBranding();
  const cols = all<{ name: string }>("PRAGMA table_info(users)").map((c) => c.name);
  if (!cols.includes("avatar_url")) run("ALTER TABLE users ADD COLUMN avatar_url TEXT");
  if (!cols.includes("tagline")) run("ALTER TABLE users ADD COLUMN tagline TEXT");
  if (!cols.includes("bio")) run("ALTER TABLE users ADD COLUMN bio TEXT");
  if (!cols.includes("profile_look")) run("ALTER TABLE users ADD COLUMN profile_look TEXT");
  run(`CREATE TABLE IF NOT EXISTS profile_featured (
    user_id INTEGER NOT NULL, card_id INTEGER NOT NULL, pos INTEGER NOT NULL, PRIMARY KEY (user_id, card_id))`);
  ready = true;
}

function parseLook(raw: string | null | undefined): ProfileLook {
  const d = defaultLook();
  if (!raw) return d;
  try {
    const j = JSON.parse(raw) as Partial<ProfileLook>;
    const order = (j.order ?? []).filter((s): s is ProfileSection => PROFILE_SECTIONS.includes(s as ProfileSection));
    for (const s of PROFILE_SECTIONS) if (!order.includes(s)) order.push(s);
    return { ...d, ...j, sections: { ...d.sections, ...(j.sections ?? {}) }, order };
  } catch {
    return d;
  }
}

export function avatarOf(userId: number): string | null {
  ensureProfile();
  return one<{ avatar_url: string | null }>("SELECT avatar_url FROM users WHERE id = ?", userId)?.avatar_url ?? null;
}

/** Everything the profile page and editor need for one user. */
export function getProfile(userId: number) {
  ensureProfile();
  const u = one<{ id: number; name: string; color: string; avatar_url: string | null; tagline: string | null; bio: string | null; profile_look: string | null; created_at: number }>(
    "SELECT id, name, color, avatar_url, tagline, bio, profile_look, created_at FROM users WHERE id = ?", userId);
  if (!u) return null;
  const look = parseLook(u.profile_look);
  const favId = favoritePresetId(userId);
  const fav = favId ? getPreset(userId, favId) : null;
  const favBrand = fav ? teamBrand({ id: fav.id, name: fav.name, color: fav.color, alt_color: fav.alt_color, abbr: fav.abbr, logo_url: fav.logo_url }) : null;
  const nba = look.nba ? one<{ abbr: string; name: string; color: string | null; alt: string | null }>("SELECT abbr, name, color, alt FROM nba_teams WHERE abbr = ?", look.nba) ?? null : null;

  const cards = userCards(userId);
  const featuredIds = all<{ card_id: number }>("SELECT card_id FROM profile_featured WHERE user_id = ? ORDER BY pos", userId).map((r) => r.card_id);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const featured = featuredIds.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c);

  const teams = all<{ wins: number; losses: number; ties: number }>("SELECT wins, losses, ties FROM teams WHERE user_id = ?", userId);
  const leagues = all<{ id: number; name: string; team: string; wins: number; losses: number; ties: number; color: string | null; alt_color: string | null; abbr: string | null; logo_url: string | null; tid: number }>(
    `SELECT l.id, l.name, t.name team, t.wins, t.losses, t.ties, t.color, t.alt_color, t.abbr, t.logo_url, t.id tid
     FROM teams t JOIN leagues l ON l.id = t.league_id WHERE t.user_id = ? ORDER BY l.id DESC`, userId);
  let ppEarned = 0;
  try { ppEarned = one<{ n: number }>("SELECT COALESCE(SUM(pp), 0) n FROM pp_earnings WHERE user_id = ?", userId)?.n ?? 0; } catch {}
  let betsWon = 0;
  try { betsWon = one<{ n: number }>("SELECT COUNT(*) n FROM bets WHERE user_id = ? AND status = 'won'", userId)?.n ?? 0; } catch {}

  return {
    user: { id: u.id, name: u.name, color: u.color, avatar: u.avatar_url, tagline: u.tagline ?? "", bio: u.bio ?? "", since: u.created_at },
    look,
    favBrand,
    nba: nba ? { abbr: nba.abbr, name: nba.name, color: `#${nba.color ?? "1f2937"}`, alt: `#${nba.alt ?? "111827"}` } : null,
    presets: userPresets(userId).map((p) => ({ id: p.id, brand: teamBrand({ id: p.id, name: p.name, color: p.color, alt_color: p.alt_color, abbr: p.abbr, logo_url: p.logo_url }) })),
    favPresetId: favId,
    cards,
    featured,
    leagues: leagues.map((l) => ({ id: l.id, name: l.name, record: `${l.wins}-${l.losses}${l.ties ? `-${l.ties}` : ""}`, brand: teamBrand({ id: l.tid, name: l.team, color: l.color, alt_color: l.alt_color, abbr: l.abbr, logo_url: l.logo_url }) })),
    stats: {
      slabs: cards.length,
      vault: cards.reduce((s, c) => s + c.value, 0),
      best: cards[0] ?? null,
      ripped: one<{ n: number }>("SELECT COUNT(*) n FROM user_packs WHERE user_id = ? AND opened_at IS NOT NULL", userId)?.n ?? 0,
      wins: teams.reduce((s, t) => s + t.wins, 0),
      losses: teams.reduce((s, t) => s + t.losses, 0),
      ppEarned,
      betsWon,
    },
  };
}
export type Profile = NonNullable<ReturnType<typeof getProfile>>;

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _.-]{1,19}$/;
const HEX = /^#[0-9a-f]{6}$/i;

export function saveProfile(userId: number, p: { name: string; tagline: string; bio: string; avatar: string | null; look: ProfileLook; favPresetId: number | null }) {
  ensureProfile();
  const name = p.name.trim().replace(/\s+/g, " ");
  if (!NAME_RE.test(name)) throw new Error("Usernames are 2–20 letters, numbers, spaces, dots, dashes or underscores");
  const taken = one<{ id: number }>("SELECT id FROM users WHERE name = ? COLLATE NOCASE AND id != ?", name, userId);
  if (taken) throw new Error(`"${name}" is already taken`);
  if (p.avatar && !/^\/api\/uploads\/[a-f0-9]{24}\.(png|jpg|gif|webp)$/.test(p.avatar)) throw new Error("Bad photo");
  const d = defaultLook();
  const l = p.look;
  const look: ProfileLook = {
    theme: ["team", "nba", "custom"].includes(l.theme) ? l.theme : d.theme,
    color: HEX.test(l.color) ? l.color : d.color,
    alt: HEX.test(l.alt) ? l.alt : d.alt,
    nba: l.nba && /^[A-Z]{2,4}$/.test(l.nba) ? l.nba : null,
    banner: ["stripes", "court", "glow", "solid"].includes(l.banner) ? l.banner : d.banner,
    showcase: ["shelf", "grid", "spotlight"].includes(l.showcase) ? l.showcase : d.showcase,
    watermark: ["team", "nba", "none"].includes(l.watermark) ? l.watermark : d.watermark,
    ring: !!l.ring,
    sections: Object.fromEntries(PROFILE_SECTIONS.map((s) => [s, l.sections?.[s] !== false])) as ProfileLook["sections"],
    order: [...new Set(l.order.filter((s) => PROFILE_SECTIONS.includes(s)).concat(PROFILE_SECTIONS))],
  };
  if (p.favPresetId && !getPreset(userId, p.favPresetId)) throw new Error("Team not found");
  run("UPDATE users SET name = ?, tagline = ?, bio = ?, avatar_url = ?, profile_look = ?, fav_preset_id = ? WHERE id = ?",
    name, p.tagline.trim().slice(0, 80), p.bio.trim().slice(0, 400), p.avatar, JSON.stringify(look), p.favPresetId, userId);
}

/** Pin up to MAX_FEATURED of your own unsold slabs, in order. */
export function setFeatured(userId: number, cardIds: number[]) {
  ensureProfile();
  const own = new Set(all<{ id: number }>("SELECT id FROM cards WHERE user_id = ? AND sold = 0", userId).map((r) => r.id));
  const ids = [...new Set(cardIds)].filter((id) => own.has(id)).slice(0, MAX_FEATURED);
  run("DELETE FROM profile_featured WHERE user_id = ?", userId);
  ids.forEach((id, i) => run("INSERT INTO profile_featured (user_id, card_id, pos) VALUES (?, ?, ?)", userId, id, i));
}

export function nbaTeams() {
  return all<{ abbr: string; name: string; color: string | null; alt: string | null }>("SELECT abbr, name, color, alt FROM nba_teams ORDER BY name");
}
