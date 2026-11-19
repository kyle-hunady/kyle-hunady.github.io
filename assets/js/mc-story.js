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
  seg("f1-env", [["same", "Matching iron environment"], ["diff", "Different iron environment"]],
      v => { match = v === "same"; }, "same");
  canvas("f1", 0.46, (d) => {
    const { ctx, w, h } = d, t = d.t;
    // --- decay scheme (left)
    const L = Math.min(0.3 * w, 290), x0 = 18, x1 = L;
    txt(ctx, "How the source emits a gamma ray", x0, 20, { w: 600, size: 13 });
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
    txt(ctx, "Absorption peaks when the energies match", R0, 20, { w: 600, size: 13 });
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
    nucleus(sx, C.src, "⁵⁷Fe in the source", 0);
    nucleus(ax, C.sample, "⁵⁷Fe in the sample", glow);
    ladder(sx - r - 30, 34, false);
    ladder(ax + r + 30, match ? 34 : 44, absorbed && ph < travel + 0.25);
    txt(ctx, match ? "matching energy" : "shifted energy", ax + r + 30, cy + 34, { align: "center", size: 10.5, col: C.mute });
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
      txt(ctx, "passes through the sample", ax, cy - r - 14, { align: "center", size: 11.5, col: C.mute });
    } else if (ph > travel + 0.18) {   // re-emission back toward the instrument
      const k = (ph - travel - 0.18) / (1 - travel - 0.18), ang = Math.PI * 0.82;
      const ex = ax + Math.cos(ang) * (r + 10 + k * 0.42 * (ax - sx)), ey = cy - Math.sin(ang) * (r + 10 + k * 0.6 * h * 0.4);
      ctx.fillStyle = C.purple; ctx.beginPath(); ctx.arc(ex, ey, 4.5, 0, 7); ctx.fill();
      txt(ctx, "Decay can emit a gamma ray, X-ray or electron", ax, cy - r - 30, { align: "right", size: 11.5, col: C.purple });
    }
    // energy ruler: the two lines on a neV scale
    const P = new Plot(ctx, R0 + 0.04 * w, 0.73 * h, w - R0 - 0.08 * w, 0.15 * h, [-60, 60], [0, 1.15]);
    P.frame({ xlabel: "photon energy − 14.413 keV (neV)", zero: false, nx: 6 });
    const xs = grid(-60, 60, 400), g = GAMMA_NEV / 2, sh = match ? 0 : 0.4 * NEV_PER_MMS;
    P.line(xs, xs.map(x => g * g / (x * x + g * g)), C.src, 2);
    P.line(xs, xs.map(x => g * g / ((x - sh) ** 2 + g * g)), C.sample, 2, [5, 3]);
    legend(ctx, P.x + 4, P.y - 6, [["emission line", C.src, "line"], ["absorption line", C.sample, "dash"]]);
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
    txt(ctx, "Select a row to compare spectra", 10, S0 - 8, { w: 600, size: 13 });
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
// A photon-by-photon simulation. Each frame emits a Poisson number of source photons at times spread over the frame;
// each one leaves at the drive velocity of its moment and an angle theta drawn from that sample's Monte Carlo kernel
// (SB.kernels: detected-photon source angles), so the rock sees v cos(theta). It comes back to the detector with
// probability PB (non-resonant scatter) plus PB*eff*shape(v cos theta) (resonant re-emission off the sample's lines),
// and a detected photon is counted in the channel of the drive velocity, as the electronics do. Speed = photons per
// second of animation; the drive keeps the same pace, so more speed means more counts per pass and noise ~ 1/sqrt(N).
(function () {
  if (!document.getElementById("f3")) return;
  const VMAX = 10, NB = 512, SEC = 3;                 // 512 channels across +-10 mm/s; one pass takes 3 s on screen
  const RATE = 30000, NMAX = 60000, PB = 0.5;         // source photons per animation second at 1x; per-frame cap
  const SAMPLES = { fe: [MIN[0], 0.30, "fe_8mm"], hem: [MIN[1], 0.30, "hem"], jar: [MIN[6], 0.22, "jarosite_co57"] };
  const TV = 12, TN = 4801, TDV = 2 * TV / (TN - 1);   // resonance lookup table over +-12 mm/s
  const SHOW = { 1: 14, 10: 40, 100: 90 };            // photons drawn in the head per second (a sample of the real ones)
  let samp = "fe", speed = 1, playing = true, tau = 0, nEmit = 0, nDet = 0, nRes = 0;
  let counts, expo, shape, pbar, eff, cosQ;
  const NQ = 4096;                                    // cos(theta) quantile table: one lookup per photon
  const photons = [];
  const binV = i => -VMAX + (i + 0.5) * 2 * VMAX / NB;
  const binOf = v => Math.min(NB - 1, Math.max(0, Math.floor((v + VMAX) / (2 * VMAX) * NB)));
  function reset() {
    counts = new Float64Array(NB); expo = new Float64Array(NB); tau = 0; nEmit = nDet = nRes = 0; seed = 777; photons.length = 0;
    const [m, e, key] = SAMPLES[samp]; eff = e;
    shape = new Float32Array(TN); let mx = 0;
    for (let k = 0; k < TN; k++) { shape[k] = absorb(-TV + k * TDV, m.ph, LW); mx = Math.max(mx, shape[k]); }
    for (let k = 0; k < TN; k++) shape[k] /= mx;
    const ker = kernelOf(key), K = ker.K, nT = K.theta.length;   // invert the angle histogram once
    const thW = nT > 1 ? K.theta[1] - K.theta[0] : 0.25, cdf = new Float64Array(nT + 1);
    for (let i = 0; i < nT; i++) cdf[i + 1] = cdf[i] + Math.max(0, K.q[i]);
    cosQ = new Float32Array(NQ);
    for (let j = 0, i = 0; j < NQ; j++) {
      const u = (j + 0.5) / NQ * cdf[nT]; while (i < nT - 1 && cdf[i + 1] < u) i++;
      const th = K.theta[i] - thW / 2 + thW * (u - cdf[i]) / Math.max(1e-12, cdf[i + 1] - cdf[i]);
      cosQ[j] = Math.cos(th * Math.PI / 180);
    }
    const f = v => shape[Math.round((v + TV) / TDV)] || 0, g = smear(f, ker);
    pbar = new Float64Array(NB); for (let i = 0; i < NB; i++) pbar[i] = PB * (1 + eff * g(binV(i)));
    d3.dirty = true;
  }
  function expose(p0, p1, mu) {   // spread mu expected emissions over the channels the drive crosses in [p0, p1]
    const cut = Math.floor(p0) + 1;
    if (p1 > cut) { const f = (cut - p0) / (p1 - p0); expose(p0, cut - 1e-9, mu * f); expose(cut, p1, mu * (1 - f)); return; }
    let xa = (vOf(p0) + VMAX) / (2 * VMAX) * NB, xb = (vOf(p1) + VMAX) / (2 * VMAX) * NB;
    if (xa > xb) [xa, xb] = [xb, xa];
    const len = xb - xa;
    if (len <= 0) { expo[binOf(vOf(p0))] += mu; return; }
    for (let c = Math.floor(xa); c <= Math.floor(xb); c++) {
      const o = Math.min(xb, c + 1) - Math.max(xa, c); if (o > 0) expo[Math.min(NB - 1, Math.max(0, c))] += mu * o / len;
    }
  }
  function simPhotons(dt) {   // emit, fly, detect, bin: returns how many source photons this frame simulated
    const dTau = dt / SEC, mu = Math.min(RATE * speed * dt, NMAX), n = poisson(mu);   // slow frame -> capped, not stalled
    let nShow = Math.min(poisson(SHOW[speed] * dt), 60 - photons.length);
    expose(tau, tau + dTau, mu);                        // expected emissions per channel, for the model line
    for (let q = 0; q < n; q++) {
      const v = vOf(tau + rnd() * dTau), ve = v * cosQ[(rnd() * NQ) | 0];   // emission time -> drive velocity; angle
      const pr = PB * eff * shape[((ve + TV) / TDV + 0.5) | 0], u = rnd();
      const fate = u < PB ? 1 : u < PB + pr ? 2 : 0;    // 1 scattered, 2 resonant, 0 not detected
      if (fate) { counts[binOf(v)] += 1; nDet++; if (fate === 2) nRes++; }
      if (nShow > 0 && rnd() < 0.05) { photons.push({ t: 0, fate }); nShow--; }   // draw a few of the real ones
    }
    nEmit += n; tau += dTau; return n;
  }
  seg("f3-samp", [["fe", "α-Fe"], ["hem", "hematite"], ["jar", "jarosite"]], v => { samp = v; reset(); }, "fe");
  seg("f3-speed", [[1, "1×"], [10, "10×"], [100, "100×"]], v => { speed = +v; }, 1);
  document.getElementById("f3-play").onclick = e => { playing = !playing; e.target.textContent = playing ? "Pause" : "Play"; };
  document.getElementById("f3-reset").onclick = () => reset();
  const vOf = p => { p = ((p % 2) + 2) % 2; return p < 1 ? -VMAX + 2 * VMAX * p : VMAX - 2 * VMAX * (p - 1); };
  const xOf = p => {   // displacement (um) at 25 Hz: a half period is 20 ms; constant acceleration -> parabolas
    p = ((p % 2) + 2) % 2; const T = 0.02;
    if (p < 1) return 1e3 * T * (-VMAX * p + VMAX * p * p);
    const q = p - 1; return 1e3 * T * (VMAX * q - VMAX * q * q);
  };
  const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + " M" : n >= 1e4 ? Math.round(n / 1e3) + " k" : String(Math.round(n));
  let lastN = 0;
  const d3 = canvas("f3", 0.66, (d, dt) => {
    const { ctx, w, h } = d;
    if (playing && dt > 0) lastN = simPhotons(dt);
    const narrow = w < 500;   // phone: shorter labels, spectrum lower down, its legend and readout below the axis
    const v = vOf(tau), pass = Math.floor(tau) + 1;
    // --- setup schematic (top left)
    const Sx = 10, Sw = 0.44 * w, Sy = 30, Sh = 0.42 * h;
    txt(ctx, narrow ? "Side view" : "Backscatter head (side view)", Sx, 18, { w: 600, size: 13 });
    if (narrow) tag(ctx, "SCHEMATIC", Sx, 38); else tag(ctx, "SCHEMATIC: motion exaggerated", Sx + Sw - 190, 18);
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
    for (let i = photons.length - 1; i >= 0; i--) {   // each dot is one of the simulated photons, with its own fate
      const ph = photons[i]; if (playing) ph.t += dt * 1.6;
      if (ph.t < 0.5) { const k = ph.t / 0.5; ctx.fillStyle = C.src; ctx.beginPath(); ctx.arc(xs + 8 + k * (smX - xs - 8), axY, 2.6, 0, 7); ctx.fill(); }
      else if (ph.fate && ph.t < 1) { const k = (ph.t - 0.5) / 0.5; ctx.fillStyle = ph.fate === 2 ? C.purple : "#a0aec0"; ctx.beginPath(); ctx.arc(smX + k * (dX - smX), axY + k * (dY - axY), ph.fate === 2 ? 3.2 : 2.4, 0, 7); ctx.fill(); }
      else if (ph.fate === 2 && ph.t < 1.15) { ctx.fillStyle = "rgba(128,90,213,.35)"; ctx.beginPath(); ctx.arc(dX, dY, 22, 0, 7); ctx.fill(); }
      else if (ph.t > 1.15 || (!ph.fate && ph.t > 0.5) || (ph.fate === 1 && ph.t > 1)) photons.splice(i, 1);
    }
    txt(ctx, narrow ? "Orange: source · Purple: resonant · Grey: scattered" : "Orange: source photons · Purple: resonant · Grey: scattered", Sx + 4, Sy + Sh + 22, { size: 10.5, col: C.mute });
    // --- displacement and velocity vs time (top right)
    const P = new Plot(ctx, 0.55 * w, 40, 0.38 * w, 0.40 * h - 30, [0, 2], [-VMAX * 1.1, VMAX * 1.1]);
    txt(ctx, narrow ? "Drive motion" : "Drive motion over one cycle", P.x, 18, { w: 600, size: 13 });
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
    // --- spectrum being built (bottom): dots = simulated counts, line = their expectation
    let yMax = 1, yMin = Infinity, tot = 0, nb = 0, eMax = 0;
    for (let i = 0; i < NB; i++) eMax = Math.max(eMax, expo[i]);
    for (let i = 0; i < NB; i++) if (counts[i] > 0) {   // scale the axis on channels at least half as exposed as the most
      tot += counts[i]; nb++;
      if (expo[i] >= 0.5 * eMax) { yMax = Math.max(yMax, counts[i]); yMin = Math.min(yMin, counts[i]); }
    }
    if (yMin === Infinity) yMin = 0;
    const pad = Math.max(0.06 * (yMax - yMin), 3 * Math.sqrt(yMax));
    const S = new Plot(ctx, 60, (narrow ? 0.62 : 0.58) * h, w - 80, (narrow ? 0.22 : 0.31) * h, [-VMAX, VMAX], [Math.max(0, yMin - pad), yMax + pad]);
    S.frame({ energy: true, yticks: true, ylabel: "counts per channel", xlabel: "source velocity (mm/s)", ny: 3 });
    const xm = [], ym = [];
    for (let i = 0; i < NB; i++) if (expo[i] > 0) { xm.push(binV(i)); ym.push(expo[i] * pbar[i]); }
    if (xm.length > 1) S.line(xm, ym, "rgba(128,90,213,.75)", 1.2);
    const r = Math.max(0.8, Math.min(2, 0.8 * S.w / NB));
    S.clip(c => { c.fillStyle = C.data; for (let i = 0; i < NB; i++) if (counts[i] > 0) { c.beginPath(); c.arc(S.X(binV(i)), S.Y(counts[i]), r, 0, 7); c.fill(); } });
    S.vline(v, C.red, 2);
    txt(ctx, `pass ${pass}`, S.x + 6, S.y + 16, { w: 600, size: 13, col: C.red });
    const mean = nb ? tot / nb : 0;
    const stat = `${fmt(nEmit)} photons · ${fmt(lastN)} this frame` + (mean > 0 ? ` · noise ±${(100 / Math.sqrt(mean)).toFixed(mean > 400 ? 1 : 0)} %` : "");
    const vs = `v = ${v >= 0 ? "+" : ""}${v.toFixed(2)} mm/s`, es = `  ·  ΔE = ${(v * NEV_PER_MMS).toFixed(0)} neV`;
    ctx.font = `400 12px ${FONT}`; const wv = ctx.measureText(vs).width, we = ctx.measureText(es).width;
    ctx.font = `400 11px ${FONT}`; const ws = ctx.measureText(stat).width, room = S.w - 70 - 18;
    const fitE = wv + we + ws < room, fitS = wv + ws < room;   // drop ΔE first, then move the readout down a row
    txt(ctx, vs + (fitE || (!fitS && !narrow && wv + we < room) ? es : ""), S.x + 70, S.y + 16, { size: 12, col: C.ink });
    if (narrow) txt(ctx, stat, S.x - 50, S.y + S.h + 64, { size: 11, col: C.mute });
    else txt(ctx, stat, S.x + S.w - 6, fitS ? S.y + 16 : S.y + 32, { align: "right", size: 11, col: C.mute });
    legend(ctx, narrow ? S.x - 50 : S.x, narrow ? S.y + S.h + 48 : S.y - 22, [["simulated counts", C.data, "dot"], ["expected", "rgba(128,90,213,.75)", "line"]]);
    d.cv._sim = { NB, counts, expo, pbar, speed, get nEmit() { return nEmit; }, get nDet() { return nDet; }, get nRes() { return nRes; }, get tau() { return tau; }, lastN };
  }, 1.45);
  reset();
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
    txt(ctx, "Velocity along the photon path is v cos θ", 10, 18, { w: 600, size: 13 });
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
    txt(ctx, "Angles of detected photons", H.x, 18, { w: 600, size: 13 });
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
    legend(ctx, Q.x, Q.y + Q.h + 44, [T ? ["α-Fe in transmission (measured)", C.data, "dot"] : ["α-Fe before broadening", "#8a8f87", "line"], ["30 mm back", C.blue, "line"], ["8 mm back", C.purple, "line"], [`only θ = ${th}°`, C.red, "dash"]]);
  }, 1.4);
})();

