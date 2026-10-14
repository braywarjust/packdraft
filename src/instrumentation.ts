// Background loop: keeps NBA data fresh and moves leagues/contests forward even when nobody has the app open.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLoop } = await import("./lib/nba/loop");
    startLoop();
  }
}
