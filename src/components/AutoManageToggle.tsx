"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BoltIcon } from "./Icons";

/** My Team's Auto Manager switch: when on, the lineup is re-set to today's best before every tip-off. */
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
    <section className={`card flex items-center gap-3 p-3 sm:p-4 ${on ? "border-emerald-400/50" : ""}`}>
      <BoltIcon className={`shrink-0 text-xl ${on ? "text-emerald-400" : "text-zinc-500"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-white">Auto Manager {on ? "on" : "off"}</p>
        <p className="text-xs text-zinc-400">
          {on ? "Starts your best players with a game today and benches the rest. Out players sit, locked players stay put, and your own moves get re-set while it’s on."
            : "Turn on to start your best players with a game today, automatically, every day."}
        </p>
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Auto Manager" disabled={pending} onClick={flip}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-emerald-500" : "bg-panel2 ring-1 ring-line"} ${pending ? "opacity-60" : ""}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-[#fff] shadow transition-all ${on ? "left-6" : "left-1"}`} />
      </button>
    </section>
  );
}
