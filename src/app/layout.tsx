import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { unopenedPacks } from "@/lib/packs-server";
import { fmtCoins } from "@/lib/packs";
import { logout } from "./actions";
import { Logo } from "@/components/Logo";

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
          <header className="sticky top-0 z-40 bg-brand shadow-md shadow-red-900/20">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5">
              <Link href="/" className="mr-2 shrink-0" aria-label="PackDraft home">
                <Logo height={38} white />
              </Link>
              <nav className="order-last -mx-2 flex w-full items-center gap-1 overflow-x-auto scrollbar-thin md:order-none md:mx-0 md:w-auto md:flex-1">
                <Link className="navlink" href="/leagues">Leagues</Link>
                <Link className="navlink" href="/packs">
                  Vending Machine{packs > 0 && <span className="ml-1 rounded-full bg-white px-1.5 text-[10px] font-black text-brand">{packs}</span>}
                </Link>
                <Link className="navlink" href="/collection">Collection</Link>
                <Link className="navlink" href="/dfs">DFS</Link>
                <Link className="navlink" href="/mock-draft">Mock Draft</Link>
              </nav>
              <div className="ml-auto flex items-center gap-3">
                <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-brand shadow-sm" title="PackBucks">
                  {fmtCoins(user.coins)}
                </span>
                <span className="hidden items-center gap-2 text-sm font-semibold text-white md:flex">
                  <span className="h-6 w-6 rounded-full ring-2 ring-white" style={{ background: user.color }} />
                  {user.name}
                </span>
                <form action={logout}>
                  <button className="text-xs font-semibold text-white/70 hover:text-white">Log out</button>
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
