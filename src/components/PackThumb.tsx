/* eslint-disable @next/next/no-img-element */
import { PACK_BY_ID } from "@/lib/packs";
import { PackSheen } from "./PackSheen";

/** Small Blender-rendered pack (or case) image with its name. */
export function PackThumb({ id, height = 44, showName = true }: { id: string; height?: number; showName?: boolean }) {
  const p = PACK_BY_ID[id];
  if (!p) return null;
  const w = p.kind === "case" ? height * 1.08 : height * 0.79;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative shrink-0" style={{ height, width: w }}>
        <img src={`/packs/${p.id}.png?v=8`} alt={p.name} title={p.name} className="h-full w-full object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,.45)]" />
        <PackSheen src={`/packs/${p.id}.png?v=8`} seed={p.price} />
      </span>
      {showName && <span className="font-semibold">{p.name}</span>}
    </span>
  );
}
