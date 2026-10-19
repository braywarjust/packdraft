// Immortal variants: each team's best player has his own Immortal art, a close-up of him on the court, in
// public/immortal/<player id>.webp. They were cropped from the card photos in the slab vault; drop in a new file with
// the same name to replace one, or add one to give another player a variant. Immortal slabs of anyone with a file
// show it instead of the usual cutout photo.
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "public", "immortal");
let ids: { at: number; set: Set<number> } | null = null;
function artIds() {
  if (!ids || Date.now() - ids.at > 60_000) {
    let files: string[] = [];
    try { files = fs.readdirSync(DIR); } catch { /* no folder yet */ }
    ids = { at: Date.now(), set: new Set(files.filter((f) => f.endsWith(".webp")).map((f) => Number(f.replace(".webp", ""))).filter(Boolean)) };
  }
  return ids.set;
}

/** The Immortal close-up for a player, if he has one. */
export const immortalArt = (playerId: number | null | undefined) => (playerId && artIds().has(playerId) ? `/immortal/${playerId}.webp` : null);
