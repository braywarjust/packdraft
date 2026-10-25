"use client";

import { useEffect, useState } from "react";
import { Popup } from "@/components/Popup";

/**
 * In-app confirmation (replaces the browser's confirm() popup).
 * Mount <ConfirmHost /> once (root layout), then `if (await askConfirm("Sell it?")) ...` anywhere on the client.
 */
type Req = { message: string; confirmLabel: string; danger: boolean; resolve: (ok: boolean) => void };
let push: ((r: Req) => void) | null = null;

export function askConfirm(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const req = { message, confirmLabel: opts.confirmLabel ?? "Confirm", danger: opts.danger ?? false, resolve };
    if (push) push(req);
    else resolve(true); // host not mounted (shouldn't happen): don't block the action
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => {
    push = setReq;
    return () => { push = null; };
  }, []);
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") { req.resolve(true); setReq(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);
  if (!req) return null;
  const done = (ok: boolean) => { req.resolve(ok); setReq(null); };
  return (
    <Popup onClose={() => done(false)} className="max-w-sm" z="z-[100]" label="Confirm">
      <div className="space-y-4 p-5">
        <p className="text-base font-semibold text-zinc-900">{req.message}</p>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => done(false)}>Cancel</button>
          <button autoFocus className={req.danger ? "btn-danger" : "btn-primary"} onClick={() => done(true)}>{req.confirmLabel}</button>
        </div>
      </div>
    </Popup>
  );
}
