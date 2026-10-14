import { requireUser } from "@/lib/auth";
import { leagueTeams, userTeam } from "@/lib/league";
import { Chat } from "./Chat";
import { sendMessage } from "../../../actions";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const lid = Number(id);
  const me = userTeam(lid, u.id);
  const rivals = leagueTeams(lid).filter((t) => t.id !== me?.id).map((t) => t.name);
  return <Chat leagueId={lid} rivals={rivals} send={sendMessage.bind(null, lid)} canPost={!!me} />;
}
