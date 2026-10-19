import { PACK_BY_ID } from "@/lib/packs";
import { PackArt } from "./PackArt";

/** Small pack (or Mega Pack) art with its name. Still by default; the big pack art in the shop animates. */
export function PackThumb({ id, height = 44, showName = true, animate = false }: { id: string; height?: number; showName?: boolean; animate?: boolean }) {
  const p = PACK_BY_ID[id];
  if (!p) return null;
  const w = p.kind === "case" ? height : Math.round(height * 0.79);
  return (
    <span className="inline-flex items-center gap-2" title={p.name}>
      <PackArt p={p} width={w} height={height} animate={animate} />
      {showName && <span className="font-semibold">{p.name}</span>}
    </span>
  );
}
