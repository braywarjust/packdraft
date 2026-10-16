// Pure parsing + scoring for graded slabs. No DB / fs imports so it can be unit-tested with plain node.

export type SlabMeta = {
  file: string; era: string; year: number; setName: string; cardNo: string | null; player: string; variant: string;
  company: string; grade: string; gradeNum: number | null; cert: string;
  auto: boolean; mem: boolean; rookie: boolean; parallel: boolean; numbered: boolean; premium: boolean; superInsert: boolean; blackLabel: boolean;
};

const GRADE_RE = /^([A-Z]{3,4})-(\d{1,2}(?:\.\d)?|auth\w*)$/i;

const words = (s: string) => s.replace(/-/g, " ").replace(/\s+/g, " ").trim();

/** Parse names like `1996_Hoops_281_Kobe-Bryant_PSA-10_12092403_front.webp`. */
export function parseSlab(relPath: string): SlabMeta | null {
  const parts = relPath.split("/");
  const base = parts[parts.length - 1].replace(/_front\.webp$/i, "").replace(/\.webp$/i, "");
  const era = parts.length >= 3 ? parts[0] : "";
  const folder = parts.length >= 2 ? parts[parts.length - 2] : "";
  const t = base.split("_");
  const gi = t.findIndex((x, i) => i >= 2 && GRADE_RE.test(x));
  if (gi < 0 || gi + 1 >= t.length) return null;
  const year = Number(t[0]);
  const setName = words(t[1]);
  const mid = t.slice(2, gi);
  let cardNo: string | null = null, player = "", variant = "";
  const numberish = (s: string) => /\d/.test(s) || (/^[A-Z.]{2,8}$/.test(s) && !/[a-z]/.test(s));
  if (mid.length >= 2 && numberish(mid[0])) {
    cardNo = mid[0];
    player = mid[1];
    variant = mid.slice(2).join(" ");
  } else {
    player = mid[0] ?? "";
    variant = mid.slice(1).join(" ");
  }
  const [, company, rawGrade] = t[gi].match(GRADE_RE)!;
  const g = rawGrade.toUpperCase();
  const isAuth = g.startsWith("AUTH");
  const gradeNum = isAuth ? null : Number(g) || null;
  const blackLabel = /BlackLabel|Pristine/i.test(folder) || (company.toUpperCase() === "BGS" && gradeNum === 10);
  const text = `${setName} ${variant}`.toLowerCase();
  const has = (...k: string[]) => k.some((w) => text.includes(w));
  return {
    file: relPath, era, year: Number.isFinite(year) ? year : 0, setName, cardNo, player: words(player), variant: words(variant),
    company: company.toUpperCase(), grade: isAuth ? "AUTH" : g, gradeNum, cert: t[gi + 1], blackLabel,
    auto: has("autograph", " auto", "signature", "signatures", " sig", "ink", "inscriptions", "penmanship", "scripts"),
    mem: has("patch", "jersey", "relic", "memorabilia", "swatch", "materials", "logoman", "threads", "fabric", "game-worn", "game worn", "shoe", "nameplate", "tag"),
    rookie: has("rookie", " rc", "rated rookie", "draft picks", "freshman", "first year", "debut", "introductions"),
    parallel: has("prizm", "refractor", "holo", "shimmer", "mojo", "wave", "disco", "pulsar", "silver", "gold", "black", "red", "blue", "green", "orange", "purple", "pink", "cracked ice", "scope", "lazer", "hyper", "fast break", "die-cut", "die cut"),
    numbered: has("gold", "black", "superfractor", "1/1", "one of one", "logoman", "/10", "/25", "/5", "/49", "/99", "premium", "platinum", "emerald"),
    premium: has("immaculate", "national treasures", "flawless", "exquisite", "noir", "opulence", "one and one", "eminence", "dominion", "spectra", "ultimate collection", "crown royale", "absolute memorabilia", "impeccable", "pinnacle", "transcendent"),
    superInsert: has("precious metal gems", "pmg", "jambalaya", "star rubies", "credentials", "masterpieces", "kaboom", "downtown", "stained glass", "color blast", "manga", "net marvels", "fireworks", "skybox e-x", "e-x2001", "essential credentials", "galaxy", "showcase legacy", "fleer authentix"),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

// Player tiers. GOATs and legends are hand-picked; active stars come from the live NBA player pool.
const GOATS = ["Michael Jordan", "LeBron James", "Kobe Bryant"];
const LEGENDS = [
  "Stephen Curry", "Kevin Durant", "Shaquille O'Neal", "Tim Duncan", "Magic Johnson", "Larry Bird", "Kareem Abdul-Jabbar",
  "Giannis Antetokounmpo", "Nikola Jokic", "Victor Wembanyama", "Luka Doncic", "Allen Iverson", "Dirk Nowitzki", "Kevin Garnett",
  "Hakeem Olajuwon", "Scottie Pippen", "Dwyane Wade", "Wilt Chamberlain", "Bill Russell", "Charles Barkley", "Vince Carter",
  "Tracy McGrady", "Ja Morant", "Zion Williamson", "Anthony Edwards", "Shai Gilgeous-Alexander", "Jayson Tatum", "Kyrie Irving",
  "Dennis Rodman", "Patrick Ewing", "David Robinson", "Karl Malone", "John Stockton", "Ray Allen", "Paul Pierce", "Steve Nash",
  "Chris Paul", "Anthony Davis", "Kawhi Leonard", "James Harden", "Russell Westbrook", "Damian Lillard", "Joel Embiid",
  "Paolo Banchero", "Cooper Flagg", "Caitlin Clark", "Grant Hill", "Penny Hardaway", "Yao Ming", "Pete Maravich",
];
const GOAT_SET = new Set(GOATS.map(norm));
const LEGEND_SET = new Set(LEGENDS.map(norm));

export type Scored = { score: number; playerTier: "goat" | "legend" | "star" | "active" | "other"; factors: string[] };

/** Rarity score: grade + player + autograph + memorabilia + card type + era. */
export function scoreSlab(m: SlabMeta, starNames: Set<string>, activeNames: Set<string>): Scored {
  const f: string[] = [];
  let s = 0;
  const add = (pts: number, why: string) => { s += pts; f.push(why); };

  // Grade
  if (m.blackLabel) add(45, "Black Label / Pristine 10");
  else if (m.gradeNum === 10) add(m.company === "PSA" ? 25 : 20, `${m.company} 10`);
  else if (m.gradeNum === 9.5) add(17, `${m.company} 9.5`);
  else if (m.gradeNum === 9) add(11, `${m.company} 9`);
  else if (m.gradeNum && m.gradeNum >= 8) add(6, `${m.company} ${m.grade}`);
  else if (m.gradeNum && m.gradeNum >= 7) add(3, `${m.company} ${m.grade}`);
  else if (m.grade === "AUTH") add(5, "Authentic");

  // Player
  const n = norm(m.player);
  let playerTier: Scored["playerTier"] = "other";
  if (GOAT_SET.has(n)) { playerTier = "goat"; add(32, "GOAT"); }
  else if (LEGEND_SET.has(n)) { playerTier = "legend"; add(18, "Legend"); }
  else if (starNames.has(n)) { playerTier = "star"; add(12, "Current star"); }
  else if (activeNames.has(n)) { playerTier = "active"; add(4, "Active player"); }

  // Card attributes
  if (m.auto) add(20, "Autograph");
  if (m.mem) add(m.variant.toLowerCase().includes("logoman") ? 28 : 13, "Memorabilia");
  if (m.auto && m.mem) add(8, "RPA combo");
  if (m.rookie) add(8, "Rookie");
  if (m.superInsert) add(18, "Iconic insert");
  if (m.premium) add(12, "Premium set");
  if (m.numbered) add(8, "Short print / numbered");
  else if (m.parallel) add(4, "Parallel");
  if (m.year && m.year < 1990) add(12, "Vintage");
  else if (m.year && m.year < 2000) add(5, "90s era");
  else if (m.year && m.year < 2010) add(3, "2000s era");

  return { score: s, playerTier, factors: f };
}

/** Estimated FMV in dollars from the rarity score (used until a real market lookup succeeds). */
export function estimateValue(score: number, cert: string) {
  let h = 2166136261;
  for (let i = 0; i < cert.length; i++) { h ^= cert.charCodeAt(i); h = Math.imul(h, 16777619); }
  const jitter = 0.8 + ((h >>> 0) % 1000) / 2500; // 0.8–1.2
  return Math.max(4, Math.round(3 * Math.pow(1.08, score) * jitter));
}
