import { DraftRoom } from "./DraftRoom";
import { draftPick, queuePlayer, startDraftAction, toggleAutodraft } from "../../../actions";

export default async function Draft({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lid = Number(id);
  return (
    <DraftRoom
      leagueId={lid}
      pick={draftPick.bind(null, lid)}
      queue={queuePlayer.bind(null, lid)}
      toggleAuto={toggleAutodraft.bind(null, lid)}
      start={startDraftAction.bind(null, lid)}
    />
  );
}
