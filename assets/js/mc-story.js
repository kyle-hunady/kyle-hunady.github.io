/* storyboard.js - one engine, eight frames. Every frame draws with the same palette, axes, fonts and clock.
   Data: window.SB (storyboard_data.js, built by build_data.py). Constants: 57Fe from utilities/nucdata. */
"use strict";
(function () {
const SB = window.SB;
const C = {
  ink: "#1d2330", mute: "#6b7280", faint: "#d9d6cc", grid: "#ece9e1", bg: "#ffffff",
  blue: "#2b6cb0", purple: "#805ad5", red: "#e53e3e", src: "#dd6b20", det: "#2c7a7b",
  sample: "#8b5e3c", data: "#2d3748",
};
const LINE6 = ["#1f4e8c", "#3a7bd5", "#2f9e8f", "#7cb342", "#c77d1a", "#a0522d"];
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
// 57Fe Mossbauer transition (python -m nucdata probes Fe): E0 14.413 keV, t1/2 98.3 ns, 2Gamma 0.193 mm/s
const E0_EV = 14413, NEV_PER_MMS = E0_EV * 1e-3 / 2.99792458e8 * 1e9;   // 48.08 neV per mm/s
const GAMMA_NEV = 6.582119569e-16 / (98.3e-9 / Math.LN2) * 1e9;        // 4.64 neV natural FWHM
// alpha-Fe line velocities at 33.0 T (research_kit.sim.spectra / sinrg.mossbauer._C)
const VF = [5.3119, 3.0768, 0.8417], A_EXC = VF[0] - VF[1], B_GND = 2 * VF[2] + A_EXC;
const LW = 0.28;   // mm/s, lab effective linewidth (research_kit.sim.spectra.GAMMA_FWHM)

/* ---------------- minerals: Mars-temperature parameters, Morris et al. 2006 (10.1029/2005JE002584) ---------- */
const MIN = [
  { k: "fe", name: "α-Fe metal", col: "#4a5568", ph: [{ type: "sextet", d: 0, q: 0, B: 33.0, A: 1 }], src: "α-Fe calibration standard, 33.0 T" },
  { k: "hem", name: "hematite", col: "#b7472a", ph: [{ type: "sextet", d: 0.37, q: -0.16, B: 51.7, A: 1 }], src: "Morris 2006a Table 3" },
  { k: "goe", name: "goethite", col: "#b7791f", ph: [{ type: "sextet", d: 0.375, q: -0.175, B: 36.55, A: 1 }], src: "Morris 2006a, Clovis" },
  { k: "mag", name: "magnetite", col: "#1a202c", ph: [{ type: "sextet", d: 0.31, q: 0.06, B: 50.1, A: 1 }, { type: "sextet", d: 0.64, q: 0, B: 46.9, A: 2 }], src: "Morris 2006a Table 3 (tet + oct sites)" },
  { k: "ol", name: "olivine", col: "#38a169", ph: [{ type: "doublet", d: 1.15, q: 2.99, A: 1 }], src: "Morris 2006a doublet average" },
  { k: "px", name: "pyroxene", col: "#2c7a7b", ph: [{ type: "doublet", d: 1.16, q: 2.15, A: 1 }], src: "Morris 2006a doublet average" },
  { k: "jar", name: "jarosite", col: "#d69e2e", ph: [{ type: "doublet", d: 0.36, q: 1.22, A: 1 }], src: "Morris 2006b via the PDS McKittrick fit" },
];

/* ---------------- spectrum math ---------------- */
function lines(p) {
  if (p.type === "doublet") return [[p.d - p.q / 2, 0.5], [p.d + p.q / 2, 0.5]];
  const s = p.B / 33.0, e = (p.q || 0) / 2, d = p.d;
  return [[d - VF[0] * s + e, 3 / 12], [d - VF[1] * s - e, 2 / 12], [d - VF[2] * s - e, 1 / 12],
          [d + VF[2] * s - e, 1 / 12], [d + VF[1] * s - e, 2 / 12], [d + VF[0] * s + e, 3 / 12]];
}
function absorb(v, phases, w = LW) {   // unit-area-per-phase Lorentzian sum
  const g = w / 2; let tot = 0, At = 0;
  for (const p of phases) At += p.A;
  for (const p of phases) for (const [x, a] of lines(p)) tot += (p.A / At) * a * (g / Math.PI) / ((v - x) ** 2 + g * g);
  return tot;
}
function grid(a, b, n) { const o = []; for (let i = 0; i < n; i++) o.push(a + (b - a) * i / (n - 1)); return o; }
function interp(xs, ys, x, out = 1) {
  if (x <= xs[0] || x >= xs[xs.length - 1]) return out;
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] > x) hi = m; else lo = m; }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]); return ys[lo] + t * (ys[hi] - ys[lo]);
}
function kernelOf(key) {   // MC detected-photon source angles -> (c = cos theta, q)
  const K = key.startsWith("sb") ? SB.setback[key.slice(2)] : SB.kernels[key]; const c = [], q = [];
  for (let i = 0; i < K.theta.length; i++) if (K.q[i] > 0) { c.push(Math.cos(K.theta[i] * Math.PI / 180)); q.push(K.q[i]); }
  return { c, q, K };
}
function smear(f, ker) { return v => { let s = 0; for (let i = 0; i < ker.c.length; i++) s += ker.q[i] * f(v * ker.c[i]); return s; }; }
function thetaCol(th) {   // blue (0 deg) -> purple (25 deg): the same colour for an angle on every frame
  const t = Math.max(0, Math.min(1, th / 25));
  const a = [0x2b, 0x6c, 0xb0], b = [0x80, 0x5a, 0xd5];
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`;
}
let seed = 12345;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function gauss() { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function poisson(l) {
  if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss()));
  const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1;
}

/* ---------------- drawing helpers ---------------- */
function niceTicks(a, b, n) {
  const st0 = (b - a) / n, mag = 10 ** Math.floor(Math.log10(st0)), f = st0 / mag;
  const st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, t = [];
  for (let x = Math.ceil(a / st) * st; x <= b + 1e-9; x += st) t.push(+x.toFixed(10));
  return t;
}
function txt(ctx, s, x, y, o = {}) {
  ctx.font = `${o.w || 400} ${o.size || 12}px ${FONT}`; ctx.fillStyle = o.col || C.ink;
  ctx.textAlign = o.align || "left"; ctx.textBaseline = o.base || "alphabetic";
  if (o.halo) { ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.strokeText(s, x, y); }
  ctx.fillText(s, x, y);
}
function arrow(ctx, x0, y0, x1, y1, col, lw = 1.5, head = 7) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.4), y1 - head * Math.sin(a - 0.4));
  ctx.lineTo(x1 - head * Math.cos(a + 0.4), y1 - head * Math.sin(a + 0.4)); ctx.fill();
}
class Plot {
  constructor(ctx, x, y, w, h, xr, yr) { Object.assign(this, { ctx, x, y, w, h, xr, yr }); }
  X(v) { return this.x + (v - this.xr[0]) / (this.xr[1] - this.xr[0]) * this.w; }
  Y(v) { return this.y + this.h - (v - this.yr[0]) / (this.yr[1] - this.yr[0]) * this.h; }
  frame(o = {}) {
    const c = this.ctx;
    c.strokeStyle = C.faint; c.lineWidth = 1; c.strokeRect(this.x, this.y, this.w, this.h);
    if (o.zero !== false && this.xr[0] < 0 && this.xr[1] > 0) {
      c.strokeStyle = C.grid; c.beginPath(); c.moveTo(this.X(0), this.y); c.lineTo(this.X(0), this.y + this.h); c.stroke();
    }
    if (o.xlabel !== null) {
      for (const t of niceTicks(this.xr[0], this.xr[1], o.nx || 8)) {
        const X = this.X(t); c.strokeStyle = C.mute; c.beginPath(); c.moveTo(X, this.y + this.h); c.lineTo(X, this.y + this.h + 4); c.stroke();
        txt(c, String(t), X, this.y + this.h + 15, { align: "center", size: 11, col: C.mute });
      }
      txt(c, o.xlabel || "velocity (mm/s)", this.x + this.w / 2, this.y + this.h + 30, { align: "center", size: 11.5, col: C.mute });
    }
    if (o.energy) {   // second x axis: the same Doppler velocity as an energy shift of the 14.4 keV photon
      const e0 = this.xr[0] * NEV_PER_MMS, e1 = this.xr[1] * NEV_PER_MMS;
      for (const t of niceTicks(e0, e1, o.ne || 6)) {
        const X = this.X(t / NEV_PER_MMS); c.strokeStyle = C.mute; c.beginPath(); c.moveTo(X, this.y); c.lineTo(X, this.y - 4); c.stroke();
        txt(c, String(t), X, this.y - 7, { align: "center", size: 10.5, col: C.mute });
      }
      txt(c, "energy shift (neV)", this.x + this.w, this.y - 20, { align: "right", size: 11, col: C.mute });
    }
    if (o.ylabel) {
      c.save(); c.translate(this.x - (o.yticks ? 40 : 12), this.y + this.h / 2); c.rotate(-Math.PI / 2);
      txt(c, o.ylabel, 0, 0, { align: "center", size: 11.5, col: C.mute }); c.restore();
    }
    if (o.yticks) for (const t of niceTicks(this.yr[0], this.yr[1], o.ny || 4)) {
      const Y = this.Y(t); txt(c, o.yfmt ? o.yfmt(t) : String(t), this.x - 5, Y + 4, { align: "right", size: 10.5, col: C.mute });
    }
  }
  clip(fn) { const c = this.ctx; c.save(); c.beginPath(); c.rect(this.x, this.y, this.w, this.h); c.clip(); fn(c); c.restore(); }
  line(xs, ys, col, lw = 1.6, dash) {
    this.clip(c => {
      c.strokeStyle = col; c.lineWidth = lw; c.setLineDash(dash || []); c.beginPath();
      xs.forEach((x, i) => (i ? c.lineTo(this.X(x), this.Y(ys[i])) : c.moveTo(this.X(x), this.Y(ys[i]))));
      c.stroke(); c.setLineDash([]);
    });
  }
  dots(xs, ys, col, r = 1.8) {
    this.clip(c => { c.fillStyle = col; xs.forEach((x, i) => { c.beginPath(); c.arc(this.X(x), this.Y(ys[i]), r, 0, 7); c.fill(); }); });
  }
  vline(x, col, lw = 1.5, dash) {
    const c = this.ctx; c.strokeStyle = col; c.lineWidth = lw; c.setLineDash(dash || []);
    c.beginPath(); c.moveTo(this.X(x), this.y); c.lineTo(this.X(x), this.y + this.h); c.stroke(); c.setLineDash([]);
  }
}
function legend(ctx, x, y, items) {   // items: [label, colour, 'line'|'dot'|'dash']
  let X = x;
  for (const [lab, col, kind] of items) {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2;
    if (kind === "dot") { ctx.beginPath(); ctx.arc(X + 6, y - 4, 2.6, 0, 7); ctx.fill(); }
    else { ctx.setLineDash(kind === "dash" ? [5, 4] : []); ctx.beginPath(); ctx.moveTo(X, y - 4); ctx.lineTo(X + 16, y - 4); ctx.stroke(); ctx.setLineDash([]); }
    txt(ctx, lab, X + 21, y, { size: 11.5 }); ctx.font = `400 11.5px ${FONT}`;
    X += 34 + ctx.measureText(lab).width;
  }
}
function tag(ctx, s, x, y) {   // "SCHEMATIC" badge for drawings that are not data
  ctx.font = `600 9.5px ${FONT}`; const w = ctx.measureText(s).width + 10;
  ctx.fillStyle = "#f3f0e8"; ctx.fillRect(x, y - 11, w, 15);
  txt(ctx, s, x + 5, y, { size: 9.5, w: 600, col: C.mute });
}

/* ---------------- one clock for every frame ---------------- */
const drawables = [];
function canvas(id, aspect, draw, mobileAspect) {
  const cv = document.getElementById(id);
  const d = { cv, aspect, mobileAspect, draw, vis: false, w: 0, h: 0, ctx: null, t: 0, dirty: true };
  new IntersectionObserver(es => { d.vis = es[0].isIntersecting; }, { rootMargin: "100px" }).observe(cv);
  drawables.push(d); return d;
}
function size(d) {
  const w = d.cv.clientWidth; if (!w) return false;
  const asp = (w < 640 && d.mobileAspect) ? d.mobileAspect : d.aspect;
  const h = Math.round(w * asp), dpr = window.devicePixelRatio || 1;
  if (w !== d.w || h !== d.h) {
    d.cv.style.height = h + "px"; d.cv.width = Math.round(w * dpr); d.cv.height = Math.round(h * dpr);
    d.ctx = d.cv.getContext("2d"); d.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); d.w = w; d.h = h;
  }
  return true;
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  for (const d of drawables) {
    if (!(d.vis || d.dirty)) continue;
    if (!size(d)) continue;
    d.t += dt; d.ctx.clearRect(0, 0, d.w, d.h); d.draw(d, dt); d.dirty = false;
  }
  requestAnimationFrame(loop);
}
function seg(id, opts, onPick, init) {   // segmented button group
  const el = document.getElementById(id);
  opts.forEach(([val, lab]) => {
    const b = document.createElement("button"); b.textContent = lab; b.dataset.v = val;
    b.onclick = () => { [...el.children].forEach(x => x.classList.toggle("on", x === b)); onPick(val); };
    if (val === init) b.classList.add("on");
    el.appendChild(b);
  });
}

/* =============== FRAME 1: a nucleus absorbs only its own photon =============== */
(function () {
  if (!document.getElementById("f1")) return;
  let match = true;
  seg("f1-env", [["same", "sample: same Fe environment as the source"], ["diff", "sample: different Fe environment"]],
      v => { match = v === "same"; }, "same");
  canvas("f1", 0.46, (d) => {
    const { ctx, w, h } = d, t = d.t;
    // --- decay scheme (left)
    const L = Math.min(0.3 * w, 290), x0 = 18, x1 = L;
    txt(ctx, "Where the photon comes from", x0, 20, { w: 600, size: 13 });
    const yCo = 0.17 * h, y136 = 0.34 * h, y14 = 0.70 * h, y0 = 0.86 * h;
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink;
    ctx.beginPath(); ctx.moveTo(x0, yCo); ctx.lineTo(x0 + 0.38 * L, yCo); ctx.stroke();
    txt(ctx, "⁵⁷Co", x0, yCo - 6, { w: 600 }); txt(ctx, "half-life 272 d", x0 + 34, yCo - 6, { size: 10.5, col: C.mute });
    const fx0 = x0 + 0.45 * L, fx1 = x1;
    for (const [y, lab] of [[y136, "136 keV"], [y14, "14.4 keV"], [y0, "0"]]) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(fx0, y); ctx.lineTo(fx1, y); ctx.stroke();
      txt(ctx, lab, fx1, y - 5, { align: "right", size: 11, col: C.mute });
    }
    txt(ctx, "⁵⁷Fe", fx0, y0 + 16, { w: 600 });
    arrow(ctx, x0 + 0.3 * L, yCo + 2, fx0 + 6, y136 - 3, C.mute, 1.3);
    txt(ctx, "electron capture", x0 + 0.05 * L, (yCo + y136) / 2 + 10, { size: 10.5, col: C.mute });
    arrow(ctx, fx0 + 0.18 * (fx1 - fx0), y136 + 2, fx0 + 0.18 * (fx1 - fx0), y14 - 3, C.mute, 1.3);
    txt(ctx, "122 keV", fx0 + 0.18 * (fx1 - fx0) + 5, (y136 + y14) / 2, { size: 10.5, col: C.mute });
    const xm = fx0 + 0.62 * (fx1 - fx0);
    const pulse = (t % 1.6) / 1.6;
    arrow(ctx, xm, y14 + 2, xm, y0 - 3, C.red, 3);
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(xm, y14 + pulse * (y0 - y14), 4, 0, 7); ctx.fill();
    txt(ctx, "14.4 keV", xm + 7, (y14 + y0) / 2 + 2, { size: 11.5, w: 600, col: C.red });
    txt(ctx, "lives ~140 ns", xm + 7, (y14 + y0) / 2 + 16, { size: 10.5, col: C.mute });

    // --- source nucleus -> sample nucleus (right)
    const R0 = L + 0.06 * w, sx = R0 + 0.06 * w, ax = w - 0.13 * w, cy = 0.40 * h, r = Math.min(30, 0.045 * w);
    txt(ctx, "Resonant absorption: only an exact energy match is absorbed", R0, 20, { w: 600, size: 13 });
    const nucleus = (x, col, lab, glow) => {
      if (glow > 0) { ctx.fillStyle = `rgba(229,62,62,${0.25 * glow})`; ctx.beginPath(); ctx.arc(x, cy, r + 12 * glow, 0, 7); ctx.fill(); }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.fill();
      txt(ctx, lab, x, cy + r + 18, { align: "center", size: 11.5, col: C.ink });
    };
    const ladder = (x, gap, lit) => {   // two levels; the gap is the transition energy
      ctx.lineWidth = 2; ctx.strokeStyle = C.ink;
      ctx.beginPath(); ctx.moveTo(x - 16, cy - gap / 2); ctx.lineTo(x + 16, cy - gap / 2); ctx.moveTo(x - 16, cy + gap / 2); ctx.lineTo(x + 16, cy + gap / 2); ctx.stroke();
      if (lit) arrow(ctx, x, cy + gap / 2 - 1, x, cy - gap / 2 + 2, C.red, 2, 5);
    };
    const T = 2.6, ph = (t % T) / T, travel = 0.45;
    const absorbed = match && ph > travel;
    const glow = absorbed ? Math.max(0, 1 - (ph - travel) / 0.25) : 0;
    nucleus(sx, C.src, "source ⁵⁷Fe (in the ⁵⁷Co source)", 0);
    nucleus(ax, C.sample, "⁵⁷Fe in the sample", glow);
    ladder(sx - r - 30, 34, false);
    ladder(ax + r + 30, match ? 34 : 44, absorbed && ph < travel + 0.25);
    txt(ctx, match ? "same gap" : "gap shifted", ax + r + 30, cy + 34, { align: "center", size: 10.5, col: C.mute });
    // photon wave packet
    const wave = (xc, col, dir = 1) => {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = -22; k <= 22; k++) {
        const xx = xc + k, env = Math.exp(-(k * k) / 120);
        const yy = cy - 3 + 9 * env * Math.sin(k * 0.9 - t * 18 * dir);
        k === -22 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    };
    if (ph < travel) wave(sx + r + 10 + (ph / travel) * (ax - sx - 2 * r - 20), C.red);
    else if (!match) {
      const xx = ax - r - 10 + ((ph - travel) / (1 - travel)) * (w - ax + r);
      if (xx < w - 10) wave(xx, C.red);
      txt(ctx, "passes straight through", ax, cy - r - 14, { align: "center", size: 11.5, col: C.mute });
    } else if (ph > travel + 0.18) {   // re-emission back toward the instrument
      const k = (ph - travel - 0.18) / (1 - travel - 0.18), ang = Math.PI * 0.82;
      const ex = ax + Math.cos(ang) * (r + 10 + k * 0.42 * (ax - sx)), ey = cy - Math.sin(ang) * (r + 10 + k * 0.6 * h * 0.4);
      ctx.fillStyle = C.purple; ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, 7); ctx.fill();
      txt(ctx, "re-emitted back out: 14.4 keV γ, 6.4 keV X-ray or an electron", ax, cy - r - 30, { align: "right", size: 11.5, col: C.purple });
    }
    // energy ruler: the two lines on a neV scale
    const P = new Plot(ctx, R0 + 0.04 * w, 0.73 * h, w - R0 - 0.08 * w, 0.15 * h, [-60, 60], [0, 1.15]);
    P.frame({ xlabel: "photon energy − 14.413 keV (neV)", zero: false, nx: 6 });
    const xs = grid(-60, 60, 400), g = GAMMA_NEV / 2, sh = match ? 0 : 0.4 * NEV_PER_MMS;
    P.line(xs, xs.map(x => g * g / (x * x + g * g)), C.src, 2);
    P.line(xs, xs.map(x => g * g / ((x - sh) ** 2 + g * g)), C.sample, 2, [5, 3]);
    legend(ctx, P.x + 4, P.y - 6, [["emitted line", C.src, "line"], ["what the sample absorbs", C.sample, "dash"]]);
    txt(ctx, `line width ${GAMMA_NEV.toFixed(1)} neV = 1 part in ${(E0_EV * 1e9 / GAMMA_NEV / 1e12).toFixed(0)} trillion of 14.4 keV`,
        P.x + P.w, P.y - 6, { align: "right", size: 11, col: C.mute });
    if (!match) txt(ctx, `shifted ${sh.toFixed(0)} neV (0.4 mm/s): no overlap`, P.X(sh) + 8, P.Y(0.75), { size: 11, col: C.sample });
  }, 0.95);
})();

/* =============== FRAME 2: each Fe environment splits the levels its own way =============== */
(function () {
  if (!document.getElementById("f2")) return;
  let sel = 0, prev = 0, blend = 1;
  const disp = { d: 0, q: 0, B: 33, mag: 1 };   // what the level diagram is currently showing (eased)
  const target = m => { const p = m.ph[m.ph.length - 1]; return { d: p.d, q: p.q || 0, B: p.B || 0, mag: p.type === "sextet" ? 1 : 0 }; };
  Object.assign(disp, target(MIN[0]));
  seg("f2-min", MIN.map((m, i) => [i, m.name]), v => { prev = sel; sel = +v; blend = 0; }, 0);
  const VS = grid(-10, 10, 700);
  const spec = MIN.map(m => { const a = VS.map(v => absorb(v, m.ph)); const mx = Math.max(...a); return a.map(x => 1 - 0.85 * x / mx); });
  let geom = null;
  canvas("f2", 0.66, (d, dt) => {
    const { ctx, w, h } = d, m = MIN[sel];
    blend = Math.min(1, blend + dt * 2.5);
    const tg = target(m), e = 1 - Math.exp(-dt * 7);
    for (const k in tg) disp[k] += (tg[k] - disp[k]) * e;
    // --- level diagram (top left)
    const Lw = 0.38 * w, top = 34, bot = 0.56 * h;
    txt(ctx, `Nuclear levels of ⁵⁷Fe in ${m.name}`, 10, 20, { w: 600, size: 13 });
    tag(ctx, "SCHEMATIC: splittings magnified ~10¹²×", 10, bot + 14);
    const cols = [[10, 0.25 * Lw, "free nucleus"], [0.3 * Lw, 0.25 * Lw, "+ electron density (δ)"], [0.6 * Lw, 0.4 * Lw, disp.mag > 0.5 ? "+ magnetic field B" : "+ field gradient ΔE_Q"]];
    const pxv = (bot - top) * 0.03, yE = top + 0.27 * (bot - top), yG = top + 0.80 * (bot - top);
    for (const [x, cw, lab] of cols) txt(ctx, lab, x + cw / 2, top + 4, { align: "center", size: 10.5, col: C.mute });
    // sublevel energies (mm/s units, drawn upward = higher energy)
    const s = disp.B / 33, eps = disp.q / 2;
    const exc = disp.mag > 0.5
      ? [1.5, 0.5, -0.5, -1.5].map(mm => [mm, A_EXC * mm * s + (Math.abs(mm) > 1 ? eps : -eps)])
      : [[1.5, disp.q / 2], [0.5, -disp.q / 2]];
    const gnd = disp.mag > 0.5 ? [0.5, -0.5].map(mm => [mm, -B_GND * mm * s]) : [[0.5, 0]];
    const dS = disp.d * 3;   // isomer shift drawn 3x larger again so it is visible next to the splitting
    const lvl = (x0, x1, y, col = C.ink, lw = 2) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); };
    const [c0, c1, c2] = cols;
    lvl(c0[0], c0[0] + c0[1], yE); lvl(c0[0], c0[0] + c0[1], yG);
    lvl(c1[0], c1[0] + c1[1], yE - dS * pxv); lvl(c1[0], c1[0] + c1[1], yG);
    ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.strokeStyle = C.mute;
    ctx.beginPath(); ctx.moveTo(c0[0] + c0[1], yE); ctx.lineTo(c1[0], yE - dS * pxv); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, "I = 3/2", c0[0], yE - 6, { size: 10.5, col: C.mute }); txt(ctx, "I = 1/2", c0[0], yG + 15, { size: 10.5, col: C.mute });
    txt(ctx, "14.4 keV", c0[0] + c0[1] / 2, (yE + yG) / 2 + 4, { align: "center", size: 10.5, col: C.mute });
    const eY = mm => yE - dS * pxv - mm * pxv, gY = mm => yG - mm * pxv;
    for (const [mm, en] of exc) {
      lvl(c2[0], c2[0] + c2[1], eY(en), C.ink, 1.6);
      ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.strokeStyle = C.faint; ctx.beginPath(); ctx.moveTo(c1[0] + c1[1], yE - dS * pxv); ctx.lineTo(c2[0], eY(en)); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, (disp.mag > 0.5 ? (mm > 0 ? "+" : "−") : "±") + (Math.abs(mm) === 1.5 ? "3/2" : "1/2"), c2[0] + c2[1] + 3, eY(en) + 4, { size: 9.5, col: C.mute });
    }
    for (const [mm, en] of gnd) {
      lvl(c2[0], c2[0] + c2[1], gY(en), C.ink, 1.6);
      ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.strokeStyle = C.faint; ctx.beginPath(); ctx.moveTo(c1[0] + c1[1], yG); ctx.lineTo(c2[0], gY(en)); ctx.stroke(); ctx.setLineDash([]);
      txt(ctx, (disp.mag > 0.5 ? (mm > 0 ? "+" : "−") : "±") + "1/2", c2[0] + c2[1] + 3, gY(en) + 4, { size: 9.5, col: C.mute });
    }
    // allowed transitions (delta m = 0, +-1), ordered by energy, coloured like the lines in the spectrum
    const tr = disp.mag > 0.5
      ? [[-1.5, -0.5], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [1.5, 0.5]]
      : [[0.5, 0.5], [1.5, 0.5]];
    const enE = Object.fromEntries(exc.map(([mm, en]) => [mm, en])), enG = Object.fromEntries(gnd.map(([mm, en]) => [mm, en]));
    tr.forEach(([me, mg], i) => {
      const x = c2[0] + (i + 0.5) / tr.length * c2[1];
      const yg = gY(disp.mag > 0.5 ? enG[mg] : 0), ye = eY(disp.mag > 0.5 ? enE[me] : enE[me]);
      arrow(ctx, x, yg - 1, x, ye + 2, tr.length === 6 ? LINE6[i] : LINE6[i * 5], 2, 5);
    });
    // --- spectrum (top right), velocity below, energy above
    const P = new Plot(ctx, 0.47 * w, 46, 0.51 * w, 0.56 * h - 46, [-10, 10], [0.08, 1.06]);
    const y = spec[sel].map((v, i) => blend * v + (1 - blend) * spec[prev][i]);
    P.frame({ energy: true, ylabel: "transmitted photons", xlabel: "source velocity (mm/s)" });
    txt(ctx, `${m.name}: absorption spectrum`, P.x, 20, { w: 600, size: 13 });
    P.line(VS, y, m.col, 2);
    for (const p of m.ph) lines(p).forEach(([x, a], i) => {
      const col = p.type === "sextet" ? LINE6[i] : LINE6[i * 5];
      ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(P.X(x), P.Y(1.06)); ctx.lineTo(P.X(x), P.Y(1.06) + 10 + a * 30 * (m.ph.length > 1 ? p.A / 3 * 2 : 1)); ctx.stroke();
    });
    txt(ctx, m.src, P.x + P.w - 6, P.y + P.h - 8, { align: "right", size: 10.5, col: C.mute });
    // --- fingerprint strip: every mineral on the same axis
    const S0 = 0.66 * h, rowH = (h - S0 - 40) / MIN.length;
    txt(ctx, "Fingerprints on one axis (click a row)", 10, S0 - 8, { w: 600, size: 13 });
    geom = { x: P.x, w: P.w, S0, rowH };
    MIN.forEach((mm, r) => {
      const yb = S0 + (r + 1) * rowH - 3;
      if (r === sel) { ctx.fillStyle = "#f6f3ea"; ctx.fillRect(10, S0 + r * rowH, w - 20, rowH); }
      txt(ctx, mm.name, P.x - 10, yb - rowH * 0.25, { align: "right", size: 12, w: r === sel ? 600 : 400, col: mm.col });
      ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(P.x, yb); ctx.lineTo(P.x + P.w, yb); ctx.stroke();
      const At = mm.ph.reduce((s, p) => s + p.A, 0);
      for (const p of mm.ph) for (const [x, a] of lines(p)) {
        ctx.strokeStyle = mm.col; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(P.X(x), yb); ctx.lineTo(P.X(x), yb - (rowH - 6) * Math.min(1, a * 3.2 * p.A / At * (mm.ph.length > 1 ? 1.5 : 1))); ctx.stroke();
      }
    });
    const ax = new Plot(ctx, P.x, h - 38, P.w, 0, [-10, 10], [0, 1]);
    ax.frame({ xlabel: "source velocity (mm/s)", zero: false });
  }, 1.3);
  document.getElementById("f2").addEventListener("click", ev => {
    if (!geom) return; const r = ev.target.getBoundingClientRect(), y = ev.clientY - r.top;
    const i = Math.floor((y - geom.S0) / geom.rowH);
    if (i >= 0 && i < MIN.length) document.querySelector(`#f2-min button[data-v="${i}"]`).click();
  });
})();

