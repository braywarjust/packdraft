import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLeague, userTeam } from "@/lib/league";
import { TeamView } from "./TeamView";

export default async function MyTeam({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  const t = userTeam(l.id, u.id);
  if (!t) redirect(`/league/${l.id}`);
  return <TeamView leagueId={l.id} teamId={t.id} editable />;
}
