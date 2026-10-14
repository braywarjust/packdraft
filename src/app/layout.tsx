import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { unopenedPacks } from "@/lib/packs-server";
import { fmtCoins } from "@/lib/packs";
import { logout } from "./actions";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PackDraft",
  description: "Fantasy NBA with your friends, plus mystery packs to rip.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  const packs = user ? unopenedPacks(user.id).length : 0;
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {user && (
          <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
              <Link href="/" className="mr-3 flex items-center gap-2 text-lg font-black tracking-tight">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand2 text-ink">P</span>
                <span className="hidden sm:inline">Pack<span className="text-brand">Draft</span></span>
              </Link>
              <nav className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-thin">
                <Link className="tab" href="/leagues">Leagues</Link>
                <Link className="tab" href="/packs">
                  Vending Machine{packs > 0 && <span className="ml-1 rounded-full bg-brand2 px-1.5 text-[10px] font-bold text-ink">{packs}</span>}
                </Link>
                <Link className="tab" href="/collection">Collection</Link>
                <Link className="tab" href="/dfs">DFS</Link>
                <Link className="tab" href="/mock-draft">Mock Draft</Link>
              </nav>
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-sm font-bold text-lime-300" title="PackBucks">
                  {fmtCoins(user.coins)}
                </span>
                <span className="hidden items-center gap-2 text-sm md:flex">
                  <span className="h-6 w-6 rounded-full" style={{ background: user.color }} />
                  {user.name}
                </span>
                <form action={logout}>
                  <button className="text-xs text-slate-500 hover:text-slate-300">Log out</button>
                </form>
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