/* =============== FRAME 3: sweeping the Doppler velocity builds the spectrum =============== */
(function () {
  if (!document.getElementById("f3")) return;
  const VMAX = 10, NB = 160, B0 = 250;   // channels across +-10 mm/s; ~250 baseline counts per channel per pass
  const SAMPLES = { fe: [MIN[0], 0.30], hem: [MIN[1], 0.30], jar: [MIN[6], 0.22] };
  let samp = "fe", speed = 1, playing = true, tau = 0, counts, prof;
  const binV = i => -VMAX + (i + 0.5) * 2 * VMAX / NB;
  function reset() {
    counts = new Float64Array(NB); tau = 0; seed = 777;
    const ph = SAMPLES[samp][0].ph, raw = Array.from({ length: NB }, (_, i) => absorb(binV(i), ph, 0.3)), mx = Math.max(...raw);
    prof = raw.map(x => 1 + SAMPLES[samp][1] * x / mx);   // backscatter: re-emitted counts go UP at resonance
    photons.length = 0;
  }
  const photons = [];
  seg("f3-samp", [["fe", "α-Fe"], ["hem", "hematite"], ["jar", "jarosite"]], v => { samp = v; reset(); }, "fe");
  seg("f3-speed", [[1, "1×"], [3, "3×"], [10, "10×"]], v => { speed = +v; }, 1);
  document.getElementById("f3-play").onclick = e => { playing = !playing; e.target.textContent = playing ? "pause" : "play"; };
  document.getElementById("f3-reset").onclick = () => reset();
  reset();
  const vOf = p => { p = ((p % 2) + 2) % 2; return p < 1 ? -VMAX + 2 * VMAX * p : VMAX - 2 * VMAX * (p - 1); };
  const xOf = p => {   // displacement (um) at 25 Hz: a half period is 20 ms; constant acceleration -> parabolas
    p = ((p % 2) + 2) % 2; const T = 0.02;
    if (p < 1) return 1e3 * T * (-VMAX * p + VMAX * p * p);
    const q = p - 1; return 1e3 * T * (VMAX * q - VMAX * q * q);
  };
  canvas("f3", 0.66, (d, dt) => {
    const { ctx, w, h } = d, SEC = 3;   // one pass takes 3 s at 1x (the real drive does it in 20 ms)
    if (playing) {
      const dTau = dt * speed / SEC, n = Math.ceil(dTau * NB * 2) + 1;
      for (let k = 0; k < n; k++) {
        const p = tau + (k + 0.5) * dTau / n, v = vOf(p), i = Math.min(NB - 1, Math.max(0, Math.floor((v + VMAX) / (2 * VMAX) * NB)));
        counts[i] += poisson(B0 * NB * (dTau / n) * prof[i]);
      }
      tau += dTau;
      if (rnd() < dt * 22 * Math.min(speed, 3)) photons.push({ t: 0, res: rnd() < (prof[Math.floor((vOf(tau) + VMAX) / (2 * VMAX) * (NB - 1))] - 1) * 3 + 0.15 });
    }
    const v = vOf(tau), pass = Math.floor(tau) + 1;
    // --- setup schematic (top left)
    const Sx = 10, Sw = 0.44 * w, Sy = 30, Sh = 0.42 * h;
    txt(ctx, "Backscatter head (side view)", Sx, 18, { w: 600, size: 13 });
    tag(ctx, "SCHEMATIC: motion exaggerated", Sx + Sw - 190, 18);
    const axY = Sy + Sh * 0.42, xRest = Sx + Sw * 0.32, amp = Sw * 0.06, xs = xRest + amp * xOf(tau) / 50 * 2;
    ctx.fillStyle = "#e2e8f0"; ctx.fillRect(Sx + 6, axY - 26, Sw * 0.16, 52);
    txt(ctx, "drive", Sx + 6 + Sw * 0.08, axY + 42, { align: "center", size: 11, col: C.mute });
    ctx.strokeStyle = C.mute; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(Sx + 6 + Sw * 0.16, axY); ctx.lineTo(xs - 6, axY); ctx.stroke();
    ctx.fillStyle = C.src; ctx.fillRect(xs - 6, axY - 14, 12, 28);
    txt(ctx, "source", xs, axY - 20, { align: "center", size: 11, col: C.src });
    arrow(ctx, xs, axY + 22, xs + (v / VMAX) * 34, axY + 22, C.red, 2, 6);
    const smX = Sx + Sw * 0.86; ctx.fillStyle = C.sample; ctx.fillRect(smX, Sy + 10, 14, Sh - 20);
    txt(ctx, "sample", smX + 7, Sy + Sh + 4, { align: "center", size: 11, col: C.sample });
    const dX = Sx + Sw * 0.46, dY = axY + Sh * 0.36;
    ctx.fillStyle = C.det; ctx.beginPath(); ctx.ellipse(dX, dY, 9, 16, -0.5, 0, 7); ctx.fill();
    txt(ctx, "detector", dX, dY + 30, { align: "center", size: 11, col: C.det });
    for (let i = photons.length - 1; i >= 0; i--) {
      const ph = photons[i]; ph.t += dt * 1.6;
      if (ph.t < 0.5) { const k = ph.t / 0.5; ctx.fillStyle = C.src; ctx.beginPath(); ctx.arc(xs + 8 + k * (smX - xs - 8), axY + (rnd() - 0.5) * 0, 2.6, 0, 7); ctx.fill(); }
      else if (ph.res && ph.t < 1) { const k = (ph.t - 0.5) / 0.5; ctx.fillStyle = C.purple; ctx.beginPath(); ctx.arc(smX + k * (dX - smX), axY + k * (dY - axY), 3.2, 0, 7); ctx.fill(); }
      else if (ph.res && ph.t < 1.15) { ctx.fillStyle = "rgba(128,90,213,.35)"; ctx.beginPath(); ctx.arc(dX, dY, 22, 0, 7); ctx.fill(); }
      else if (ph.t > 1.15 || (!ph.res && ph.t > 0.5)) photons.splice(i, 1);
    }
    txt(ctx, "orange: 14.4 keV photons out · purple: resonant re-emission counted", Sx + 4, Sy + Sh + 22, { size: 10.5, col: C.mute });
    // --- displacement and velocity vs time (top right)
    const P = new Plot(ctx, 0.55 * w, 40, 0.38 * w, 0.40 * h - 30, [0, 2], [-VMAX * 1.1, VMAX * 1.1]);
    txt(ctx, "Drive motion over one cycle", P.x, 18, { w: 600, size: 13 });
    const ts = grid(0, 2, 300);
    P.frame({ xlabel: "time (half-periods of the drive)", nx: 4, zero: false, yticks: true, ylabel: "velocity (mm/s)" });
    P.line([0, 2], [0, 0], C.grid, 1);
    P.line(ts, ts.map(vOf), C.red, 2);
    P.line(ts, ts.map(t => xOf(t) / 50 * VMAX), C.ink, 1.6, [5, 4]);
    const tp = ((tau % 2) + 2) % 2;
    P.vline(tp, "rgba(229,62,62,.35)", 1);
    P.dots([tp], [v], C.red, 5); P.dots([tp], [xOf(tau) / 50 * VMAX], C.ink, 4);
    for (const t of [-50, 0, 50]) txt(ctx, String(t), P.x + P.w + 5, P.Y(t / 50 * VMAX) + 4, { size: 10.5, col: C.mute });
    ctx.save(); ctx.translate(P.x + P.w + 34, P.y + P.h / 2); ctx.rotate(Math.PI / 2); txt(ctx, "displacement (µm)", 0, 0, { align: "center", size: 11.5, col: C.mute }); ctx.restore();
    legend(ctx, P.x + 6, P.y + 14, [["velocity", C.red, "line"], ["displacement", C.ink, "dash"]]);
    // --- spectrum being built (bottom)
    const seen = [...counts].filter(c => c > 0), yMax = Math.max(1, ...seen), yMin = seen.length ? Math.min(...seen) : 0;
    const pad = Math.max(0.06 * (yMax - yMin), 3 * Math.sqrt(yMax));
    const S = new Plot(ctx, 60, 0.58 * h, w - 80, 0.31 * h, [-VMAX, VMAX], [Math.max(0, yMin - pad), yMax + pad]);
    S.frame({ energy: true, yticks: true, ylabel: "counts per channel", xlabel: "source velocity (mm/s)", ny: 3 });
    const xsB = [], ysB = [];
    for (let i = 0; i < NB; i++) if (counts[i] > 0) { xsB.push(binV(i)); ysB.push(counts[i]); }
    S.dots(xsB, ysB, C.data, 2.1);
    S.vline(v, C.red, 2);
    txt(ctx, `pass ${pass}`, S.x + 6, S.y + 16, { w: 600, size: 13, col: C.red });
    txt(ctx, `v = ${v >= 0 ? "+" : ""}${v.toFixed(2)} mm/s  ·  ΔE = ${(v * NEV_PER_MMS).toFixed(0)} neV`, S.x + 70, S.y + 16, { size: 12, col: C.ink });
    txt(ctx, pass < 10 ? "counts land only in the channel under the red mark; the lines climb out of the noise pass by pass"
                       : "after ~10 passes every line stands clear of the counting noise",
        S.x + S.w - 6, S.y + 16, { align: "right", size: 11.5, col: C.mute });
  }, 1.25);
})();

