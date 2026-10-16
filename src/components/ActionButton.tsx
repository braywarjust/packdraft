"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ActionButton({
  action, children, className = "btn-ghost", confirm: confirmText, onDone,
}: {
  action: () => Promise<{ error?: string; message?: string } | unknown>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => {
            const r = (await action()) as { error?: string; message?: string } | undefined;
            if (r?.error) setMsg({ text: r.error, bad: true });
            else {
              setMsg(r?.message ? { text: r.message, bad: false } : null);
              onDone?.();
              router.refresh();
            }
          });
        }}
      >
        {pending ? "…" : children}
      </button>
      {msg && <span className={`text-xs ${msg.bad ? "text-red-600" : "text-emerald-600"}`}>{msg.text}</span>}
    </span>
  );
}
