import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { crashState } from "@/lib/casino";

// Crash polls this several times a second for the shared round. It's a plain GET rather than a server action because
// Next runs server actions one at a time: polling actions would queue up in front of a Cash out click.
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  return NextResponse.json(crashState(u.id), { headers: { "Cache-Control": "no-store" } });
}
