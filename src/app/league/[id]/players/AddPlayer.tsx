"use client";

import { XIcon } from "@/components/Icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AddPlayer({
  roster, faab, action,
}: {
  player: { id: number; name: string };
  roster: { id: number; name: string; pos: string }[];
  faab: number | null;
  action: (dropId: number | null, bid: number) => Promise<unknown>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [drop, setDrop] = useState<string>("");
  const [bid, setBid] = useState(0);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (!open) return <button className="btn-lime px-2 py-1 text-xs" onClick={() => setOpen(true)}>{faab !== null ? "Claim" : "Add"}</button>;
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <select value={drop} onChange={(e) => setDrop(e.target.value)} className="input w-36 py-1 text-xs">
        <option value="">{roster.length >= 14 ? "Drop who?" : "No drop"}</option>
        {roster.map((p) => <option key={p.id} value={p.id}>{p.pos} {p.name}</option>)}
      </select>
      {faab !== null && (
        <input type="number" min={0} max={faab} value={bid} onChange={(e) => setBid(Number(e.target.value))} className="input w-16 py-1 text-xs" title="FAAB bid" />
      )}
      <button
        className="btn-primary px-2 py-1 text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = (await action(drop ? Number(drop) : null, bid)) as { error?: string; claimed?: boolean };
            if (r?.error) setMsg(r.error);
            else {
              setMsg(r?.claimed ? "Claim placed" : "Added!");
              setOpen(false);
              router.refresh();
            }
          })
        }
      >
        Go
      </button>
      <button className="text-xs text-zinc-400" onClick={() => setOpen(false)} aria-label="Close"><XIcon /></button>
      {msg && <span className="w-full text-right text-xs text-red-600">{msg}</span>}
    </div>
  );
}
