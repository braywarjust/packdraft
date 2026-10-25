/* eslint-disable @next/next/no-img-element */
export type BrandLite = { name: string; abbr: string; color: string; alt: string; logo: string | null };

/** A team's logo, or a monogram in its colours when it has no logo. */
export function TeamBadge({ brand, size = 28, className = "", ghost = false }: { brand: BrandLite; size?: number; className?: string; ghost?: boolean }) {
  // Watermark use: no-logo teams show just their letters (no box edges showing through the fade).
  if (ghost && !brand.logo) {
    return <span className={`inline-grid shrink-0 place-items-center font-black leading-none text-white ${className}`} style={{ width: size, height: size, fontSize: size * (brand.abbr.length > 2 ? 0.36 : 0.48) }}>{brand.abbr}</span>;
  }
  if (brand.logo) {
    return <img src={brand.logo} alt={brand.name} title={brand.name} className={`inline-block max-w-none shrink-0 object-contain ${className}`}
      style={{ width: size, height: size, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.45))" }} />;
  }
  return (
    <span title={brand.name} className={`inline-grid shrink-0 place-items-center rounded-lg font-black leading-none ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${brand.color}, ${brand.color} 60%, ${brand.alt})`, color: "#fff", fontSize: size * (brand.abbr.length > 2 ? 0.32 : 0.4), boxShadow: `inset 0 0 0 2px ${brand.alt}` }}>
      {brand.abbr}
    </span>
  );
}

/** Badge + team name. */
export function TeamName({ brand, size = 22, className = "", nameClass = "" }: { brand: BrandLite; size?: number; className?: string; nameClass?: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <TeamBadge brand={brand} size={size} />
      <span className={`truncate ${nameClass}`}>{brand.name}</span>
    </span>
  );
}

/** "LM" tag for the League Manager's team or name (Update 4.2: shown everywhere in the league). */
export function LMBadge({ className = "" }: { className?: string }) {
  return (
    <span title="League Manager" className={`inline-flex shrink-0 items-center rounded bg-[#0b0f17]/85 px-1 py-px align-middle text-[9px] font-black uppercase leading-tight tracking-wider text-[#fff] ring-1 ring-[#fff]/35 ${className}`}>LM</span>
  );
}
