import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { RARITY_ORDER, type Rarity } from "@/lib/packs";

const PAGE = 60;

/** Every slab in a tier, most valuable first. ?rarity=epic&q=jordan&offset=0 */
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const rarity = sp.get("rarity") as Rarity;
  if (!RARITY_ORDER.includes(rarity)) return NextResponse.json({ error: "Unknown rarity" }, { status: 400 });
  const q = (sp.get("q") ?? "").trim().slice(0, 40);
  const offset = Math.max(0, Number(sp.get("offset")) || 0);
  const where = `missing = 0 AND rarity = ?${q ? " AND (player LIKE ? OR set_name LIKE ?)" : ""}`;
  const args: (string | number)[] = q ? [rarity, `%${q}%`, `%${q}%`] : [rarity];
  const total = one<{ n: number }>(`SELECT COUNT(*) n FROM slabs WHERE ${where}`, ...args)?.n ?? 0;
  const slabs = all<{ id: number; player: string; year: number; set_name: string; company: string; grade: string; value: number; pulled: number; mine: number }>(
    `SELECT s.id, s.player, s.year, s.set_name, s.company, s.grade, COALESCE(s.mkt_value, s.est_value) value, s.card_id IS NOT NULL pulled,
       COALESCE(c.user_id = ? AND c.sold = 0, 0) mine
     FROM slabs s LEFT JOIN cards c ON c.id = s.card_id WHERE ${where.replace(/\b(missing|rarity|player|set_name)\b/g, "s.$1")}
     ORDER BY value DESC, s.id LIMIT ${PAGE} OFFSET ?`, u.id, ...args, offset);
  return NextResponse.json({ total, slabs, next: offset + slabs.length < total ? offset + slabs.length : null });
}
