import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { boardGames, gameBoard, myBets, settleBets } from "@/lib/bets";
import { addDays, etDate } from "@/lib/nba/espn";
import { ensureSchedule, refreshLive } from "@/lib/nba/sync";
import { PageHeader } from "@/components/PageHeader";
import { Sportsbook } from "./Sportsbook";

export const metadata = { title: "Sportsbook" };

export default async function BetsPage() {
  const u = await requireUser();
  const today = etDate();
  await ensureSchedule(today, addDays(today, 1));
  await refreshLive();
  settleBets();
  return (
    <>
      <PageHeader icon="bets" eyebrow="Fantasy Coins only · no real money" title="Sportsbook"
        description="Bet Fantasy Coins on tonight's NBA games, pregame or live. Stack picks into parlays." />
      <Sportsbook initial={{ games: boardGames().map((g) => gameBoard(g)), bets: myBets(u.id), coins: one<{ coins: number }>("SELECT coins FROM users WHERE id = ?", u.id)?.coins ?? 0 }} />
    </>
  );
}
