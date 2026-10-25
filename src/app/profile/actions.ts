"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { saveProfile } from "@/lib/profile";
import type { ProfileLook } from "@/lib/profile-look";

export async function saveProfileAction(p: { name: string; tagline: string; bio: string; avatar: string | null; look: ProfileLook; favPresetId: number | null }) {
  try {
    const u = await requireUser();
    saveProfile(u.id, p);
    revalidatePath("/", "layout");
    return { ok: true, id: u.id };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