/* =============== FRAME 4: fingerprints on Mars (NASA PDS MER data) =============== */
(function () {
  if (!document.getElementById("f4")) return;
  const keys = Object.keys(SB.mars);
  const hl = { olivine: "olivine", pyroxene: "pyroxene", hematite: "hematite", goethite: "goethite" };
  const colOf = n => (MIN.find(m => n.toLowerCase().includes(m.name)) || { col: C.mute }).col;
  canvas("f4", 0.62, (d) => {
    const { ctx, w, h } = d, narrow = w < 640;
    keys.forEach((k, i) => {
      const M = SB.mars[k], F = M.fit;
      const cx = narrow ? 0 : (i % 2), cy = narrow ? i : Math.floor(i / 2), nr = narrow ? 4 : 2, nc = narrow ? 1 : 2;
      const pw = w / nc, ph = h / nr;
      const ymax = Math.max(...M.y), ymin = Math.min(...M.y);
      const P = new Plot(ctx, cx * pw + 48, cy * ph + 50, pw - 64, ph - 98, [-11, 11], [ymin - 0.1 * (ymax - ymin), ymax + 0.12 * (ymax - ymin)]);
      P.frame({ energy: cy === 0, xlabel: cy === nr - 1 ? undefined : null, yticks: true, ny: 3, yfmt: t => (t * 100).toFixed(0) + "%", ylabel: cx === 0 ? "resonant counts above baseline" : undefined });
      const ci = M.phases.findIndex(p => p.name.toLowerCase().includes(hl[M.highlight]));
      M.phases.forEach((p, j) => { if (j !== ci) P.line(F.vg, F.comps[j], "#b8b4a8", 1); });
      if (ci >= 0) {
        P.clip(c => {
          c.fillStyle = colOf(M.highlight) + "55"; c.beginPath(); c.moveTo(P.X(F.vg[0]), P.Y(F.b0));
          F.vg.forEach((x, j) => c.lineTo(P.X(x), P.Y(F.comps[ci][j]))); c.lineTo(P.X(F.vg[F.vg.length - 1]), P.Y(F.b0)); c.fill();
        });
      }
      P.dots(M.v, M.y, C.data, 1.7);
      P.line(F.vg, F.total, C.ink, 1.4);
      txt(ctx, M.label, P.x, P.y - (cy === 0 ? 26 : 8), { w: 600, size: 12.5 });
      txt(ctx, M.highlight, P.x + 8, P.y + 16, { w: 700, size: 13, col: colOf(M.highlight) });
      txt(ctx, `${M.hours} h · ${M.T} K`, P.x + P.w - 6, P.y + 16, { align: "right", size: 10.5, col: C.mute });
    });
  }, 2.2);
})();

