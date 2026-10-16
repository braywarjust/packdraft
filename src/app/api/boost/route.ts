import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { boostLive } from "@/lib/boost";
import { refreshLive } from "@/lib/nba/sync";

export const dynamic = "force-dynamic";

/** Live Slab Boost board for the signed-in user (also pays out picks whose games just went final). */
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await refreshLive();
  return NextResponse.json(boostLive(u.id));
}
