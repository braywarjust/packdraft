import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import * as C from "@/lib/casino";
import { Casino } from "./Casino";

export const metadata = { title: "Casino" };

export default async function CasinoPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const u = await requireUser();
  const g = (await searchParams).g;
  const game = (["crash", "chicken", "blackjack", "mines"].includes(g ?? "") ? g : "crash") as C.Game;
  return (
    <>
      <PageHeader icon="casino" eyebrow="Pack Points only · no real money" title="Casino"
        description="Quick-fire games for your Pack Points: Crash, Chicken, Blackjack and Mines. Every game runs on the house's own odds, about 99% back over the long run." />
      <Casino game={game} tester={!!u.is_tester}
        initial={{
          crash: { ...C.crashStatus(u.id), recent: C.crashRecent() },
          chicken: C.chickenState(u.id), mines: C.minesState(u.id), blackjack: C.bjState(u.id),
        }} />
    </>
  );
}