/* =============== FRAME 5: cosine smearing, source 30 mm back (blue) vs 8 mm back (purple) =============== */
(function () {
  if (!document.getElementById("f5")) return;
  let th = 12, sb = "8", zoom = "outer", pos = 8;
  const SBK = SB.setback, COL = { "30": C.blue, "8": C.purple };
  const sl = document.getElementById("f5-th"); sl.oninput = () => { th = +sl.value; };
  seg("f5-sb", [["30", "source 30 mm back"], ["8", "source 8 mm back"]], v => { sb = v; }, "8");
  seg("f5-zoom", [["full", "full spectrum"], ["outer", "zoom: outer line"]], v => { zoom = v; }, "outer");
  const T = SB.transmission && SB.transmission.fe_260508;
  const FE = (() => { const g = grid(-12, 12, 2400), a = g.map(v => absorb(v, MIN[0].ph)), mx = Math.max(...a); return { v: g, y: a.map(x => 1 - 0.22 * x / mx) }; })();
  const REF = T || FE, f = v => interp(REF.v, REF.y, v, 1);
  const ker = k => { const K = SBK[k]; const c = [], q = []; K.theta.forEach((t, i) => { if (K.q[i] > 0) { c.push(Math.cos(t * Math.PI / 180)); q.push(K.q[i]); } }); return { c, q, K }; };
  const xs = grid(-11, 11, 1100), SM = {};
  for (const k of ["30", "8"]) { const g = smear(f, ker(k)); SM[k] = xs.map(g); }
  canvas("f5", 0.52, (d, dt) => {
    const { ctx, w, h } = d;
    pos += (+sb - pos) * (1 - Math.exp(-dt * 4));
    // --- geometry (left): the source slides along the drive axis behind a fixed aperture
    const Lw = 0.44 * w;
    txt(ctx, "A photon leaving at angle θ sees only v·cos θ", 10, 18, { w: 600, size: 13 });
    tag(ctx, "SCHEMATIC", Lw - 80, 18);
    const sy = 0.46 * h, smX = Lw - 24, apX = 10 + 0.62 * (smX - 10), apR = 0.07 * h, mmPx = (apX - 40) / 32;
    const sx = apX - pos * mmPx;
    ctx.setLineDash([6, 4]); ctx.strokeStyle = C.mute; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(apX - 32 * mmPx - 20, sy); ctx.lineTo(smX, sy); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, "drive axis", smX - 4, sy - 6, { align: "right", size: 10.5, col: C.mute });
    for (const k of ["30", "8"]) {   // where each setback puts the source
      const gx = apX - +k * mmPx; ctx.strokeStyle = COL[k]; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.strokeRect(gx - 8, sy - 14, 10, 28); ctx.globalAlpha = 1;
      txt(ctx, `${k} mm back`, gx - 3, sy + 32, { align: "center", size: 10.5, col: COL[k] });
    }
    const tmax = Math.atan((apR + 4 * mmPx) / (apX - sx)) * 180 / Math.PI;
    for (let a = -tmax; a <= tmax + 0.01; a += tmax / 7) {
      const r = a * Math.PI / 180; ctx.strokeStyle = thetaCol(Math.abs(a)); ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(sx + 2, sy); ctx.lineTo(smX, sy + Math.tan(r) * (smX - sx)); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "#4a5568"; ctx.fillRect(apX - 3, sy - 0.40 * h, 6, 0.40 * h - apR); ctx.fillRect(apX - 3, sy + apR, 6, 0.40 * h - apR);
    txt(ctx, "aperture", apX, sy - 0.40 * h - 6, { align: "center", size: 10.5, col: C.mute });
    ctx.fillStyle = "#e2e8f0"; ctx.fillRect(sx - 30, sy - 20, 22, 40);
    ctx.fillStyle = C.src; ctx.fillRect(sx - 8, sy - 14, 10, 28);
    ctx.fillStyle = C.sample; ctx.fillRect(smX, sy - 0.40 * h, 12, 0.80 * h);
    txt(ctx, "sample", smX + 6, sy + 0.40 * h + 14, { align: "center", size: 10.5, col: C.sample });
    const r = th * Math.PI / 180, ey = sy - Math.tan(r) * (smX - sx);
    ctx.strokeStyle = C.red; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(sx + 2, sy); ctx.lineTo(smX, ey); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx + 2, sy, 46, -r, 0); ctx.stroke();
    txt(ctx, `θ = ${th}°`, sx + 52, sy - 8, { size: 12, w: 600, col: C.red, halo: true });
    const by = sy + 0.30 * h, V = 0.30 * Lw;
    arrow(ctx, 20, by, 20 + V, by, C.ink, 2.2); txt(ctx, "v (drive)", 26 + V, by + 4, { size: 11.5 });
    arrow(ctx, 20, by + 24, 20 + V * Math.cos(r) * Math.cos(r), by + 24 - V * Math.cos(r) * Math.sin(r), C.red, 2.2);
    txt(ctx, `v·cos θ = ${(Math.cos(r) * 100).toFixed(1)}% of v`, 26 + V, by + 24, { size: 11.5, col: C.red });
    txt(ctx, `a line at v₀ is reached at v₀ / cos θ, ${(100 / Math.cos(r) - 100).toFixed(1)}% further out`, 10, h - 10, { size: 11.5 });
    // --- MC angle distributions (top right)
    const qmax = Math.max(...SBK["30"].q, ...SBK["8"].q);
    const H = new Plot(ctx, 0.53 * w, 46, 0.44 * w, 0.24 * h, [0, 40], [0, qmax * 1.12]);
    txt(ctx, "How often each θ reaches the detector (Monte Carlo)", H.x, 18, { w: 600, size: 13 });
    H.frame({ xlabel: "θ, angle from the drive axis (deg)", nx: 8, zero: false });
    for (const k of ["30", "8"]) {
      const K = SBK[k]; H.clip(c => {
        c.fillStyle = COL[k] + (k === sb ? "55" : "22"); c.strokeStyle = COL[k]; c.lineWidth = k === sb ? 1.8 : 1;
        c.beginPath(); c.moveTo(H.X(0), H.Y(0)); K.theta.forEach((t, i) => c.lineTo(H.X(t), H.Y(K.q[i]))); c.lineTo(H.X(K.theta[K.theta.length - 1]), H.Y(0)); c.closePath(); c.fill(); c.stroke();
      });
    }
    H.vline(th, C.red, 1.5);
    const e = SBK["8"].eff / SBK["30"].eff;
    ctx.font = `400 11.5px ${FONT}`;
    txt(ctx, `30 mm back: mean θ ${SBK["30"].theta_mean}°`, H.x + H.w - 6, H.y + 16, { align: "right", size: 11.5, col: C.blue });
    txt(ctx, `8 mm back: mean θ ${SBK["8"].theta_mean}°, ${e.toFixed(1)}× the counts`, H.x + H.w - 6, H.y + 32, { align: "right", size: 11.5, col: C.purple });
    // --- the alpha-Fe spectrum through each kernel (bottom right)
    const xr = zoom === "full" ? [-7, 7] : [4.4, 6.9];
    const yv = REF.y.filter((_, i) => REF.v[i] > xr[0] && REF.v[i] < xr[1]);
    const Q = new Plot(ctx, 0.53 * w, 0.47 * h, 0.44 * w, 0.40 * h, xr, [Math.min(...yv) - 0.02, 1.02]);
    Q.frame({ energy: true, nx: zoom === "full" ? 7 : 5, xlabel: "source velocity (mm/s)" });
    if (T) Q.dots(T.v, T.y, C.data, zoom === "full" ? 1.5 : 2.4); else Q.line(REF.v, REF.y, "#8a8f87", 2.2);
    const one = smear(f, { c: [Math.cos(r)], q: [1] }), xz = grid(xr[0], xr[1], 400);
    Q.line(xz, xz.map(one), C.red, 1.1, [4, 3]);
    Q.line(xs, SM["30"], C.blue, sb === "30" ? 2.6 : 1.6);
    Q.line(xs, SM["8"], C.purple, sb === "8" ? 2.6 : 1.6);
    legend(ctx, Q.x, Q.y + Q.h + 44, [T ? ["α-Fe in transmission (measured)", C.data, "dot"] : ["α-Fe, no smear (model)", "#8a8f87", "line"], ["30 mm back", C.blue, "line"], ["8 mm back", C.purple, "line"], [`only θ = ${th}°`, C.red, "dash"]]);
  }, 1.4);
})();

