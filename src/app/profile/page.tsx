import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function MyProfile() {
  const u = await requireUser();
  redirect(`/profile/${u.id}`);
}
