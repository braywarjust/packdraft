import { currentUser } from "@/lib/auth";
import { crashState, crashWake } from "@/lib/casino";

export const dynamic = "force-dynamic";

// The shared Crash round as a live stream (server-sent events). A message goes out whenever anything changes (bets,
// cash-outs, the crash itself), timed to land the instant the round launches or crashes, plus a heartbeat every
// second so the browser keeps its clock in step with the server's.
export async function GET(req: Request) {
  const u = await currentUser();
  if (!u) return new Response("Log in first", { status: 401 });
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const stop = () => { closed = true; clearTimeout(timer); };
  req.signal.addEventListener("abort", stop);

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      let last = "", sentAt = 0;
      const tick = () => {
        if (closed) return;
        try {
          const s = crashState(u.id);
          const key = JSON.stringify({ ...s, game: { ...s.game, now: 0 } });
          if (key !== last || s.game.now - sentAt >= 1000) {
            last = key;
            sentAt = s.game.now;
            ctrl.enqueue(enc.encode(`data: ${JSON.stringify(s)}\n\n`));
          }
          // Check again soon, or exactly when the round next changes if that's sooner.
          timer = setTimeout(tick, Math.max(4, Math.min(150, crashWake() + 2)));
        } catch {
          stop();
          try { ctrl.close(); } catch { /* already closed */ }
        }
      };
      ctrl.enqueue(enc.encode("retry: 1000\n\n"));
      tick();
    },
    cancel: stop,
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