/* =============== FRAME 6: our heads: the photo and the 3-D model =============== */
(function () {
  if (!document.getElementById("f6a")) return;
  let head = "fe_8mm", yaw = -0.75, pitch = 0.35, zoomK = 1, drag = null;
  const imgs = {};
  for (const k in SB.photos) { const im = new Image(); im.src = SB.photos[k].img; imgs[k] = im; }
  seg("f6-head", [["fe_8mm", "α-Fe run, Sep 2026"], ["hem", "hematite run, Nov 2026"]], v => { head = v; build(); }, "fe_8mm");
  let rays = [], geo = null;
  const add = (a, b) => a.map((x, i) => x + b[i]), sub = (a, b) => a.map((x, i) => x - b[i]), mul = (a, s) => a.map(x => x * s);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm = a => mul(a, 1 / Math.hypot(...a));
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function basis(n) { const u = norm(cross(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])); return [u, cross(n, u)]; }
  function build() {   // toy rays through the real MC geometry: source disk -> aperture -> sample plane
    const c = SB.kernels[head].config, S = c.source_pos, F = c.focus_point || [0, 0, 0];
    const n = norm(sub(F, S)), [u, v] = basis(n), zs = c.sample_offset || 0;
    const stand = c.aperture_standoff != null ? c.aperture_standoff : Math.hypot(...sub(F, S)) - c.aperture_wd;
    const A = add(S, mul(n, stand)), D = c.detectors[0].pos, dn = norm(sub(F, D)), [du, dv] = basis(dn);
    geo = { S, n, u, v, A, D, dn, du, dv, zs, src: c.source_diameter / 2, ap: c.aperture_diameter / 2, det: (c.detector_diameter || 7.7) / 2 };
    rays = []; seed = 99;
    for (let k = 0; rays.length < 360 && k < 60000; k++) {
      const rr = geo.src * Math.sqrt(rnd()), ph = 2 * Math.PI * rnd();
      const P = add(S, add(mul(u, rr * Math.cos(ph)), mul(v, rr * Math.sin(ph))));
      const ct = 1 - rnd() * (1 - Math.cos(35 * Math.PI / 180)), st = Math.sqrt(1 - ct * ct), p2 = 2 * Math.PI * rnd();
      const dir = add(mul(n, ct), add(mul(u, st * Math.cos(p2)), mul(v, st * Math.sin(p2))));
      const t1 = dot(sub(A, P), n) / dot(dir, n), Q = add(P, mul(dir, t1));
      const t2 = (zs - P[2]) / dir[2]; if (t2 <= 0) continue;
      const Hh = add(P, mul(dir, t2)), th = Math.acos(ct) * 180 / Math.PI;
      if (Math.hypot(...sub(Q, A)) > geo.ap) { if (rays.length % 5 === 0) rays.push({ P, E: Q, th, blocked: true }); continue; }
      rays.push({ P, E: Hh, th, blocked: false });
    }
  }
  build();
  // photo + the annotator's own MC ray paths
  canvas("f6a", 0.82, (d) => {
    const { ctx, w, h, t } = d, Ph = SB.photos[head], im = imgs[head];
    const sc = Math.min(w / Ph.size[0], h / Ph.size[1]), ox = (w - Ph.size[0] * sc) / 2, oy = (h - Ph.size[1] * sc) / 2;
    if (im.complete && im.naturalWidth) ctx.drawImage(im, ox, oy, Ph.size[0] * sc, Ph.size[1] * sc);
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(ox, oy, Ph.size[0] * sc, Ph.size[1] * sc);
    const X = p => [ox + p[0] * sc, oy + p[1] * sc];
    ctx.lineWidth = 0.8;
    for (const p of Ph.lost.slice(0, 120)) { ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(...X(p[0])); ctx.lineTo(...X(p[1])); ctx.stroke(); }
    for (const p of Ph.detected) { ctx.strokeStyle = "rgba(128,90,213,.28)"; ctx.beginPath(); ctx.moveTo(...X(p[0])); ctx.lineTo(...X(p[1])); ctx.lineTo(...X(p[2])); ctx.stroke(); }
    for (let i = 0; i < 26; i++) {   // photons in flight along detected paths
      const p = Ph.detected[(i * 37 + Math.floor(t / 1.4 + i / 26) * 11) % Ph.detected.length], k = ((t / 1.4 + i / 26) % 1);
      const a = k < 0.5 ? X(p[0]) : X(p[1]), b = k < 0.5 ? X(p[1]) : X(p[2]), s = (k % 0.5) / 0.5;
      ctx.fillStyle = k < 0.5 ? C.src : C.purple; ctx.beginPath(); ctx.arc(a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1]), 3, 0, 7); ctx.fill();
    }
    const mean = j => [0, 1].map(c => Ph.detected.reduce((s, p) => s + p[j][c], 0) / Ph.detected.length);
    for (const [j, lab, col] of [[0, "source", C.src], [1, "sample", C.sample], [2, "detector", C.det]]) {
      const [x, y] = X(mean(j)); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      txt(ctx, lab, x + 8, y - 6, { size: 12, w: 700, col, halo: true });
    }
    txt(ctx, `photo + Monte Carlo paths (${Ph.mc.n_det} detected of ${(Ph.mc.n_launched / 1e6).toFixed(0)} M launched)`, 8, h - 8, { size: 11, w: 600, halo: true });
  }, 0.95);
  // 3-D model of the same head, drag to rotate
  const cv3 = document.getElementById("f6b");
  cv3.addEventListener("pointerdown", e => { drag = [e.clientX, e.clientY, yaw, pitch]; cv3.setPointerCapture(e.pointerId); });
  cv3.addEventListener("pointermove", e => { if (drag) { yaw = drag[2] + (e.clientX - drag[0]) * 0.01; pitch = Math.max(-1.4, Math.min(1.4, drag[3] + (e.clientY - drag[1]) * 0.01)); } });
  cv3.addEventListener("pointerup", () => { drag = null; });
  cv3.addEventListener("wheel", e => { e.preventDefault(); zoomK = Math.max(0.5, Math.min(3, zoomK * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
  canvas("f6b", 0.82, (d, dt) => {
    const { ctx, w, h } = d, G = geo;
    if (!drag) yaw += dt * 0.12;
    const ctr = [(G.S[0] + G.D[0]) / 2, 0, (G.S[2] + G.zs) / 2 + 4], scl = Math.min(w, h) / 95 * zoomK;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const pr = p => {
      const x = p[0] - ctr[0], y = p[1] - ctr[1], z = p[2] - ctr[2];
      const x1 = cy * x - sy * y, y1 = sy * x + cy * y, y2 = cp * y1 - sp * z, z2 = sp * y1 + cp * z;
      const s = 160 / (160 + y2); return [w / 2 + scl * x1 * s, h / 2 - scl * z2 * s];
    };
    const poly = (pts, stroke, fill, lw = 1.2) => {
      ctx.beginPath(); pts.forEach((p, i) => { const q = pr(p); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    };
    const disk = (c, u, v, r, n = 40) => grid(0, 2 * Math.PI, n).map(a => add(c, add(mul(u, r * Math.cos(a)), mul(v, r * Math.sin(a)))));
    // sample plate with a 5 mm grid
    const L = 28, z = G.zs;
    poly([[-L, -L, z], [L, -L, z], [L, L, z], [-L, L, z]], C.faint, "rgba(139,94,60,.16)");
    ctx.strokeStyle = "rgba(139,94,60,.18)"; ctx.lineWidth = 0.7;
    for (let g = -L; g <= L; g += 5) { ctx.beginPath(); ctx.moveTo(...pr([g, -L, z])); ctx.lineTo(...pr([g, L, z])); ctx.moveTo(...pr([-L, g, z])); ctx.lineTo(...pr([L, g, z])); ctx.stroke(); }
    // rays coloured by their angle to the drive axis
    for (const r of rays) {
      ctx.strokeStyle = r.blocked ? "rgba(160,160,160,.35)" : thetaCol(r.th); ctx.globalAlpha = r.blocked ? 1 : 0.55; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(...pr(r.P)); ctx.lineTo(...pr(r.E)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // drive axis, source, aperture, detector
    ctx.setLineDash([5, 4]); ctx.strokeStyle = C.mute; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...pr(add(G.S, mul(G.n, -18)))); ctx.lineTo(...pr(add(G.S, mul(G.n, 40)))); ctx.stroke(); ctx.setLineDash([]);
    poly(disk(add(G.S, mul(G.n, -14)), G.u, G.v, G.src + 2), "#718096", "rgba(226,232,240,.8)");
    poly(disk(G.S, G.u, G.v, G.src), C.src, "rgba(221,107,32,.55)", 1.6);
    poly(disk(G.A, G.u, G.v, G.ap + 5), "#4a5568", null, 4); poly(disk(G.A, G.u, G.v, G.ap), "#4a5568", null, 1.4);
    poly(disk(G.D, G.du, G.dv, G.det), C.det, "rgba(44,122,123,.55)", 1.6);
    poly(disk(add(G.D, mul(G.dn, -10)), G.du, G.dv, G.det + 1.5), "#718096", "rgba(226,232,240,.6)");
    const lab = (p, s, col) => { const q = pr(p); txt(ctx, s, q[0] + 8, q[1] - 6, { size: 12, w: 700, col, halo: true }); };
    lab(add(G.S, mul(G.n, -14)), "source on drive", C.src); lab(G.A, "aperture", "#4a5568"); lab(G.D, "detector", C.det); lab([L * 0.7, -L * 0.7, z], "sample", C.sample);
    const K = SB.kernels[head];
    txt(ctx, `Monte Carlo geometry · drag to rotate, scroll to zoom`, 8, 16, { size: 11.5, w: 600 });
    txt(ctx, `rays coloured by θ: blue 0° → purple 25° · grey = stopped by the aperture`, 8, h - 24, { size: 11, col: C.mute });
    txt(ctx, `detected photons: mean θ ${K.theta_mean}°, line stretch ${K.stretch_pct}%, spread ${K.spread_pct}%`, 8, h - 8, { size: 11, w: 600 });
  }, 0.95);
})();

/* =============== FRAME 7: does the MC predict what we measured? =============== */
(function () {
  if (!document.getElementById("f7")) return;
  let run = "hem", zoom = "full";
  seg("f7-run", [["hem", "hematite (photographed head)"], ["fe_8mm", "α-Fe plate, 8 mm aperture"]], v => { run = v; }, "hem");
  seg("f7-zoom", [["full", "full"], ["outer", "zoom: outer line"]], v => { zoom = v; }, "full");
  canvas("f7", 0.56, (d) => {
    const { ctx, w, h } = d, R = SB.backscatter[run];
    const out = run === "hem" ? [6.6, 9.6] : [4.0, 6.6];
    const xr = zoom === "full" ? [-10, 10] : out;
    const ys = R.y.filter((_, i) => R.v[i] > xr[0] && R.v[i] < xr[1]);
    const P = new Plot(ctx, 60, 44, w - 80, 0.56 * h, xr, [Math.min(...ys) - 0.01, Math.max(...ys) + 0.01]);
    P.frame({ energy: true, xlabel: null, yticks: true, ny: 4, ylabel: "counts / baseline", yfmt: t => t.toFixed(2) });
    txt(ctx, R.label + " · backscatter, measured", P.x, 14, { w: 600, size: 13 });
    P.dots(R.v, R.y, C.data, zoom === "full" ? 1.9 : 3);
    P.line(R.v, R.none, C.blue, 1.8);
    P.line(R.v, R.mc, C.purple, 2.2);
    const Rz = new Plot(ctx, 60, P.y + P.h + 14, w - 80, 0.20 * h, xr, [-0.03, 0.03]);
    const res = R.y.map((y, i) => y - R.none[i]), resM = R.y.map((y, i) => y - R.mc[i]);
    const lim = Math.max(0.006, ...res.filter((_, i) => R.v[i] > xr[0] && R.v[i] < xr[1]).map(Math.abs)) * 1.1;
    Rz.yr = [-lim, lim];
    Rz.frame({ yticks: true, ny: 2, ylabel: "residual", yfmt: t => t.toFixed(3) });
    Rz.line(xr, [0, 0], C.faint, 1);
    Rz.dots(R.v, res, C.blue, 1.6); Rz.dots(R.v, resM, C.purple, 1.6);
    legend(ctx, P.x + 6, P.y + 18, [["measured", C.data, "dot"], [`fit, no smearing (χ²ν ${R.chi2_nu.none})`, C.blue, "line"], [`fit, MC smearing kernel (χ²ν ${R.chi2_nu.mc_fixed})`, C.purple, "line"]]);
  }, 1.0);
})();

/* =============== FRAME 8: the kernel applied to the systems we study =============== */
(function () {
  if (!document.getElementById("f8")) return;
  const SYS = SB.transmission ? [
    { k: "fe", name: "α-Fe (measured transmission)", meas: SB.transmission.fe_260508 },
    { k: "hem", name: "hematite (measured transmission)", meas: SB.transmission.hematite_260624 },
    ...MIN.slice(2).map(m => ({ k: m.k, name: m.name + " (literature model)", ph: m.ph })),
  ] : MIN.map(m => ({ k: m.k, name: m.name + " (literature model)", ph: m.ph }));
  const HEADS = SB.transmission
    ? [["hem", "hematite head"], ["fe_8mm", "α-Fe head"], ["fe_highsmear", "high-smear head (provisional)"]]
    : [["fe_8mm", "our head (ver2)"], ["sb8", "source 8 mm back"]];
  const HNAME = Object.fromEntries(HEADS);
  let sys = 0, head = HEADS[0][0];
  seg("f8-sys", SYS.map((s, i) => [i, s.name.replace(/ \(.*\)/, "")]), v => { sys = +v; table(); }, 0);
  seg("f8-head", HEADS, v => { head = v; table(); }, head);
  const fnOf = s => {
    if (s.meas) return v => interp(s.meas.v, s.meas.y, v, 1);
    const xs = grid(-12, 12, 1200), a = xs.map(v => absorb(v, s.ph)), mx = Math.max(...a);
    const y = a.map(x => 1 - 0.2 * x / mx); return v => interp(xs, y, v, 1);
  };
  const outer = s => {   // the line farthest from zero: the one cosine smearing moves most
    const ph = s.ph || (s.k === "fe" ? MIN[0].ph : MIN[1].ph); let best = 0;
    for (const p of ph) for (const [x] of lines(p)) if (Math.abs(x) > Math.abs(best)) best = x; return best;
  };
  const stats = (s, key) => {
    const ker = kernelOf(key), v0 = Math.abs(outer(s));
    let m = 0, m2 = 0; ker.c.forEach((c, i) => { m += ker.q[i] / c; m2 += ker.q[i] / c / c; });
    return { v0, shift: v0 * (m - 1), spread: v0 * Math.sqrt(Math.max(0, m2 - m * m)) };
  };
  function table() {
    const rows = SYS.map((s, i) => { const st = stats(s, head); return `<tr class="${i === sys ? "on" : ""}"><td>${s.name}</td><td>${st.v0.toFixed(2)}</td><td>${st.shift.toFixed(3)}</td><td>${(st.shift / LW).toFixed(2)}</td><td>${st.spread.toFixed(3)}</td></tr>`; });
    document.getElementById("f8-table").innerHTML = `<table><thead><tr><th>system</th><th>outermost line (mm/s)</th><th>moves out by (mm/s)</th><th>in line widths</th><th>extra spread (mm/s)</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
  }
  table();
  canvas("f8", 0.46, (d) => {
    const { ctx, w, h } = d, s = SYS[sys], f = fnOf(s), g = smear(f, kernelOf(head));
    const xs = grid(-11, 11, 800), ys = xs.map(f), ysm = xs.map(g);
    const P = new Plot(ctx, 60, 44, w - 80, h - 110, [-11, 11], [Math.min(...ys) - 0.01, 1.01]);
    P.frame({ energy: true, yticks: true, ny: 3, ylabel: "transmission", yfmt: t => t.toFixed(2), xlabel: "source velocity (mm/s)" });
    txt(ctx, `${s.name}, through the kernel of: ${HNAME[head]}`, P.x, 14, { w: 600, size: 13 });
    if (s.meas) P.dots(s.meas.v, s.meas.y, C.blue, 1.8); else P.line(xs, ys, C.blue, 1.8);
    P.line(xs, ysm, C.purple, 2.2);
    const st = stats(s, head);
    legend(ctx, P.x + 6, P.y + P.h - 10, [[s.meas ? "transmission (measured)" : "transmission (model)", C.blue, s.meas ? "dot" : "line"], ["after cosine smearing (MC kernel)", C.purple, "line"]]);
    txt(ctx, `outermost line moves out ${st.shift.toFixed(3)} mm/s = ${(st.shift / LW).toFixed(2)} line widths`, P.x + P.w - 6, P.y + 16, { align: "right", size: 12, w: 600, col: C.purple });
  }, 0.9);
})();

requestAnimationFrame(loop);
})();
