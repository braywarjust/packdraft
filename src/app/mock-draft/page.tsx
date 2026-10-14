import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { MockDraft } from "./MockDraft";

export default async function MockDraftPage() {
  const u = await requireUser();
  const players = all<{ id: number; name: string; pos: string; team: string; adp: number; proj: number; headshot: string | null; injury: string | null }>(
    "SELECT id, name, pos, team, adp, proj, headshot, injury FROM players WHERE active = 1 ORDER BY adp");
  return <MockDraft players={players} userName={u.name} />;
}
