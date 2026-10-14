import { LiveMatchup } from "./LiveMatchup";

export default async function MatchupPage({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  return <LiveMatchup leagueId={Number(id)} matchupId={Number(mid)} />;
}
