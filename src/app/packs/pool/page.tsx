import { redirect } from "next/navigation";

/** The global slab pool is gone: each league has its own pack pool (League Packs). */
export default function OldSlabPool() {
  redirect("/packs");
}
