// Mock player pool. Names/teams are approximate and only used for fun; stats are simulated.
export type Pos = "QB" | "RB" | "WR" | "TE" | "DST";

const QB = "Josh Allen BUF|Lamar Jackson BAL|Jalen Hurts PHI|Jayden Daniels WAS|Joe Burrow CIN|Patrick Mahomes KC|Baker Mayfield TB|Bo Nix DEN|Kyler Murray ARI|Brock Purdy SF|Justin Herbert LAC|Caleb Williams CHI|Dak Prescott DAL|Jared Goff DET|Drake Maye NE|Jordan Love GB|C.J. Stroud HOU|Trevor Lawrence JAX|Tua Tagovailoa MIA|Matthew Stafford LAR|J.J. McCarthy MIN|Justin Fields NYJ|Cam Ward TEN|Sam Darnold SEA";

const RB = "Bijan Robinson ATL|Saquon Barkley PHI|Jahmyr Gibbs DET|Christian McCaffrey SF|De'Von Achane MIA|Ashton Jeanty LV|Derrick Henry BAL|Jonathan Taylor IND|Bucky Irving TB|Josh Jacobs GB|Kyren Williams LAR|Chase Brown CIN|James Cook BUF|Breece Hall NYJ|Omarion Hampton LAC|Alvin Kamara NO|Kenneth Walker III SEA|James Conner ARI|Chuba Hubbard CAR|TreVeyon Henderson NE|D'Andre Swift CHI|Aaron Jones MIN|Joe Mixon HOU|David Montgomery DET|Tony Pollard TEN|RJ Harvey DEN|Isiah Pacheco KC|Kaleb Johnson PIT|Quinshon Judkins CLE|Jaylen Warren PIT|Tyrone Tracy Jr. NYG|Travis Etienne Jr. JAX|Javonte Williams DAL|Rhamondre Stevenson NE|Zach Charbonnet SEA|Jordan Mason MIN|Rachaad White TB|Cam Skattebo NYG|Jaydon Blue DAL|Bhayshul Tuten JAX|Ray Davis BUF|Blake Corum LAR|Tyjae Spears TEN|Rico Dowdle CAR|Nick Chubb HOU|Austin Ekeler WAS|Jerome Ford CLE|Tank Bigsby JAX";

const WR = "Ja'Marr Chase CIN|Justin Jefferson MIN|CeeDee Lamb DAL|Puka Nacua LAR|Malik Nabers NYG|Amon-Ra St. Brown DET|Nico Collins HOU|Brian Thomas Jr. JAX|A.J. Brown PHI|Drake London ATL|Ladd McConkey LAC|Tee Higgins CIN|Jaxon Smith-Njigba SEA|Tyreek Hill MIA|Garrett Wilson NYJ|Mike Evans TB|Davante Adams LAR|Terry McLaurin WAS|Marvin Harrison Jr. ARI|Xavier Worthy KC|DK Metcalf PIT|Zay Flowers BAL|Tetairoa McMillan CAR|DJ Moore CHI|Courtland Sutton DEN|Jameson Williams DET|Rashee Rice KC|George Pickens DAL|Calvin Ridley TEN|Jaylen Waddle MIA|Jerry Jeudy CLE|Travis Hunter JAX|Chris Olave NO|Emeka Egbuka TB|Rome Odunze CHI|Jakobi Meyers LV|Khalil Shakir BUF|Jauan Jennings SF|Chris Godwin TB|Deebo Samuel WAS|Stefon Diggs NE|Cooper Kupp SEA|Ricky Pearsall SF|Keon Coleman BUF|Matthew Golden GB|Jayden Reed GB|Josh Downs IND|Michael Pittman Jr. IND|Brandon Aiyuk SF|Darnell Mooney ATL|Rashid Shaheed NO|Wan'Dale Robinson NYG|Quentin Johnston LAC|Luther Burden III CHI|Jordan Addison MIN|Christian Kirk HOU|Marvin Mims Jr. DEN|Cedric Tillman CLE|Keenan Allen LAC|Adam Thielen MIN";

const TE = "Brock Bowers LV|Trey McBride ARI|George Kittle SF|Sam LaPorta DET|T.J. Hockenson MIN|Travis Kelce KC|Mark Andrews BAL|David Njoku CLE|Tucker Kraft GB|Evan Engram DEN|Dallas Goedert PHI|Tyler Warren IND|Jonnu Smith PIT|Kyle Pitts ATL|Dalton Kincaid BUF|Jake Ferguson DAL|Hunter Henry NE|Colston Loveland CHI|Zach Ertz WAS|Cade Otton TB|Pat Freiermuth PIT|Mason Taylor NYJ";

export const TEAM_NAMES: Record<string, string> = {
  BAL: "Ravens", DEN: "Broncos", PIT: "Steelers", HOU: "Texans", PHI: "Eagles", MIN: "Vikings", BUF: "Bills", DET: "Lions",
  KC: "Chiefs", LAC: "Chargers", SF: "49ers", GB: "Packers", SEA: "Seahawks", NYJ: "Jets", CHI: "Bears", LAR: "Rams",
  MIA: "Dolphins", CLE: "Browns", TB: "Buccaneers", WAS: "Commanders", CIN: "Bengals", ARI: "Cardinals", NE: "Patriots",
  ATL: "Falcons", JAX: "Jaguars", NYG: "Giants", DAL: "Cowboys", IND: "Colts", LV: "Raiders", NO: "Saints", TEN: "Titans", CAR: "Panthers",
};

// Projected average fantasy points per game for the best and worst player at each position.
const PROJ_RANGE: Record<Pos, [number, number]> = {
  QB: [24, 14], RB: [20, 6], WR: [19, 6], TE: [14, 5], DST: [9.5, 5],
};

export type SeedPlayer = { name: string; pos: Pos; team: string; proj: number; posRank: number };

function parse(list: string, pos: Pos): SeedPlayer[] {
  const rows = list.split("|");
  const [hi, lo] = PROJ_RANGE[pos];
  return rows.map((row, i) => {
    const idx = row.lastIndexOf(" ");
    const t = rows.length === 1 ? 0 : i / (rows.length - 1);
    // Convex curve so elite players separate from the pack.
    const proj = +(lo + (hi - lo) * Math.pow(1 - t, 1.6)).toFixed(1);
    return { name: row.slice(0, idx), team: row.slice(idx + 1), pos, proj, posRank: i + 1 };
  });
}

export function seedPlayers(): (SeedPlayer & { adp: number })[] {
  const dst = Object.entries(TEAM_NAMES).map(([abbr, name]) => `${name} D/ST ${abbr}`).join("|");
  const all = [
    ...parse(QB, "QB"), ...parse(RB, "RB"), ...parse(WR, "WR"), ...parse(TE, "TE"), ...parse(dst, "DST"),
  ];
  // ADP: value over a replacement-ish baseline, with QB/DST pushed later the way real drafts go.
  const baseline: Record<Pos, number> = { QB: 15.5, RB: 8.5, WR: 8.5, TE: 6.5, DST: 6.5 };
  const scored = all.map((p) => ({ p, v: p.proj - baseline[p.pos] - (p.pos === "DST" ? 2 : 0) }));
  scored.sort((a, b) => b.v - a.v);
  return scored.map(({ p }, i) => ({ ...p, adp: i + 1 }));
}
