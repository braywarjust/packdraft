"use client";

import { CameraIcon, MicIcon } from "@/components/Icons";
import { Coins } from "@/components/Coins";
import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { id: number; user_id: number | null; kind: string; body: string | null; image_url: string | null; created_at: number; name: string | null; color: string | null };

const SMACK = [
  "{t}'s lineup has more bricks than a Home Depot.",
  "{t}, your bench is the only thing in this league getting buckets.",
  "{t} drafted like the board was sorted alphabetically.",
  "Scoreboard check for {t}: still loading… still losing.",
  "{t}, even the 76ers' load management plan has more upside than your roster.",
  "{t}'s waiver strategy is just vibes and DNP-CDs.",
  "Hey {t}, set your lineup. Oh wait, you did. Yikes.",
  "{t} is the only manager who could turn a triple-double into a loss.",
  "{t}, I'd trash talk you but your box score already did it for me.",
  "If losing were a pack, {t} would pull an Immortal every week.",
];

/** Bold **text**, and "1,234 Pack Points" becomes the Pack Points icon + amount. */
function render(text: string) {
  return text.split(/(\*\*[^*]+\*\*|[\d,]+ Pack Points)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b>
      : /^[\d,]+ Pack Points$/.test(part) ? <Coins key={i} n={Number(part.replace(/\D/g, ""))} className="font-semibold text-emerald-600" />
      : <span key={i}>{part}</span>,
  );
}

export function Chat({ leagueId, rivals, send, canPost }: {
  leagueId: number; rivals: string[]; send: (body: string, image: string | null) => Promise<unknown>; canPost: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [me, setMe] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQ, setGifQ] = useState("dunk");
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifDisabled, setGifDisabled] = useState(false);
  const [gifUrl, setGifUrl] = useState("");
  const lastId = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/chat/${leagueId}?after=${lastId.current}`, { cache: "no-store" });
    if (!r.ok) return;
    const j = (await r.json()) as { me: number; messages: Msg[] };
    setMe(j.me);
    if (j.messages.length) {
      lastId.current = j.messages[j.messages.length - 1].id;
      setMsgs((m) => [...m, ...j.messages]);
      setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [leagueId]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 2000); // no polling from background tabs
    return () => clearInterval(t);
  }, [load]);

  const submit = async (body = text, img = image) => {
    if (!body.trim() && !img) return;
    const r = (await send(body, img)) as { error?: string };
    if (r?.error) return setErr(r.error);
    setErr(""); setText(""); setImage(null); setGifOpen(false);
    load();
  };

  const upload = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json();
    if (j.error) setErr(j.error);
    else setImage(j.url);
  };

  const searchGifs = async () => {
    const r = await fetch(`/api/gifs?q=${encodeURIComponent(gifQ)}`);
    const j = await r.json();
    setGifDisabled(!!j.disabled);
    setGifs(j.gifs ?? []);
  };

  return (
    <div className="card flex h-[calc(100vh-240px)] min-h-[480px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
        {msgs.map((m) =>
          m.kind === "system" ? (
            <div key={m.id} className="mx-auto max-w-xl whitespace-pre-line rounded-xl border border-line bg-panel2/70 px-4 py-2 text-center text-sm text-zinc-700">{render(m.body ?? "")}</div>
          ) : (
            <div key={m.id} className={`flex gap-2 ${m.user_id === me ? "flex-row-reverse" : ""}`}>
              <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: m.color ?? "#64748b" }}>{m.name?.[0]?.toUpperCase()}</div>
              <div className={`max-w-[75%] ${m.user_id === me ? "text-right" : ""}`}>
                <p className="text-xs text-zinc-400">{m.name} · {new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                {m.body && <p className={`inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.user_id === me ? "bg-brand text-white" : "bg-panel2"}`}>{m.body}</p>}
                {m.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image_url} alt="" className="mt-1 max-h-64 rounded-xl" />
                )}
              </div>
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>

      {canPost ? (
        <div className="space-y-2 border-t border-line p-3">
          {gifOpen && (
            <div className="space-y-2 rounded-xl bg-ink/70 p-3">
              <div className="flex gap-2">
                <input value={gifQ} onChange={(e) => setGifQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchGifs()} className="input" placeholder="Search GIFs" />
                <button className="btn-ghost" onClick={searchGifs}>Search</button>
              </div>
              {gifDisabled && <p className="text-xs text-zinc-500">GIF search needs a free GIPHY key in <code>.env.local</code> (see README). You can still paste any GIF link below.</p>}
              <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-6">
                {gifs.map((g) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={g.id} src={g.preview} alt="" onClick={() => submit("", g.url)} className="h-20 w-full cursor-pointer rounded-lg object-cover hover:ring-2 hover:ring-brand" />
                ))}
              </div>
              <div className="flex gap-2">
                <input value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} className="input" placeholder="…or paste a GIF/image link (https://…)" />
                <button className="btn-ghost" onClick={() => { setImage(gifUrl); setGifUrl(""); }}>Attach</button>
              </div>
            </div>
          )}
          {image && (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-16 rounded-lg" />
              <button className="text-xs text-red-600" onClick={() => setImage(null)}>Remove</button>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            <button
              className="ml-auto rounded-lg bg-red-500/10 px-2 py-1 text-xs font-bold text-red-600 hover:bg-rose-500/30"
              onClick={() => {
                const t = rivals[Math.floor(Math.random() * rivals.length)] ?? "you";
                setText(SMACK[Math.floor(Math.random() * SMACK.length)].replace("{t}", t));
              }}
            >
              <MicIcon /> Smack talk generator
            </button>
          </div>
          <div className="flex gap-2">
            <label className="btn-ghost cursor-pointer px-3" title="Upload image">
              <CameraIcon /><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            <button className="btn-ghost px-3 font-bold" onClick={() => { setGifOpen(!gifOpen); if (!gifs.length) searchGifs(); }}>GIF</button>
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()} className="input" placeholder="Talk your talk…" />
            <button className="btn-primary" onClick={() => submit()}>Send</button>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
        </div>
      ) : (
        <p className="border-t border-line p-3 text-center text-sm text-zinc-500">Join the league to chat.</p>
      )}
    </div>
  );
}
