"use client";

import { createContext, useContext } from "react";
import { PACK_FACES } from "@/lib/pack-faces";

type Faces = typeof PACK_FACES;
const Ctx = createContext<Faces | null>(null);

/** Live pack cover players (current team, number and photo), sent down from the root layout. */
export function PackFacesProvider({ faces, children }: { faces: Faces; children: React.ReactNode }) {
  return <Ctx.Provider value={faces}>{children}</Ctx.Provider>;
}
/** The pack cover players, falling back to the built-in snapshot. */
export const usePackFaces = () => useContext(Ctx) ?? PACK_FACES;
