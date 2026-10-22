import { AnimatedLogo } from "./AnimatedLogo";

/**
 * The one loading animation used across the app (Update 3.2): the PackDraft logo playing its hover animation on a loop.
 * `size` is the logo's width in px. Pages use <PageLoading /> (app/loading.tsx); busy buttons use a small one.
 */
export function LoadingLogo({ size = 96, label = "Loading", className = "" }: { size?: number; label?: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={`logo-play logo-fast inline-block shrink-0 ${className}`} style={{ width: size }}>
      <AnimatedLogo className="block w-full" />
    </span>
  );
}

/** Full-page loader shown the instant you tap a link, while the next page loads. */
export function PageLoading({ text }: { text?: string }) {
  return (
    <div className="page-loading grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-3">
        <LoadingLogo size={120} />
        {text && <p className="text-sm font-semibold text-zinc-400">{text}</p>}
      </div>
    </div>
  );
}

/**
 * A button's label while it's busy: the label stays (invisible) so the button keeps its size, and a small logo loader
 * plays over it. The button needs `relative`.
 */
export function Busy({ on, children, label = "Working" }: { on: boolean; children: React.ReactNode; label?: string }) {
  return (
    <>
      <span className={`inline-flex items-center gap-[inherit] ${on ? "invisible" : ""}`}>{children}</span>
      {on && <span className="absolute inset-0 grid place-items-center"><LoadingLogo size={34} label={label} /></span>}
    </>
  );
}
