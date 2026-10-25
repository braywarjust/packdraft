"use client";

import { XIcon } from "@/components/Icons";
import { ROSTER_MAX } from "@/lib/scoring";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Add a free agent, instantly (no waivers). With a full roster you have to pick someone to drop before you can add. */
export function AddPlayer({
  player, roster, action,
}: {
  player: { id: number; name: string };
  roster: { id: number; name: string; pos: string; locked: boolean }[];
  action: (dropId: number | null) => Promise<unknown>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [drop, setDrop] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const full = roster.length >= ROSTER_MAX;
  if (!open) return <button className="btn-lime px-2 py-1 text-xs" onClick={() => setOpen(true)}>Add</button>;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <select value={drop} onChange={(e) => { setDrop(e.target.value); setMsg(""); }} className={`input w-36 py-1 text-xs ${full && !drop ? "ring-1 ring-red-500" : ""}`}>
        <option value="">{full ? "Drop who?" : "No drop"}</option>
        {roster.map((p) => <option key={p.id} value={p.id} disabled={p.locked}>{p.pos} {p.name}{p.locked ? " (playing)" : ""}</option>)}
      </select>
      <button
        className="btn-primary px-2 py-1 text-xs"
        disabled={pending || (full && !drop)}
        title={full && !drop ? "Your roster is full: pick a player to drop" : `Add ${player.name}`}
        onClick={() =>
          start(async () => {
            const r = (await action(drop ? Number(drop) : null)) as { error?: string };
            if (r?.error) setMsg(r.error);
            else {
              setOpen(false);
              router.refresh();
            }
          })
        }
      >
        Go
      </button>
      <button className="hit press text-xs text-zinc-400" onClick={() => setOpen(false)} aria-label="Close"><XIcon /></button>
      {(msg || full) && <span className="w-full text-right text-xs text-red-600">{msg || (!drop ? `Roster full (${ROSTER_MAX}/${ROSTER_MAX}): drop a player to add ${player.name}.` : "")}</span>}
    </div>
  );
}
