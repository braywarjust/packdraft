/**
 * A moving light sweep clipped to a pack/case PNG's own shape (masked by the image's alpha),
 * so only the foil shines, never the empty space around it. Place inside a relative box the size of the image.
 */
export function PackSheen({ src, seed = 0 }: { src: string; seed?: number }) {
  const mask = `url("${src}") center / contain no-repeat`;
  return (
    <span aria-hidden className="pack-sheen pointer-events-none absolute inset-0"
      style={{ mask, WebkitMask: mask, animationDelay: `${-((seed * 0.73) % 14).toFixed(2)}s` }} />
  );
}
