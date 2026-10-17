import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { playerInfo } from "@/lib/player-info";

/** Player inspector data. ?league=ID adds league scoring and who has him on their roster. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const league = Number(new URL(req.url).searchParams.get("league")) || null;
  const info = playerInfo(Number((await params).id), league, u.id);
  if (!info) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  return NextResponse.json(info);
}
