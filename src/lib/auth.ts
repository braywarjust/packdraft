import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, one, User } from "./db";

const COOKIE = "pd_session";

function secret(): string {
  if (process.env.PACKDRAFT_SECRET) return process.env.PACKDRAFT_SECRET;
  const file = path.join(DATA_DIR, ".secret");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, crypto.randomBytes(32).toString("hex"));
  }
  return fs.readFileSync(file, "utf8").trim();
}

const sign = (v: string) => crypto.createHmac("sha256", secret()).update(v).digest("hex").slice(0, 32);
export const hashPin = (pin: string) => crypto.createHash("sha256").update(`pd:${pin}`).digest("hex");

export async function setSession(userId: number) {
  (await cookies()).set(COOKIE, `${userId}.${sign(String(userId))}`, {
    // HTTPS-only cookie on the live server (Caddy serves it over HTTPS); plain HTTP still works for local dev.
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === "production",
  });
}
export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  if (!id || sig !== sign(id)) return null;
  return one<User>("SELECT * FROM users WHERE id = ?", Number(id)) ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
