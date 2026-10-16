import Link from "next/link";
import { CoinIcon } from "./Coins";

/** Always-visible Pack Points balance (top right on desktop). Links to the Pack Shop. */
export function BalancePill({ coins, tester }: { coins: number; tester: boolean }) {
  return (
    <Link href="/packs" title="Your Pack Points · open the Pack Shop"
      className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-line bg-panel/95 px-4 py-2 text-sm font-bold text-zinc-900 shadow-lg shadow-black/20 backdrop-blur transition hover:border-brand/60">
      <CoinIcon className="text-emerald-600" />
      <span className="tabular-nums">{tester ? "Unlimited" : Math.round(coins).toLocaleString("en-US")}</span>
      <span className="text-xs font-semibold text-zinc-500">Pack Points</span>
    </Link>
  );
}
