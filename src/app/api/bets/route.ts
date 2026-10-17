import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { boardGames, gameBoard, myBets, settleBets } from "@/lib/bets";
import { refreshLive } from "@/lib/nba/sync";

export const dynamic = "force-dynamic";

/** The live board (today + tomorrow), the user's bets and balance. Also settles finished games. */
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await refreshLive();
  settleBets();
  return NextResponse.json({
    games: boardGames().map((g) => gameBoard(g)),
    bets: myBets(u.id),
    coins: one<{ coins: number }>("SELECT coins FROM users WHERE id = ?", u.id)?.coins ?? 0,
  });
}
