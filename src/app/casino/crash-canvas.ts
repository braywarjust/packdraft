// The Crash stage, drawn on a canvas every animation frame: drifting stars, the axes, the multiplier curve, the rocket
// from the Crash thumbnail riding its tip with a flickering flame and exhaust, cash-out markers, and an explosion when
// it crashes. Nothing here touches React, so the animation never waits on a re-render.

export const CRASH_RATE = 0.07;

export type CrashView = {
  phase: "betting" | "running" | "crashed";
  /** Seconds since launch (frozen at the crash point once it has crashed). */
  t: number;
  /** Milliseconds until launch, while bets are open. */
  countdown: number;
  /** Milliseconds since it crashed. */
  sinceCrash: number;
  cashouts: { m: number; label: string; me: boolean }[];
};

type Particle = { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; debris: string | null };

const PAD = { l: 58, r: 30, t: 72, b: 38 };
const STEPS_M = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500];
const STEPS_T = [1, 2, 5, 10, 15, 30, 60, 120, 300];
const DEBRIS = ["#fde047", "#f97316", "#ef4444", "#ffffff", "#fb923c"];
const BET_MS = 6000;
const nice = (range: number, steps: number[], most: number) => steps.find((s) => range / s <= most) ?? steps[steps.length - 1];

export function crashRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const font = getComputedStyle(canvas).fontFamily || "system-ui, sans-serif";
  const ROCKET = {
    finL: new Path2D("M-4 1L-9 9L-3.6 7z"),
    finR: new Path2D("M4 1L9 9L3.6 7z"),
    body: new Path2D("M0-13C5-8 5.2 2 4 8L-4 8C-5.2 2-5-8 0-13z"),
    shade: new Path2D("M0-13C5-8 5.2 2 4 8L1.6 8C2.6 2 2.8-7 0-13z"),
    nose: new Path2D("M0-13C2.6-10.6 3.8-8.6 4.4-6.4L-4.4-6.4C-3.8-8.6-2.6-10.6 0-13z"),
  };
  const stars = Array.from({ length: 130 }, () => ({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() ** 3 * 1.6, a: 0.25 + Math.random() * 0.6, tw: Math.random() * Math.PI * 2 }));
  const parts: Particle[] = [];
  let w = 0, h = 0, dpr = 1, time = 0, starSpeed = 12, emit = 0, heading = -0.3;
  let prevPhase: CrashView["phase"] | null = null;
  let boom: { x: number; y: number } | null = null;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
  }

  function explode(x: number, y: number) {
    boom = { x, y };
    for (let i = 0; i < 56; i++) {
      const a = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 360;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, age: 0, life: 0.6 + Math.random() * 0.7, r: 1.5 + Math.random() * 2.8, debris: DEBRIS[i % DEBRIS.length] });
    }
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 70;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 0.8 + Math.random() * 0.6, r: 5 + Math.random() * 6, debris: null });
    }
  }

  function drawRocket(x: number, y: number, ang: number, s: number, flame: number, alpha: number) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(ang + Math.PI / 2);
    ctx.scale(s, s);
    ctx.translate(0, -8); // the tail sits on the tip of the line
    const outer = 6.4 * flame, inner = 3.4 * flame;
    ctx.fillStyle = "#f97316";
    ctx.beginPath(); ctx.moveTo(-3.4, 7.5); ctx.quadraticCurveTo(0, 7.5 + outer * 2, 3.4, 7.5); ctx.fill();
    ctx.fillStyle = "#fde047";
    ctx.beginPath(); ctx.moveTo(-1.8, 7.5); ctx.quadraticCurveTo(0, 7.5 + inner * 2, 1.8, 7.5); ctx.fill();
    ctx.fillStyle = "#ef4444"; ctx.fill(ROCKET.finL); ctx.fill(ROCKET.finR);
    ctx.fillStyle = "#ffffff"; ctx.fill(ROCKET.body);
    ctx.fillStyle = "rgba(15,23,42,.1)"; ctx.fill(ROCKET.shade);
    ctx.fillStyle = "#ef4444"; ctx.fill(ROCKET.nose);
    ctx.beginPath(); ctx.arc(0, -1.5, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = "#38bdf8"; ctx.fill();
    ctx.lineWidth = 0.9; ctx.strokeStyle = "#1e3a8a"; ctx.stroke();
    ctx.beginPath(); ctx.arc(-0.8, -2.3, 0.8, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fill();
    ctx.restore();
  }

  function frame(v: CrashView, dt: number) {
    if (!w || !h) { resize(); if (!w || !h) return; }
    time += dt;
    const { l, r, t: top, b } = PAD;
    const pw = Math.max(10, w - l - r), ph = Math.max(10, h - top - b);
    const tNow = v.phase === "betting" ? 0 : v.t;
    const mNow = Math.exp(CRASH_RATE * tNow);
    // The view widens as it climbs so the rocket stays up and to the right.
    const tMax = Math.max(8, tNow / 0.78), mMax = Math.max(2, 1 + (mNow - 1) / 0.72);
    const X = (t: number) => l + (t / tMax) * pw;
    const Y = (m: number) => top + ph - ((m - 1) / (mMax - 1)) * ph;
    const tipX = X(tNow), tipY = Y(mNow);
    const ang = Math.atan2(-((CRASH_RATE * mNow) / (mMax - 1)) * ph, pw / tMax);

    if (v.phase === "crashed" && prevPhase && prevPhase !== "crashed") explode(tipX, tipY);
    if (v.phase !== "crashed") boom = null;
    prevPhase = v.phase;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1c1240"); bg.addColorStop(0.55, "#121a2b"); bg.addColorStop(1, "#0f1620");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // A short shake when it blows up.
    if (v.phase === "crashed" && boom && v.sinceCrash < 380) {
      const a = 7 * (1 - v.sinceCrash / 380);
      ctx.translate((Math.random() - 0.5) * a * 2, (Math.random() - 0.5) * a * 2);
    }

    // Stars stream past the opposite way to the rocket, faster as it climbs, stretching into streaks at speed.
    const targetSpeed = v.phase === "running" ? 40 + 340 * Math.min(1, Math.log(mNow) / Math.log(25)) : 12;
    starSpeed += (targetSpeed - starSpeed) * Math.min(1, dt * (v.phase === "crashed" ? 1.5 : 3));
    if (v.phase !== "crashed") heading = ang;
    const ux = -Math.cos(heading), uy = -Math.sin(heading);
    const streak = Math.max(0, starSpeed - 90) * 0.05;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";
    for (const s of stars) {
      const k = 0.35 + s.r * 0.45;
      s.x = (s.x + (ux * starSpeed * k * dt) / w + 1) % 1;
      s.y = (s.y + (uy * starSpeed * k * dt) / h + 1) % 1;
      const sx = s.x * w, sy = s.y * h;
      ctx.globalAlpha = s.a * (0.75 + 0.25 * Math.sin(time * 2 + s.tw));
      if (streak > 0.5) {
        ctx.lineWidth = s.r;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ux * streak * k, sy - uy * streak * k); ctx.stroke();
      } else ctx.fillRect(sx, sy, s.r * 1.3, s.r * 1.3);
    }
    ctx.globalAlpha = 1;

    // Axes: multiplier up the side, seconds along the bottom.
    ctx.font = `600 11px ${font}`;
    ctx.lineWidth = 1;
    const sm = nice(mMax - 1, STEPS_M, 5);
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let i = 1; 1 + i * sm <= mMax + 1e-9; i++) {
      const m = 1 + i * sm, y = Math.round(Y(m)) + 0.5;
      ctx.strokeStyle = "rgba(255,255,255,.06)";
      ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(l + pw, y); ctx.stroke();
      ctx.fillStyle = "#7d879c";
      ctx.fillText(`${+m.toFixed(2)}x`, l - 10, y);
    }
    const st = nice(tMax, STEPS_T, 6);
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let i = 1; i * st <= tMax + 1e-9; i++) {
      const x = Math.round(X(i * st)) + 0.5;
      ctx.strokeStyle = "rgba(255,255,255,.12)";
      ctx.beginPath(); ctx.moveTo(x, top + ph); ctx.lineTo(x, top + ph + 5); ctx.stroke();
      ctx.fillStyle = "#7d879c";
      ctx.fillText(`${i * st}s`, x, top + ph + 11);
    }
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.beginPath(); ctx.moveTo(l + 0.5, top); ctx.lineTo(l + 0.5, top + ph + 0.5); ctx.lineTo(l + pw, top + ph + 0.5); ctx.stroke();

    // The multiplier line and the glow under it.
    if (v.phase !== "betting" && tNow > 0) {
      const crashed = v.phase === "crashed";
      const line = new Path2D();
      line.moveTo(X(0), Y(1));
      const N = 100;
      for (let i = 1; i <= N; i++) { const t = (tNow * i) / N; line.lineTo(X(t), Y(Math.exp(CRASH_RATE * t))); }
      const area = new Path2D(line);
      area.lineTo(tipX, Y(1)); area.lineTo(X(0), Y(1)); area.closePath();
      const fill = ctx.createLinearGradient(0, tipY, 0, Y(1));
      fill.addColorStop(0, crashed ? "rgba(239,68,68,.3)" : "rgba(253,224,71,.32)");
      fill.addColorStop(1, crashed ? "rgba(239,68,68,0)" : "rgba(249,115,22,0)");
      ctx.fillStyle = fill;
      ctx.fill(area);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = crashed ? "rgba(239,68,68,.22)" : "rgba(253,224,71,.2)";
      ctx.lineWidth = 10; ctx.stroke(line);
      const stroke = ctx.createLinearGradient(X(0), 0, tipX, 0);
      stroke.addColorStop(0, crashed ? "#b91c1c" : "#f97316");
      stroke.addColorStop(1, crashed ? "#ef4444" : "#fde047");
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 4; ctx.stroke(line);
    }

    // Cash-outs: a dot on the line and a tag with the name and multiplier, stacked so they don't overlap.
    if (v.phase !== "betting") {
      ctx.font = `700 11px ${font}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const placed: { x: number; y: number; w: number }[] = [];
      for (const c of v.cashouts) {
        if (c.m > mNow + 1e-9) continue;
        const x = X(Math.log(c.m) / CRASH_RATE), y = Y(c.m);
        ctx.fillStyle = c.me ? "#22e36b" : "#ffffff";
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        const tw = ctx.measureText(c.label).width + 16;
        let ty = y - 22;
        for (let k = 0; k < 8 && placed.some((p) => Math.abs(p.x - x) < (p.w + tw) / 2 && Math.abs(p.y - ty) < 22); k++) ty -= 22;
        placed.push({ x, y: ty, w: tw });
        ctx.fillStyle = c.me ? "#22e36b" : "rgba(15,22,32,.92)";
        ctx.beginPath(); ctx.roundRect(x - tw / 2, ty - 10, tw, 20, 10); ctx.fill();
        if (!c.me) { ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.fillStyle = c.me ? "#06240f" : "#ffffff";
        ctx.fillText(c.label, x, ty + 0.5);
      }
    }

    // Exhaust out of the back of the rocket.
    const s = Math.max(1.6, Math.min(2.4, ph / 170));
    if (v.phase !== "crashed") {
      emit += (v.phase === "running" ? 75 : 18) * dt;
      const bx = -Math.cos(ang), by = -Math.sin(ang);
      while (emit >= 1) {
        emit -= 1;
        const sp = (v.phase === "running" ? 110 : 45) + Math.random() * 60;
        parts.push({ x: tipX + bx * s * 4, y: tipY + by * s * 4, vx: bx * sp + (Math.random() - 0.5) * 50, vy: by * sp + (Math.random() - 0.5) * 50, age: 0, life: 0.35 + Math.random() * 0.45, r: 1.8 + Math.random() * 2.4, debris: null });
      }
    }
    if (parts.length > 320) parts.splice(0, parts.length - 320);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      const k = p.age / p.life;
      if (p.debris) { p.vy += 280 * dt; p.vx *= 1 - 0.6 * dt; } else { p.vx *= 1 - 2.2 * dt; p.vy *= 1 - 2.2 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.debris) {
        ctx.globalAlpha = 1 - k; ctx.fillStyle = p.debris;
        ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      } else {
        ctx.globalAlpha = (1 - k) * (k < 0.45 ? 0.85 : 0.35);
        ctx.fillStyle = k < 0.18 ? "#fff3b0" : k < 0.45 ? "#fb923c" : "#94a3b8";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * 2.2), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    if (v.phase !== "crashed") {
      const idle = v.phase === "betting";
      const flame = idle ? 0.55 + Math.sin(time * 31) * 0.12 : 1.25 + Math.sin(time * 47) * 0.18 + Math.random() * 0.25;
      const alpha = idle ? Math.min(1, Math.max(0, (BET_MS - v.countdown) / 350)) : 1;
      drawRocket(tipX, tipY + (idle ? Math.sin(time * 3) * 1.5 : 0), ang, s, flame, alpha);
    } else if (boom) {
      // Flash and shockwave.
      const f = v.sinceCrash / 220;
      if (f < 1) { ctx.globalAlpha = (1 - f) * 0.85; ctx.fillStyle = "#fff4d6"; ctx.beginPath(); ctx.arc(boom.x, boom.y, 26 + 34 * f, 0, Math.PI * 2); ctx.fill(); }
      const p = v.sinceCrash / 650;
      if (p < 1) {
        const e = 1 - (1 - p) ** 3;
        ctx.globalAlpha = 1 - p; ctx.strokeStyle = "#fde047"; ctx.lineWidth = 7 * (1 - p);
        ctx.beginPath(); ctx.arc(boom.x, boom.y, 12 + 130 * e, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  return { frame, resize };
}
