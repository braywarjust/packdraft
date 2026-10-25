// Profile look settings, shared by the server and the (client) profile editor.

export const PROFILE_SECTIONS = ["stats", "teams", "leagues"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export const SECTION_LABEL: Record<ProfileSection, string> = {
  stats: "Stats",
  teams: "Team Studio teams",
  leagues: "Leagues",
};

export type ProfileLook = {
  /** Where the profile colours come from. */
  theme: "team" | "nba" | "custom";
  color: string;
  alt: string;
  /** Favourite NBA team (abbr), shown on the profile and usable as the colour source. */
  nba: string | null;
  banner: "stripes" | "court" | "glow" | "solid";
  /** Old slab showcase layout (slabs are gone); kept so saved looks still parse. */
  showcase: "shelf" | "grid" | "spotlight";
  /** Big faded logo behind the banner. */
  watermark: "team" | "nba" | "none";
  /** Colour ring around the profile photo. */
  ring: boolean;
  sections: Record<ProfileSection, boolean>;
  order: ProfileSection[];
};

export const defaultLook = (): ProfileLook => ({
  theme: "team", color: "#0253a4", alt: "#cc2b31", nba: null, banner: "stripes", showcase: "shelf", watermark: "team", ring: true,
  sections: { stats: true, teams: true, leagues: true },
  order: [...PROFILE_SECTIONS],
});
