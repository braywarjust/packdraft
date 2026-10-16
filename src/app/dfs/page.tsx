import { redirect } from "next/navigation";

/** Daily Fantasy was replaced by Slab Boost. */
export default function Dfs() {
  redirect("/boost");
}
