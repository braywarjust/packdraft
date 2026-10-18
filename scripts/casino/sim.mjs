// Monte Carlo check of the casino's return to player (mirrors the math in src/lib/casino.ts).
// Usage: node scripts/casino/sim.mjs [rounds=1000000]
const N = Number(process.argv[2] ?? 1_000_000);
const EDGE = 0.01;
const r = Math.random;
const pct = (x) => (x * 100).toFixed(2) + "%";

// Crash: cash out at a fixed target
const crashPoint = () => Math.min(1000, Math.max(1, Math.floor((100 * (1 - EDGE)) / (1 - r())) / 100));
for (const target of [1.5, 2, 10]) {
  let ret = 0; for (let i = 0; i < N; i++) ret += crashPoint() >= target ? target : 0;
  console.log(`Crash, cash out at ${target}x: RTP ${pct(ret / N)}`);
}

// Chicken: walk k lanes then cash out
const P = { easy: 0.96, medium: 0.88, hard: 0.8, expert: 0.7 };
const cmult = (p, k) => Math.floor(((1 - EDGE) / p ** k) * 100) / 100;
for (const [lvl, k] of [["easy", 8], ["medium", 5], ["hard", 3], ["expert", 2]]) {
  const p = P[lvl]; let ret = 0;
  for (let i = 0; i < N; i++) { let ok = true; for (let j = 0; j < k; j++) if (r() >= p) { ok = false; break; } if (ok) ret += cmult(p, k); }
  console.log(`Chicken ${lvl}, cash out after ${k} lanes: RTP ${pct(ret / N)}`);
}

// Mines: pick k tiles then cash out
const mmult = (m, k) => { let x = 1 - EDGE; for (let i = 0; i < k; i++) x *= (25 - i) / (25 - m - i); return Math.floor(x * 100) / 100; };
for (const [m, k] of [[1, 10], [3, 5], [10, 3], [24, 1]]) {
  let ret = 0;
  for (let i = 0; i < N; i++) { const cells = [...Array(25).keys()]; for (let a = 24; a > 0; a--) { const b = Math.floor(r() * (a + 1)); [cells[a], cells[b]] = [cells[b], cells[a]]; } const mines = new Set(cells.slice(0, m)); let ok = true;
    const order = [...Array(25).keys()]; for (let j = 0; j < k; j++) if (mines.has(order[j])) { ok = false; break; } if (ok) ret += mmult(m, k); }
  console.log(`Mines ${m} mines, cash out after ${k} picks: RTP ${pct(ret / N)}`);
}

// Blackjack with a simple basic strategy (hard totals, doubles on 10/11)
const draw = () => 1 + Math.floor(r() * 13);
const val = (c) => { let t = 0, a = 0; for (const x of c) { t += x === 1 ? 11 : Math.min(10, x); if (x === 1) a++; } while (t > 21 && a) { t -= 10; a--; } return { t, soft: a > 0 }; };
let ret = 0, staked = 0;
for (let i = 0; i < N; i++) {
  const p = [draw(), draw()], d = [draw(), draw()]; staked += 1;
  const pbj = val(p).t === 21, dbj = val(d).t === 21;
  if (pbj || dbj) { ret += pbj && dbj ? 1 : pbj ? 2.5 : 0; continue; }
  const up = Math.min(10, d[0] === 1 ? 11 : d[0]); let dbl = false;
  const pv = val(p).t;
  if (!val(p).soft && (pv === 11 || (pv === 10 && up < 10) || (pv === 9 && up >= 3 && up <= 6))) { dbl = true; staked += 1; p.push(draw()); }
  else while (true) { const v = val(p); if (v.t >= 21) break;
    const stand = v.soft ? v.t >= 19 || (v.t === 18 && up <= 8) : v.t >= 17 || (v.t >= 13 && up <= 6) || (v.t === 12 && up >= 4 && up <= 6);
    if (stand) break; p.push(draw()); }
  const pt = val(p).t; const m = dbl ? 2 : 1;
  if (pt > 21) continue;
  while (val(d).t < 17) d.push(draw());
  const dt = val(d).t;
  ret += dt > 21 || pt > dt ? 2 * m : pt === dt ? m : 0;
}
console.log(`Blackjack, basic strategy: RTP ${pct(ret / staked)} of money wagered`);
