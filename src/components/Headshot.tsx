/* eslint-disable @next/next/no-img-element */
export function Headshot({ src, name, size = 36, className = "" }: { src: string | null; name: string; size?: number; className?: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("");
  return (
    <span className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-panel2 text-[10px] font-bold text-slate-400 ${className}`} style={{ width: size, height: size }}>
      {initials}
      {src && <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top" style={{ transform: "scale(1.35) translateY(8%)" }} />}
    </span>
  );
}

export function InjuryTag({ injury }: { injury: string | null }) {
  if (!injury) return null;
  const out = /^out/i.test(injury);
  return <span className={`rounded px-1 text-[10px] font-bold ${out ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"}`}>{out ? "OUT" : injury === "Day-To-Day" ? "DTD" : injury.toUpperCase().slice(0, 4)}</span>;
}
