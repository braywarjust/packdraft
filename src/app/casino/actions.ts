"use server";

import { requireUser } from "@/lib/auth";
import * as C from "@/lib/casino";

async function act<T>(fn: (userId: number) => T): Promise<T | { error: string }> {
  try {
    const u = await requireUser();
    return fn(u.id);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e;
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export const crashBet = async (stake: number, auto: number | null) => act((u) => C.crashBet(u, stake, auto));
export const crashCashout = async () => act((u) => C.crashCashout(u));

export const chickenStart = async (stake: number, level: string) => act((u) => C.chickenStart(u, stake, level));
export const chickenStep = async () => act((u) => C.chickenStep(u));
export const chickenCashout = async () => act((u) => C.chickenCashout(u));

export const minesStart = async (stake: number, count: number) => act((u) => C.minesStart(u, stake, count));
export const minesPick = async (tile: number | "random") => act((u) => C.minesPick(u, tile));
export const minesCashout = async () => act((u) => C.minesCashout(u));

export const bjStart = async (stake: number) => act((u) => C.bjStart(u, stake));
export const bjAction = async (action: "hit" | "stand" | "double" | "split") => act((u) => C.bjAction(u, action));
export const bjInsurance = async (take: boolean) => act((u) => C.bjInsurance(u, take));
