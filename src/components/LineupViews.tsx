"use client";

import { useEffect, useState } from "react";

const KEY = "pd-team-view";

/** Box score (default) or court view of a roster, remembered per browser. */
export function LineupViews({ board, court }: { board: React.ReactNode; court: React.ReactNode }) {
  const [view, setView] = useState<"box" | "court">("box");
  useEffect(() => { try { if (localStorage.getItem(KEY) === "court") setView("court"); } catch {} }, []);
  const pick = (v: "box" | "court") => { setView(v); try { localStorage.setItem(KEY, v); } catch {} };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="flex rounded-lg bg-panel2 p-1 text-xs font-semibold">
          <button onClick={() => pick("box")} className={`rounded-md px-3 py-1.5 ${view === "box" ? "bg-brand text-white" : "text-zinc-500"}`}>Box score</button>
          <button onClick={() => pick("court")} className={`rounded-md px-3 py-1.5 ${view === "court" ? "bg-brand text-white" : "text-zinc-500"}`}>Court</button>
        </div>
      </div>
      {view === "box" ? board : court}
    </div>
  );
}
