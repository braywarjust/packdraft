import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { crashBet, crashCashout, crashState } from "@/lib/casino";

// Plain routes rather than server actions: Next runs server actions one at a time and re-renders the page after each,
// which is too slow for a Cash out click. GET is the fallback when the live stream (./stream) drops.
const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  return NextResponse.json(crashState(u.id), noStore);
}

/** { action: "bet", stake, auto } or { action: "cashout" } */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  try {
    const b = await req.json();
    const s = b.action === "cashout" ? crashCashout(u.id) : crashBet(u.id, Number(b.stake), b.auto == null ? null : Number(b.auto));
    return NextResponse.json(s, noStore);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
