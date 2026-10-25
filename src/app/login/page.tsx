import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { ActionForm } from "@/components/ActionForm";
import { login } from "../actions";
import { Logo, LogoWatermark } from "@/components/Logo";

export const metadata = { title: "Sign in" };

const FEATURES = [
  ["Live drafts", "Snake drafts with a pick clock, keepers, autodraft and mock drafts."],
  ["Real NBA stats", "Rosters, box scores and live scoring straight from tonight's games."],
  ["Fantasy Coins", "Every fantasy point pays coins. Spend them on extra adds and trades, or the Sportsbook."],
  ["League chat", "Trades, adds, results and smack talk in one place."],
];

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const users = all<{ name: string; color: string; pin_hash: string | null }>("SELECT name, color, pin_hash FROM users ORDER BY name");
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative flex flex-col justify-between overflow-hidden border-r border-zinc-200 bg-zinc-100 p-8 sm:p-12">
        <LogoWatermark color="red" opacity={0.05} height={420} className="-bottom-24 -right-40" />
        <Logo height={84} />
        <div className="relative my-12 max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-5xl">Fantasy NBA for you and your friends.</h1>
          <p className="mt-4 text-lg text-zinc-600">Draft, win your matchup, stack Fantasy Coins. Live NBA stats.</p>
        </div>
        <ul className="relative grid gap-3 sm:grid-cols-2">
          {FEATURES.map(([t, d]) => (
            <li key={t} className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="font-semibold text-zinc-900">{t}</p>
              <p className="text-sm text-zinc-500">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Sign-in */}
      <section className="flex items-center justify-center bg-white p-8 sm:p-12">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mb-6 mt-1 text-sm text-zinc-500">New name = new account. Add a PIN to lock it.</p>
          <ActionForm action={login} submit="Continue">
            <div>
              <label className="label">Name</label>
              <input name="name" className="input" placeholder="e.g. Brayden" list="names" required autoFocus />
              <datalist id="names">{users.map((u) => <option key={u.name} value={u.name} />)}</datalist>
            </div>
            <div>
              <label className="label">PIN (optional)</label>
              <input name="pin" className="input" placeholder="4 digits" inputMode="numeric" maxLength={8} type="password" />
            </div>
          </ActionForm>
          {users.length > 0 && (
            <div className="mt-8 border-t border-line pt-6">
              <p className="label">Members</p>
              <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                  <span key={u.name} className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-semibold">
                    <span className="h-3 w-3 rounded-full" style={{ background: u.color }} />{u.name}{u.pin_hash ? " · PIN" : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