/* =============== 3-D renderer shared by frames 6 and 9 =============== *
 * Translucent bodies (painter-sorted triangles), black opening ring, rays coloured by their angle to the drive axis.
 * Left-drag rotates, right-drag pans, Ctrl+scroll zooms, double-click resets. It turns slowly until touched. */
const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  basis(n) { const u = V3.norm(V3.cross(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])); return [u, V3.cross(n, u)]; },
};
const HW = {   // body colours, the same on every 3-D figure
  pb: ["#4a5568", 0.16], cap: ["#a0aec0", 0.30], src: [C.src, 0.92], chip: [C.det, 0.92], det: ["#90a4bf", 0.20],
};
function rgbOf(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
// surface of revolution of an (s, r) polyline about axis a through o; s runs along a
function revolve(o, a, prof, closed = true, n = 36) {
  const [u, v] = V3.basis(a), tris = [], rims = [];
  const P = (s, r, f) => V3.add(o, V3.add(V3.mul(a, s), V3.add(V3.mul(u, r * Math.cos(f)), V3.mul(v, r * Math.sin(f)))));
  const ne = closed ? prof.length : prof.length - 1;
  for (let e = 0; e < ne; e++) {
    const [s0, r0] = prof[e], [s1, r1] = prof[(e + 1) % prof.length];
    for (let k = 0; k < n; k++) {
      const f0 = 2 * Math.PI * k / n, f1 = 2 * Math.PI * (k + 1) / n;
      const A = P(s0, r0, f0), B = P(s0, r0, f1), Cc = P(s1, r1, f1), D = P(s1, r1, f0);
      if (r0 > 1e-6) tris.push([A, B, Cc]);
      if (r1 > 1e-6) tris.push([A, Cc, D]);
    }
  }
  return { tris, rims };
}
function edgesOf(tris, deg = 30) {   // crease + boundary edges: the outline a CAD viewer draws
  const key = p => p.map(x => x.toFixed(2)).join(","), E = new Map(), cmax = Math.cos(deg * Math.PI / 180);
  for (const t of tris) {
    const nrm = V3.norm(V3.cross(V3.sub(t[1], t[0]), V3.sub(t[2], t[0])));
    for (let i = 0; i < 3; i++) {
      const a = t[i], b = t[(i + 1) % 3], ka = key(a), kb = key(b), k = ka < kb ? ka + "|" + kb : kb + "|" + ka;
      const e = E.get(k); if (e) e.n.push(nrm); else E.set(k, { a, b, n: [nrm] });
    }
  }
  const out = [];
  for (const e of E.values()) if (e.n.length === 1 || Math.abs(V3.dot(e.n[0], e.n[1])) < cmax) out.push([e.a, e.b]);
  return out;
}
function mkBody(tris, [col, op]) {
  const c = [0, 0, 0]; for (const t of tris) for (const p of t) for (let i = 0; i < 3; i++) c[i] += p[i] / (3 * tris.length);
  return { tris, edges: edgesOf(tris), col, op, c };
}
function body(geo, hw) { return mkBody(geo.tris, hw); }
function circle(c, n, r, k = 72) { const [u, v] = V3.basis(n); return grid(0, 2 * Math.PI, k).map(f => V3.add(c, V3.add(V3.mul(u, r * Math.cos(f)), V3.mul(v, r * Math.sin(f))))); }

function orbit(cv, home) {   // camera state + mouse handling for one canvas
  const st = { yaw: home.yaw, pitch: home.pitch, zoom: 1, pan: [0, 0], drag: null, touched: false };
  cv.addEventListener("contextmenu", e => e.preventDefault());
  cv.addEventListener("pointerdown", e => { st.drag = [e.clientX, e.clientY, st.yaw, st.pitch, st.pan[0], st.pan[1], e.button]; st.touched = true; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => {
    const g = st.drag; if (!g) return;
    if (g[6] === 2 || e.shiftKey) st.pan = [g[4] + e.clientX - g[0], g[5] + e.clientY - g[1]];
    else { st.yaw = g[2] + (e.clientX - g[0]) * 0.01; st.pitch = Math.max(-1.4, Math.min(1.4, g[3] + (e.clientY - g[1]) * 0.01)); }
  });
  cv.addEventListener("pointerup", () => { st.drag = null; });
  cv.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); st.zoom = Math.max(0.5, Math.min(4, st.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
  cv.addEventListener("dblclick", () => Object.assign(st, { yaw: home.yaw, pitch: home.pitch, zoom: 1, pan: [0, 0], touched: false }));
  return st;
}
// draw one scene into the viewport vp = {x, y, w, h}; scene = {ctr, span, bodies, lines, rays, sampleZ, labels}
function render3d(ctx, vp, st, sc) {
  const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
  const scl = Math.min(vp.w, vp.h) / sc.span * st.zoom, cx0 = vp.x + vp.w / 2 + st.pan[0], cy0 = vp.y + vp.h / 2 + st.pan[1];
  const rot = p => { const x = p[0] - sc.ctr[0], y = p[1] - sc.ctr[1], z = p[2] - sc.ctr[2];
    const x1 = cy * x - sy * y, y1 = sy * x + cy * y; return [x1, cp * y1 - sp * z, sp * y1 + cp * z]; };
  const pr = q => { const s = 160 / (160 + q[1]); return [cx0 + scl * q[0] * s, cy0 - scl * q[2] * s]; };
  ctx.save(); ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
  // sample plate with a 5 mm grid, always underneath
  const L = sc.plate || 28, z = sc.sampleZ, X = sc.ctr[0];
  const plate = [[X - L, -L, z], [X + L, -L, z], [X + L, L, z], [X - L, L, z]].map(p => pr(rot(p)));
  ctx.fillStyle = "rgba(139,94,60,.13)"; ctx.beginPath(); plate.forEach((q, i) => i ? ctx.lineTo(...q) : ctx.moveTo(...q)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(139,94,60,.16)"; ctx.lineWidth = 0.7; ctx.beginPath();
  for (let g = -L; g <= L + 1e-6; g += 5) {
    ctx.moveTo(...pr(rot([X + g, -L, z]))); ctx.lineTo(...pr(rot([X + g, L, z])));
    ctx.moveTo(...pr(rot([X - L, g, z]))); ctx.lineTo(...pr(rot([X + L, g, z])));
  }
  ctx.stroke();
  // bodies far to near: one translucent fill each (triangles wound the same way, so they union) + crease edges
  const drawBody = bd => {
    const rgb = rgbOf(bd.col).join(","); ctx.beginPath();
    for (const t of bd.tris) {
      let A = pr(rot(t[0])), B = pr(rot(t[1])), Q = pr(rot(t[2]));
      if ((B[0] - A[0]) * (Q[1] - A[1]) - (B[1] - A[1]) * (Q[0] - A[0]) < 0) { const x = B; B = Q; Q = x; }
      ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(Q[0], Q[1]); ctx.closePath();
    }
    ctx.fillStyle = `rgba(${rgb},${bd.op})`; ctx.fill("nonzero");
    ctx.beginPath(); for (const [p, q] of bd.edges) { ctx.moveTo(...pr(rot(p))); ctx.lineTo(...pr(rot(q))); }
    ctx.strokeStyle = `rgba(${rgb},${Math.min(0.9, bd.op * 2 + 0.25)})`; ctx.lineWidth = 0.8; ctx.stroke();
  };
  const bs = sc.bodies.map(bd => ({ bd, d: rot(bd.c)[1] })).sort((p, q) => q.d - p.d);
  for (const { bd, d } of bs) if (d > 0) drawBody(bd);
  for (const r of sc.rays) {
    ctx.strokeStyle = r.blocked ? "rgba(150,150,150,.4)" : thetaCol(r.th); ctx.globalAlpha = r.blocked ? 1 : 0.6; ctx.lineWidth = 0.9;
    ctx.beginPath(); r.pts.forEach((p, i) => { const q = pr(rot(p)); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const l of sc.lines || []) { ctx.strokeStyle = l.col; ctx.lineWidth = l.lw; ctx.beginPath(); l.pts.forEach((p, i) => { const q = pr(rot(p)); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.stroke(); }
  for (const { bd, d } of bs) if (d <= 0) drawBody(bd);
  for (const [p, s, col] of sc.labels || []) { const q = pr(rot(p)); txt(ctx, s, q[0] + 8, q[1] - 6, { size: 11.5, w: 700, col, halo: true }); }
  ctx.restore();
}
function legend3d(ctx, x, y, maxW) {   // one key for every 3-D figure on the page
  const items = [["⁵⁷Co active area", HW.src[0], "patch"], ["source capsule", HW.cap[0], "patch"], ["Pb collimator", HW.pb[0], "patch"],
    ["limiting opening", C.ink, "line"], ["detector chip", HW.chip[0], "patch"], ["detector housing", HW.det[0], "patch"]];
  let X = x, Y = y; ctx.font = `400 11px ${FONT}`;
  for (const [lab, col, kind] of items) {
    const wd = 34 + ctx.measureText(lab).width;
    if (X + wd > x + maxW) { X = x; Y += 17; }
    if (kind === "patch") { ctx.fillStyle = col; ctx.globalAlpha = 0.55; ctx.fillRect(X, Y - 10, 14, 10); ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(X, Y - 10, 14, 10); }
    else { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X, Y - 5); ctx.lineTo(X + 14, Y - 5); ctx.stroke(); }
    txt(ctx, lab, X + 19, Y, { size: 11 }); X += wd;
  }
  return Y;
}
function thetaBar(ctx, x, y, w) {   // the ray colour key: blue at 0 deg to purple at 25 deg
  for (let i = 0; i < w; i++) { ctx.fillStyle = thetaCol(25 * i / w); ctx.fillRect(x + i, y - 9, 1, 8); }
  txt(ctx, "0°", x, y + 11, { size: 10.5, col: C.mute }); txt(ctx, "25°", x + w, y + 11, { size: 10.5, col: C.mute, align: "right" });
  txt(ctx, "ray angle to the drive axis", x + w + 8, y - 1, { size: 11 });
}

/* =============== FRAME 6: our heads: the photo and the 3-D model =============== */
(function () {
  if (!document.getElementById("f6a")) return;
  let head = "fe_8mm";
  const imgs = {};
  for (const k in SB.photos) { const im = new Image(); im.src = SB.photos[k].img; imgs[k] = im; }
  seg("f6-head", [["fe_8mm", "α-Fe run, Sep 2026"], ["hem", "hematite run, Nov 2026"]], v => { head = v; build(); }, "fe_8mm");
  let sc = null, G = null;
  function build() {   // the real MC geometry + the ver2 hardware around it (Pb tube, capsule, H50 cap)
    const { add, sub, mul, dot, norm } = V3;
    const c = SB.kernels[head].config, S = c.source_pos, F = c.focus_point || [0, 0, 0];
    const n = norm(sub(F, S)), [u, v] = V3.basis(n), zs = c.sample_offset || 0;
    const stand = c.aperture_standoff != null ? c.aperture_standoff : Math.hypot(...sub(F, S)) - c.aperture_wd;
    const A = add(S, mul(n, stand)), D = c.detectors[0].pos, dn = norm(sub(F, D)), ap = c.aperture_diameter / 2;
    const src = c.source_diameter / 2, det = (c.detector_diameter || 7.7) / 2, back = mul(n, -1);
    G = { S, A, D, n, src, ap, det, zs, stand };
    const bodies = [
      body(revolve(A, back, [[0, 8], [24, 8], [24, 10], [0, 10]]), HW.pb),            // Pb tube, bore Ø16, OD 20 x 24
      body(revolve(A, back, [[0, ap], [2, ap], [2, 8], [0, 8]]), HW.pb),               // 2 mm Pb plate with the opening
      body(revolve(S, back, [[-0.5, 4], [0, 4], [0, 7], [-0.5, 7]]), HW.cap),          // capsule lip
      body(revolve(S, back, [[0, 0], [5.5, 0], [5.5, 7], [0, 7]]), HW.cap),            // capsule Ø14 x 6
      body(revolve(S, back, [[5.5, 0], [13.5, 0], [13.5, 3], [5.5, 3]]), HW.cap),      // stem Ø6 x 8
      body(revolve(add(S, mul(n, 0.05)), n, [[0, 0], [0, src]], false), HW.src),          // the 57Co active area
      body(revolve(D, dn, [[0, 0], [0, det]], false), HW.chip),                         // detector chip
      body(revolve(add(D, mul(dn, 1.75)), mul(dn, -1), [[0, 0], [9, 0], [9, 7], [0, 7]]), HW.det),   // H50 cap Ø14 x 9
    ];
    const rays = []; seed = 99;
    for (let k = 0; rays.length < 300 && k < 60000; k++) {
      const rr = src * Math.sqrt(rnd()), ph = 2 * Math.PI * rnd();
      const P = add(S, add(mul(u, rr * Math.cos(ph)), mul(v, rr * Math.sin(ph))));
      const ct = 1 - rnd() * (1 - Math.cos(35 * Math.PI / 180)), sn = Math.sqrt(1 - ct * ct), p2 = 2 * Math.PI * rnd();
      const dir = add(mul(n, ct), add(mul(u, sn * Math.cos(p2)), mul(v, sn * Math.sin(p2))));
      const Q = add(P, mul(dir, dot(sub(A, P), n) / dot(dir, n)));
      const t2 = (zs - P[2]) / dir[2]; if (t2 <= 0) continue;
      const th = Math.acos(ct) * 180 / Math.PI;
      if (Math.hypot(...sub(Q, A)) > ap) { if (rays.length % 5 === 0) rays.push({ pts: [P, Q], th, blocked: true }); continue; }
      rays.push({ pts: [P, add(P, mul(dir, t2))], th });
    }
    const axis = { pts: [add(S, mul(n, -22)), add(S, mul(n, stand + 14))], col: C.mute, lw: 0.8 };
    sc = { ctr: [(S[0] + D[0]) / 2, 0, (S[2] + zs) / 2 + 2], span: 66, sampleZ: zs, bodies, rays,
           lines: [{ pts: circle(A, n, ap), col: C.ink, lw: 2.2 }, axis],
           labels: [[add(S, mul(n, -15)), "source on drive", C.src], [add(D, mul(dn, -11)), "detector", C.det], [[sc0x(S, D) + 18, -18, zs], "sample", C.sample]] };
  }
  const sc0x = (S, D) => (S[0] + D[0]) / 2;
  build();
  // photo + the annotator's own MC ray paths
  canvas("f6a", 0.82, (d) => {
    const { ctx, w, h, t } = d, Ph = SB.photos[head], im = imgs[head];
    const s = Math.min(w / Ph.size[0], h / Ph.size[1]), ox = (w - Ph.size[0] * s) / 2, oy = (h - Ph.size[1] * s) / 2;
    if (im.complete && im.naturalWidth) ctx.drawImage(im, ox, oy, Ph.size[0] * s, Ph.size[1] * s);
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(ox, oy, Ph.size[0] * s, Ph.size[1] * s);
    const X = p => [ox + p[0] * s, oy + p[1] * s];
    ctx.lineWidth = 0.8;
    for (const p of Ph.lost.slice(0, 120)) { ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.beginPath(); ctx.moveTo(...X(p[0])); ctx.lineTo(...X(p[1])); ctx.stroke(); }
    for (const p of Ph.detected) { ctx.strokeStyle = "rgba(128,90,213,.28)"; ctx.beginPath(); ctx.moveTo(...X(p[0])); ctx.lineTo(...X(p[1])); ctx.lineTo(...X(p[2])); ctx.stroke(); }
    for (let i = 0; i < 26; i++) {   // photons in flight along detected paths
      const p = Ph.detected[(i * 37 + Math.floor(t / 1.4 + i / 26) * 11) % Ph.detected.length], k = ((t / 1.4 + i / 26) % 1);
      const a = k < 0.5 ? X(p[0]) : X(p[1]), b = k < 0.5 ? X(p[1]) : X(p[2]), f = (k % 0.5) / 0.5;
      ctx.fillStyle = k < 0.5 ? C.src : C.purple; ctx.beginPath(); ctx.arc(a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), 3, 0, 7); ctx.fill();
    }
    const mean = j => [0, 1].map(c => Ph.detected.reduce((q, p) => q + p[j][c], 0) / Ph.detected.length);
    for (const [j, lab, col] of [[0, "source", C.src], [1, "sample", C.sample], [2, "detector", C.det]]) {
      const [x, y] = X(mean(j)); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
      txt(ctx, lab, x + 8, y - 6, { size: 12, w: 700, col, halo: true });
    }
    legend(ctx, 8, h - 26, [["leaving the source", C.src, "dot"], ["sample to detector", C.purple, "line"], ["missed the detector", "#9a9a9a", "line"]]);
    txt(ctx, `${Ph.mc.n_det} detected of ${(Ph.mc.n_launched / 1e6).toFixed(0)} M launched`, 8, h - 8, { size: 11, w: 600, halo: true });
  }, 0.95);
  // 3-D model of the same head
  const cv3 = document.getElementById("f6b"), cam = orbit(cv3, { yaw: -0.75, pitch: 0.35 });
  canvas("f6b", 0.6, (d, dt) => {
    const { ctx, w, h } = d;
    if (!cam.drag && !cam.touched) cam.yaw += dt * 0.12;
    const top = 22, keyH = w < 520 ? 70 : 52;
    render3d(ctx, { x: 0, y: top, w, h: h - top - keyH }, cam, sc);
    txt(ctx, "drag to rotate · right-drag to pan · Ctrl+scroll to zoom · double-click to reset", 40, 14, { size: 11, col: C.mute });
    const y = legend3d(ctx, 8, h - keyH + 16, w - 16);
    thetaBar(ctx, 8, y + 22, 90);
    const K = SB.kernels[head];
    txt(ctx, `mean θ ${K.theta_mean}° · stretch ${K.stretch_pct}%`, w - 8, y + 21, { size: 11, w: 600, align: "right" });
  }, 1.15);
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
    ...MIN.slice(2).map(m => ({ k: m.k, name: m.name + " (published parameters)", ph: m.ph })),
  ] : MIN.map(m => ({ k: m.k, name: m.name + " (published parameters)", ph: m.ph }));
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
    const rows = SYS.map((s, i) => { const st = stats(s, head); return `<tr class="${i === sys ? "on" : ""}"><td>${SB.transmission ? s.name : s.name.replace(" (published parameters)", "")}</td><td>${st.v0.toFixed(2)}</td><td>${st.shift.toFixed(3)}</td><td>${(st.shift / LW).toFixed(2)}</td><td>${st.spread.toFixed(3)}</td></tr>`; });
    document.getElementById("f8-table").innerHTML = `<div class="tablewrap"><table class="mini"><thead><tr><th>Sample</th><th>Outermost line (mm/s)</th><th>Shift (mm/s)</th><th>Shift in line widths</th><th>Added spread (mm/s)</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }
  table();
  canvas("f8", 0.46, (d) => {
    const { ctx, w, h } = d, s = SYS[sys], f = fnOf(s), g = smear(f, kernelOf(head));
    const xs = grid(-11, 11, 800), ys = xs.map(f), ysm = xs.map(g);
    const P = new Plot(ctx, 60, 44, w - 80, h - 110, [-11, 11], [Math.min(...ys) - 0.01, 1.01]);
    P.frame({ energy: true, yticks: true, ny: 3, ylabel: "transmission", yfmt: t => t.toFixed(2), xlabel: "source velocity (mm/s)" });
    txt(ctx, `${s.name} · ${HNAME[head]}`, P.x, 14, { w: 600, size: 13 });
    if (s.meas) P.dots(s.meas.v, s.meas.y, C.blue, 1.8); else P.line(xs, ys, C.blue, 1.8);
    P.line(xs, ysm, C.purple, 2.2);
    const st = stats(s, head);
    legend(ctx, P.x + 6, P.y + P.h - 10, [[s.meas ? "transmission (measured)" : "transmission (model)", C.blue, s.meas ? "dot" : "line"], ["after simulated broadening", C.purple, "line"]]);
    txt(ctx, `Outermost line shifts ${st.shift.toFixed(3)} mm/s (${(st.shift / LW).toFixed(2)} line widths)`, P.x + P.w - 6, P.y + P.h - 10, { align: "right", size: 12, w: 600, col: C.purple });
  }, 0.9);
})();

/* =============== frames drawn from the design study (assets/data/mc.json) =============== */
const MCJ = (() => {
  if (!["fk", "fc", "f9", "f10"].some(id => document.getElementById(id))) return null;
  const el = document.querySelector("script[data-mc]");
  return fetch(el ? el.dataset.mc : "assets/data/mc.json").then(r => r.json());
})();
const VER = {   // one colour per design, used on the 3-D panels, the spectra and the number cards
  ver1: { name: "ver1 · original drawing", col: C.red }, ver2: { name: "ver2 · as built (in use)", col: C.purple },
  ver3pb: { name: "ver3 · source 12.1 mm back", col: C.ink },
};

/* FRAME K: detected-photon angles -> the smearing kernel */
MCJ && MCJ.then(D => {
  if (!document.getElementById("fk")) return;
  const P = D.pipe, mid = [], tot = P.counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < P.counts.length; i++) mid.push(0.5 * (P.edges[i] + P.edges[i + 1]));
  const share = P.counts.map(c => 100 * c / tot);
  // kernel rows rebuilt from (cos theta, weight), as kernel_matrix() does in Python; checked against its row at 8.5 mm/s
  const n = P.v[2], v0 = P.v[0], dv = (P.v[1] - P.v[0]) / (n - 1), v = grid(P.v[0], P.v[1], n), cs = [], qs = [];
  P.counts.forEach((c, m) => { if (c > 0) { cs.push(Math.cos(mid[m] * Math.PI / 180)); qs.push(c / tot); } });
  const K = v.map(vi => { const row = new Float64Array(n);
    cs.forEach((c, m) => { const x = c * vi; if (x < v[0] || x > v[n - 1]) return;
      const j = Math.min(Math.max(Math.floor((x - v0) / dv), 0), n - 2), t = Math.min(Math.max((x - v[j]) / dv, 0), 1);
      row[j] += qs[m] * (1 - t); row[j + 1] += qs[m] * t; });
    return row; });
  let i85 = 0; v.forEach((x, i) => { if (Math.abs(x - 8.5) < Math.abs(v[i85] - 8.5)) i85 = i; });
  let err = 0; K[i85].forEach((x, j) => { err = Math.max(err, Math.abs(x - P.k_row_8p5[j])); });
  document.getElementById("fk").dataset.check = err.toExponential(1);
  const ramp = t => { const a = [255, 255, 255], b = [0x55, 0x3c, 0x9a]; return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`; };
  canvas("fk", 0.44, (d) => {
    const { ctx, w, h } = d, narrow = w < 640;
    const pw = narrow ? w - 80 : (w - 150) / 2, ph = narrow ? (h - 150) / 2 : h - 90;
    // angle histogram, bars in the ray colours
    const H = new Plot(ctx, 60, 36, pw, ph, [0, 25], [0, Math.max(...share) * 1.12]);
    H.frame({ xlabel: "θ, angle from the source axis (deg)", nx: 5, zero: false, yticks: true, ny: 4, ylabel: "share of detected photons (%)" });
    txt(ctx, `Angles of ${P.n.toLocaleString("en-US")} detected photons`, H.x, 18, { w: 600, size: 13 });
    H.clip(c => share.forEach((s, i) => { c.fillStyle = thetaCol(mid[i]); const x0 = H.X(P.edges[i]), x1 = H.X(P.edges[i + 1]); c.fillRect(x0, H.Y(s), Math.max(1, x1 - x0 - 0.5), H.Y(0) - H.Y(s)); }));
    H.vline(P.mean_deg, C.ink, 1.3, [5, 4]);
    txt(ctx, `mean ${P.mean_deg.toFixed(1)}°`, H.X(P.mean_deg) + 5, H.y + 14, { size: 11.5, w: 600 });
    txt(ctx, `stretch ⟨1/cos θ⟩ − 1 = ${P.stretch.toFixed(2)}%`, H.x + H.w - 6, H.y + 32, { size: 11.5, align: "right", col: C.purple, w: 600 });
    // kernel matrix, zoomed on the outer lines
    const kx = narrow ? 60 : 60 + pw + 90, ky = narrow ? 36 + ph + 80 : 36, side = Math.min(pw, ph);
    const M = new Plot(ctx, kx, ky, side, side, [7, 10], [7, 10]);
    const i0 = v.findIndex(x => x >= 7) , i1 = v.findIndex(x => x > 10);
    M.clip(c => { for (let i = i0; i < i1; i++) for (let j = i0; j < i1; j++) { const z = K[i][j]; if (z <= 0) continue;
      c.fillStyle = ramp(Math.min(1, Math.sqrt(z) / 0.55)); c.fillRect(M.X(v[i] - dv / 2), M.Y(v[j] + dv / 2), M.X(v[i] + dv / 2) - M.X(v[i] - dv / 2) + 0.6, M.Y(v[j] - dv / 2) - M.Y(v[j] + dv / 2) + 0.6); } });
    M.line([7, 10], [7, 10], C.blue, 1.4, [3, 3]);
    M.frame({ xlabel: "true line position (mm/s)", nx: 3, zero: false, yticks: true, ny: 3, ylabel: "recorded velocity (mm/s)" });
    txt(ctx, "The kernel: where each line is recorded", M.x, ky - 18, { w: 600, size: 13 });
    legend(ctx, M.x + 6, M.y + 16, [["no broadening (θ = 0)", C.blue, "dash"]]);
    const kx2 = M.x + M.w + 10; if (kx2 + 40 < w) { for (let i = 0; i < 100; i++) { ctx.fillStyle = ramp(i / 99); ctx.fillRect(kx2, M.y + M.h - i * M.h / 100 - M.h / 100, 9, M.h / 100 + 1); }
      txt(ctx, "√weight", kx2 + 13, M.y + 10, { size: 10.5, col: C.mute }); }
  }, 1.45);
});

/* FRAME C: four mineral pairs with and without our head's broadening */
MCJ && MCJ.then(D => {
  if (!document.getElementById("fc")) return;
  const T = D.teach, NICE = { "np-oxide": "nanophase oxide" }, COLM = Object.fromEntries(MIN.map(m => [m.name, m.col]));
  const nm = k => NICE[k] || k;
  const tb = document.getElementById("mc-cases-table");
  if (tb) tb.innerHTML = T.cases.map(c => `<tr><td>${nm(c.a)} + ${nm(c.b)}</td>` + c.rows.slice(0, 2).map(r =>
    `<td>×${r.time.toFixed(2)} · ${Math.round(100 * Math.min(r.sep, 1))} %</td>`).join("") + "</tr>").join("");
  canvas("fc", 0.62, (d) => {
    const { ctx, w, h } = d, cols = w < 640 ? 1 : 2, rows = Math.ceil(T.cases.length / cols);
    const cw = (w - 30) / cols, chh = (h - 40) / rows;
    T.cases.forEach((c, i) => {
      const cx = 20 + (i % cols) * cw, cy = 26 + Math.floor(i / cols) * chh, sext = c.a === "hematite";
      const xr = sext ? [-10.5, 10.5] : [-1.6, 3.4];
      const all = [...c.y0, ...c.y_ours], P = new Plot(ctx, cx + 6, cy + 20, cw - 26, chh - 66, xr, [0, Math.max(...all) * 1.08]);
      P.frame({ xlabel: "source velocity (mm/s)", nx: sext ? 6 : 5 });
      P.clip(cc => [[c.ya, COLM[c.a] || C.mute], [c.yb, COLM[c.b] || C.mute]].forEach(([y, col]) => {
        cc.fillStyle = col; cc.globalAlpha = 0.14; cc.beginPath(); cc.moveTo(P.X(T.v[0]), P.Y(0));
        T.v.forEach((x, k) => cc.lineTo(P.X(x), P.Y(y[k]))); cc.lineTo(P.X(T.v[T.v.length - 1]), P.Y(0)); cc.closePath(); cc.fill(); cc.globalAlpha = 1; }));
      P.line(T.v, c.y0, C.blue, 1.8); P.line(T.v, c.y_ours, C.purple, 2);
      const o = c.rows[0], far = c.rows[1];
      txt(ctx, `${nm(c.a)} + ${nm(c.b)}`, P.x, cy + 8, { w: 700, size: 12.5 });
      txt(ctx, `time ×${o.time.toFixed(2)} ours · ×${far.time.toFixed(1)} at 8 mm`, P.x + P.w, cy + 8, { size: 11.5, align: "right", col: C.purple, w: 600 });
    });
    legend(ctx, 26, h - 6, [["mixture before broadening", C.blue, "line"], ["what our head records (1.8% stretch)", C.purple, "line"]]);
  }, 1.9);
});

/* FRAME 9: ver1, ver2, ver3 in 3-D, one camera, same scale */
MCJ && MCJ.then(D => {
  if (!document.getElementById("f9")) return;
  const { sub, norm, dot, cross } = V3;
  function sceneOf(traces) {   // the design study's own bodies and detected rays
    const bodies = [], lines = [], rays = []; let S = [0, 0, 0], n = [0, 0, -1], chip = [0, 0, 0];
    for (const t of traces) {
      const nmT = t.name || "";
      if (t.type === "mesh3d") {
        if (/sample plane|other STEP/.test(nmT)) continue;
        const P = t.x.map((x, i) => [x, t.y[i], t.z[i]]), tris = t.i.map((a, k) => [P[a], P[t.j[k]], P[t.k[k]]]);
        let hw = HW.pb;
        if (/source: active/.test(nmT)) { hw = HW.src; S = P[0]; n = norm(cross(sub(P[48], P[0]), sub(P[49], P[0]))); if (n[2] > 0) n = n.map(x => -x); }
        else if (/capsule/i.test(nmT)) hw = HW.cap;
        else if (/chip/.test(nmT)) { hw = HW.chip; chip = P[0]; }
        else if (/cap|Part 1/.test(nmT)) hw = HW.det;
        bodies.push(mkBody(tris, hw));
      } else if (/limiting opening/.test(nmT)) {
        lines.push({ pts: t.x.map((x, i) => [x, t.y[i], t.z[i]]).filter(p => p[0] != null), col: C.ink, lw: 2.2 });
      } else if (/detected rays/.test(nmT)) {
        let cur = [];
        t.x.forEach((x, i) => { if (x == null) { if (cur.length > 1) rays.push({ pts: cur }); cur = []; } else cur.push([x, t.y[i], t.z[i]]); });
        if (cur.length > 1) rays.push({ pts: cur });
      }
    }
    for (const r of rays) r.th = Math.acos(Math.min(1, Math.abs(dot(norm(sub(r.pts[1], r.pts[0])), n)))) * 180 / Math.PI;
    return { ctr: [(S[0] + chip[0]) / 2, 0, Math.max(S[2], chip[2]) / 2 + 3], span: 74, sampleZ: 0, plate: 26, bodies, lines, rays };
  }
  const KEYS = ["ver1", "ver2", "ver3pb"], SC = KEYS.map(k => sceneOf(D.heads[k]));
  const cv = document.getElementById("f9"), cam = orbit(cv, { yaw: -1.2, pitch: 0.3 });
  canvas("f9", 0.42, (d, dt) => {
    const { ctx, w, h } = d, stack = w < 640, keyH = stack ? 74 : 54, top = 22;
    if (!cam.drag && !cam.touched) cam.yaw += dt * 0.1;
    txt(ctx, "one camera for all three · drag to rotate · right-drag to pan · Ctrl+scroll to zoom", 8, 14, { size: 11, col: C.mute });
    KEYS.forEach((k, i) => {
      const vp = stack ? { x: 0, y: top + i * (h - top - keyH) / 3, w, h: (h - top - keyH) / 3 } : { x: i * w / 3, y: top + 18, w: w / 3, h: h - top - keyH - 18 };
      render3d(ctx, vp, cam, SC[i]);
      const N = D.num[k];
      txt(ctx, VER[k].name, vp.x + (stack ? 8 : vp.w / 2), vp.y + (stack ? 16 : -2), { w: 700, size: 12.5, col: VER[k].col, align: stack ? "left" : "center" });
      txt(ctx, `${N.x_ver2.toFixed(1)}× counts · stretch ${N.smear.toFixed(1)}%`, vp.x + (stack ? 8 : vp.w / 2), vp.y + (stack ? 32 : 14), { size: 11, col: C.mute, align: stack ? "left" : "center" });
    });
    const y = legend3d(ctx, 8, h - keyH + 16, w - 16);
    thetaBar(ctx, 8, y + 22, 90);
  }, 1.9);
});

/* FRAME 10: a hematite spectrum through each design */
MCJ && MCJ.then(D => {
  if (!document.getElementById("f10")) return;
  const S = D.spec, KEYS = ["ver1", "ver2", "ver3pb"];
  canvas("f10", 0.4, (d) => {
    const { ctx, w, h } = d, narrow = w < 640;
    const fw = narrow ? w - 80 : (w - 120) * 0.62, zw = narrow ? w - 80 : (w - 120) * 0.38 - 20, ph = narrow ? (h - 170) / 2 : h - 100;
    const Fp = new Plot(ctx, 56, 44, fw, ph, [-11, 11], [0, 1.05]);
    const Zp = new Plot(ctx, narrow ? 56 : 56 + fw + 60, narrow ? 44 + ph + 80 : 44, zw, ph, [7.8, 10.2], [0, 1.05]);
    Fp.clip(c => { c.fillStyle = "rgba(107,114,128,.10)"; c.fillRect(Fp.X(7.8), Fp.y, Fp.X(10.2) - Fp.X(7.8), Fp.h); });
    for (const P of [Fp, Zp]) {
      P.frame({ xlabel: "source velocity (mm/s)", nx: P === Fp ? 8 : 4, yticks: P === Fp, ny: 4, ylabel: P === Fp ? "emission (line 6 = 1)" : undefined, yfmt: t => t.toFixed(1) });
      P.clip(c => { c.fillStyle = "rgba(43,108,176,.10)"; c.beginPath(); c.moveTo(P.X(S.v[0]), P.Y(0)); S.v.forEach((x, k) => c.lineTo(P.X(x), P.Y(S.expected[k]))); c.lineTo(P.X(S.v[S.v.length - 1]), P.Y(0)); c.closePath(); c.fill(); });
      P.line(S.v, S.expected, C.blue, 1.4);
      KEYS.forEach(k => P.line(S.v, S[k], VER[k].col, k === "ver2" ? 3 : 1.8, k === "ver3pb" ? [5, 4] : null));
    }
    txt(ctx, "Hematite through each design", Fp.x, 18, { w: 600, size: 13 });
    txt(ctx, "line 6, enlarged", Zp.x, Zp.y - 22, { w: 600, size: 13 });
    legend(ctx, Fp.x, h - 8, [["input sextet", C.blue, "line"], ["ver1", C.red, "line"], ["ver2 (in use)", C.purple, "line"], ["ver3, source moved back", C.ink, "dash"]]);
  }, 1.3);
});

requestAnimationFrame(loop);
})();
