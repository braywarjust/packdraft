"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BoltIcon } from "./Icons";

/**
 * My Team's Auto Manager switch: when on, the lineup is re-set to today's best before every tip-off.
 * A single slim line so it sits inside the roster card on phones and desktop alike.
 */
export function AutoManageToggle({ on, set }: { on: boolean; set: (on: boolean) => Promise<unknown> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const flip = () => start(async () => {
    const r = (await set(!on)) as { error?: string } | undefined;
    setErr(r?.error ?? "");
    router.refresh();
  });
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" role="switch" aria-checked={on} aria-label="Auto Manager" disabled={pending} onClick={flip}
        className={`hit relative h-5 w-9 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-panel2 ring-1 ring-line"} ${pending ? "opacity-60" : ""}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#fff] shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <BoltIcon className={`shrink-0 text-sm ${on ? "text-emerald-400" : "text-zinc-500"}`} />
      <p className="min-w-0 truncate text-xs">
        <b className="text-white">Auto Manager {on ? "on" : "off"}</b>
        {err ? <span className="text-red-500"> · {err}</span>
          : <span className="text-zinc-400 max-sm:hidden"> · {on ? "Starts your best players before every tip-off. Swapping a player turns it off." : "Turn on to start your best players with a game, every day."}</span>}
      </p>
    </div>
  );
}
