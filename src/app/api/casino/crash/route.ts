import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { crashRecent, crashStatus } from "@/lib/casino";

// Crash polls this a few times a second while a round runs. It's a plain GET rather than a server action because
// Next runs server actions one at a time: frequent polling actions would queue up in front of a Cash out click.
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  return NextResponse.json({ ...crashStatus(u.id), recent: crashRecent() }, { headers: { "Cache-Control": "no-store" } });
}
