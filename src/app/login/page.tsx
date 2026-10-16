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
  ["Mystery packs", "Win your week, earn packs, and rip graded player cards."],
  ["League chat", "Trades, waivers, results and smack talk in one place."],
];

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const users = all<{ name: string; color: string; pin_hash: string | null }>("SELECT name, color, pin_hash FROM users ORDER BY name");
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-brand p-8 text-white sm:p-12">
        <LogoWatermark color="white" opacity={0.08} height={420} className="-bottom-24 -right-40" />
        <Logo color="white" height={72} />
        <div className="relative my-12 max-w-md">
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">Fantasy NBA for you and your friends.</h1>
          <p className="mt-4 text-lg text-white/85">Draft, set your lineup, win your matchup and rip mystery packs. Powered by live NBA stats.</p>
        </div>
        <ul className="relative grid gap-4 sm:grid-cols-2">
          {FEATURES.map(([t, d]) => (
            <li key={t} className="rounded-2xl bg-white/10 p-4">
              <p className="font-bold">{t}</p>
              <p className="text-sm text-white/75">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Sign-in */}
      <section className="flex items-center justify-center bg-white p-8 sm:p-12">
        <div className="w-full max-w-sm">
          <Logo height={56} className="mb-8" />
          <h2 className="text-2xl font-black">Sign in</h2>
          <p className="mb-6 mt-1 text-sm text-zinc-500">Enter your name. A new name creates a new account. Add a PIN so nobody else can sign in as you.</p>
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
