import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import * as C from "@/lib/casino";
import { Casino } from "./Casino";
import { FallingCoins } from "./FallingCoins";

export const metadata = { title: "Casino" };

export default async function CasinoPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const u = await requireUser();
  const g = (await searchParams).g;
  const game = (["crash", "chicken", "blackjack", "mines"].includes(g ?? "") ? g : "crash") as C.Game;
  return (
    <>
      <FallingCoins />
      <PageHeader icon="casino" eyebrow="Pack Points only · no real money" title="Casino"
        description="Quick-fire games for your Pack Points: Crash, Chicken, Blackjack and Mines. Same maths as Stake's originals: Crash and Mines pay back 99%, Chicken 98%, Blackjack about 99.5% played right." />
      <Casino game={game} tester={!!u.is_tester}
        initial={{
          crash: C.crashState(u.id),
          chicken: C.chickenState(u.id), mines: C.minesState(u.id), blackjack: C.bjState(u.id),
        }} />
    </>
  );
}
