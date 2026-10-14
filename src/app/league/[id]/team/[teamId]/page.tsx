import { requireUser } from "@/lib/auth";
import { userTeam } from "@/lib/league";
import { TeamView } from "../TeamView";

export default async function OtherTeam({ params }: { params: Promise<{ id: string; teamId: string }> }) {
  const { id, teamId } = await params;
  const u = await requireUser();
  const mine = userTeam(Number(id), u.id);
  return <TeamView leagueId={Number(id)} teamId={Number(teamId)} editable={mine?.id === Number(teamId)} />;
}
