/* sinrg.js - the three figures instrument.html adds on top of mc-story.js (which supplies f3, f4, f5, f9).
   fx: what one detector sees from each source (two panels, shared energy axis). fm: mineral pairs XRF can't separate.
   fd: sampling depth of the 14.4 keV and 6.4 keV signals (three rocks side by side, shared depth axis).
   Line energies: python -m nucdata table xray / probes Fe (utilities/nucdata). Mineral parameters: Morris et al. 2006a,
   10.1029/2005JE002584 (Mars temperatures). Depths: sinrg/factsheet/build/D_info_depth.py (model, our head's angles). */
"use strict";
(function () {
const C = { ink: "#1E211D", mute: "#4A4F48", faint: "#c9c7bf", grid: "#e8e6df", teal: "#2c7a7b", purple: "#7b3294",
  red: "#b7472a", gold: "#b7791f", blue: "#2b6cb0", green: "#38a169" };
const FONT = "'IBM Plex Sans', system-ui, sans-serif";
const draws = [];
function fig(id, aspect, mobileAspect, draw) {
  const cv = document.getElementById(id); if (!cv) return null;
  const d = { cv, draw, aspect, mobileAspect, mode: 0 };
  d.redraw = () => {
    const w = cv.clientWidth; if (!w) return;
    const h = Math.round(w * (w < 640 ? mobileAspect : aspect)), dpr = window.devicePixelRatio || 1;
    cv.style.height = h + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h, d.mode);
  };
  draws.push(d); return d;
}
function seg(id, labels, d) {
  const el = document.getElementById(id); if (!el) return;
  labels.forEach((lab, i) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = lab;
    if (i === 0) b.classList.add("on");
    b.onclick = () => { [...el.children].forEach(x => x.classList.toggle("on", x === b)); d.mode = i; d.redraw(); };
    el.appendChild(b);
  });
}
function txt(ctx, s, x, y, o = {}) {
  ctx.font = `${o.w || 400} ${o.size || 12}px ${FONT}`; ctx.fillStyle = o.col || C.ink;
  ctx.textAlign = o.align || "left"; ctx.textBaseline = o.base || "alphabetic"; ctx.fillText(s, x, y);
}
function badge(ctx, s, x, y) {
  ctx.font = `600 9.5px ${FONT}`; const w = ctx.measureText(s).width + 10;
  ctx.fillStyle = "#ebe8df"; ctx.fillRect(x - w, y - 11, w, 15); txt(ctx, s, x - 5, y, { size: 9.5, w: 600, col: C.mute, align: "right" });
}
function axisX(ctx, x0, x1, y, lo, hi, ticks, label) {
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  const X = v => x0 + (v - lo) / (hi - lo) * (x1 - x0);
  ticks.forEach(t => { ctx.beginPath(); ctx.moveTo(X(t), y); ctx.lineTo(X(t), y + 4); ctx.stroke(); txt(ctx, String(t), X(t), y + 16, { size: 11, align: "center", col: C.mute }); });
  txt(ctx, label, (x0 + x1) / 2, y + 32, { size: 12, align: "center", col: C.mute });
  return X;
}

/* ---------- fx: one detector, two kinds of signal (two panels on one energy axis, no toggle) ---------- */
// Ka / Kb energies in keV (nucdata xray table); 14.413 keV = 57Fe Mossbauer gamma (nucdata probes Fe)
const LINES = { K: [3.314, 3.590], Ca: [3.692, 4.013], Ti: [4.512, 4.933], Mn: [5.900, 6.492], Fe: [6.405, 7.059], Ni: [7.480, 8.267], Sr: [14.165, 15.835], Zr: [15.775, 17.668] };
const XRF_H = { K: 0.18, Ca: 0.55, Ti: 0.22, Mn: 0.08, Fe: 1.0, Ni: 0.05, Sr: 0.12, Zr: 0.09 };   // illustrative basalt
const fx = fig("fx", 0.6, 1.15, (ctx, w, h) => {
  const L = 16, R = w - 16, lo = 2, hi = 18, top = 30, bot = h - 46, gap = 40, ph = (bot - top - gap) / 2;
  const X = v => L + (v - lo) / (hi - lo) * (R - L);
  [0, 1].forEach(mode => {
    const T = top + mode * (ph + gap), B = T + ph, peaks = [];
    if (mode === 0) for (const el in LINES) { peaks.push([LINES[el][0], XRF_H[el], el === "Fe" ? C.red : C.teal, el]); peaks.push([LINES[el][1], XRF_H[el] * 0.15, el === "Fe" ? C.red : C.teal, null]); }
    else { peaks.push([14.413, 1.0, C.purple, "14.4 keV γ (Mössbauer)"]); peaks.push([LINES.Fe[0], 0.42, C.red, "Fe Kα 6.4 keV"]); peaks.push([LINES.Fe[1], 0.07, C.red, null]); }
    if (mode === 1) [[5.9, 6.9, C.red], [13.7, 15.1, C.purple]].forEach(([a, b, c]) => { ctx.fillStyle = c; ctx.globalAlpha = 0.08; ctx.fillRect(X(a), T + 6, X(b) - X(a), B - T - 6); ctx.globalAlpha = 1; });
    if (mode === 1) txt(ctx, "counted windows", X(10.3), B - 8, { size: 11, col: C.mute, align: "center" });
    const Y = v => B - v * (B - T - 26);
    const spec = e => peaks.reduce((s, [e0, a]) => { const sg = 0.055 * Math.sqrt(e0); return s + a * Math.exp(-0.5 * ((e - e0) / sg) ** 2); }, 0.015);
    ctx.beginPath(); for (let px = L; px <= R; px++) { const e = lo + (px - L) / (R - L) * (hi - lo); const y = Y(spec(e)); px === L ? ctx.moveTo(px, y) : ctx.lineTo(px, y); }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, B); ctx.lineTo(R, B); ctx.stroke();
    peaks.forEach(([e0, a, c, lab]) => { if (!lab) return; const up = (lab === "Ti" || lab === "Mn" || lab === "K") ? 14 : 0;
      txt(ctx, lab, X(e0), Y(a) - 6 - up, { size: 11.5, w: 600, col: c, align: lab.length > 3 && e0 > 12 ? "right" : "center" }); });
    txt(ctx, mode === 0 ? "²⁴¹Am source: element lines (XRF)" : "⁵⁷Co source: iron lines for Mössbauer", L, T - 8, { size: 12.5, w: 600 });
  });
  axisX(ctx, L, R, bot, lo, hi, [2, 4, 6, 8, 10, 12, 14, 16, 18], "photon energy (keV)");
  badge(ctx, "SCHEMATIC", R, top - 8);
});

/* ---------- fm: pairs an element map can't separate ---------- */
const VF = [5.3119, 3.0768, 0.8417];   // alpha-Fe line velocities at 33.0 T (mc-story.js)
function lines(ph) {
  if (ph.type === "doublet") return [[ph.d - ph.q / 2, 1], [ph.d + ph.q / 2, 1]].map(([v, a]) => [v, a * ph.A]);
  const s = ph.B / 33.0, e = ph.q / 2, I = [3, 2, 1, 1, 2, 3];
  return [-VF[0], -VF[1], -VF[2], VF[2], VF[1], VF[0]].map((v, i) => [ph.d + v * s + (i === 0 || i === 5 ? e : -e), I[i] / 3 * ph.A]);
}
const PAIRS = [
  { name: "Magnetite: bulk grains vs nanoparticles", lim: 10, a: { lab: "bulk magnetite Fe₃O₄: two sextets", col: "#5a3e1b", ph: [{ type: "sextet", d: 0.31, q: 0.06, B: 50.1, A: 1 }, { type: "sextet", d: 0.64, q: 0, B: 46.9, A: 2 }] },
    b: { lab: "nanophase Fe³⁺ oxide: one doublet", col: C.gold, ph: [{ type: "doublet", d: 0.37, q: 0.91, A: 3 }] } },
  { name: "Ilmenite vs pyroxene", lim: 4, a: { lab: "ilmenite FeTiO₃ (ΔE_Q 0.80 mm/s)", col: C.purple, ph: [{ type: "doublet", d: 1.07, q: 0.80, A: 1 }] },
    b: { lab: "pyroxene (ΔE_Q 2.15 mm/s)", col: C.blue, ph: [{ type: "doublet", d: 1.16, q: 2.15, A: 1 }] } },
  { name: "Jarosite vs hematite", lim: 10, a: { lab: "jarosite: Fe³⁺ sulfate, forms in acid water", col: C.gold, ph: [{ type: "doublet", d: 0.36, q: 1.22, A: 1 }] },
    b: { lab: "hematite α-Fe₂O₃: magnetic sextet", col: C.red, ph: [{ type: "sextet", d: 0.37, q: -0.16, B: 51.7, A: 1 }] } },
];
const fm = fig("fm", 0.5, 0.95, (ctx, w, h, mode) => {
  const P = PAIRS[mode], L = 16, R = w - 16, T = 34, B = h - 46, lim = P.lim;
  const X = axisX(ctx, L, R, B, -lim, lim, lim > 5 ? [-10, -5, 0, 5, 10] : [-4, -2, 0, 2, 4], "source velocity (mm/s)");
  const rows = [P.a, P.b], rh = (B - T) / 2;
  rows.forEach((m, k) => {
    const ls = m.ph.flatMap(lines), tot = ls.reduce((s, l) => s + l[1], 0), g = 0.14;
    const f = v => ls.reduce((s, [v0, a]) => s + a / tot / (1 + ((v - v0) / g) ** 2), 0);
    let mx = 0; for (let v = -lim; v <= lim; v += lim / 400) mx = Math.max(mx, f(v));
    const base = T + rh * (k + 1) - 8, amp = rh - 34;
    ctx.beginPath(); for (let px = L; px <= R; px++) { const v = -lim + (px - L) / (R - L) * 2 * lim; const y = base - f(v) / mx * amp; px === L ? ctx.moveTo(px, y) : ctx.lineTo(px, y); }
    ctx.strokeStyle = m.col; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, m.lab, L + 2, base - amp - 6, { size: 12, w: 600, col: m.col });
    // annotate the first phase: IS (dashed centre), QS (doublet gap) or B_hf (outer-line spread)
    const ph = m.ph[0], pl = lines(ph), yA = base - amp * 0.55;
    const arrow = (x1, x2, y, lab) => { ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y);
      [[x1, 1], [x2, -1]].forEach(([x, d]) => { ctx.moveTo(x + 6 * d, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + 6 * d, y + 4); }); ctx.stroke();
      const lx = lab.startsWith("QS") ? x2 + 10 : x1 + (x2 - x1) * 0.3; ctx.font = `600 11.5px ${FONT}`; const tw = ctx.measureText(lab).width;
      ctx.fillStyle = "#F7F7F4"; ctx.fillRect(lx - 3, y - 19, tw + 6, 16); txt(ctx, lab, lx, y - 6, { size: 11.5, w: 600 }); };
    ctx.setLineDash([4, 4]); ctx.strokeStyle = C.mute; ctx.beginPath(); ctx.moveTo(X(ph.d), base); ctx.lineTo(X(ph.d), base - amp * 0.9); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, "IS " + ph.d.toFixed(2), X(ph.d) - 4, base - amp * 0.9 + 10, { size: 11, col: C.mute, align: "right" });
    if (ph.type === "doublet") arrow(X(pl[0][0]), X(pl[1][0]), yA, "QS " + ph.q.toFixed(2));
    else arrow(X(pl[0][0]), X(pl[5][0]), base - amp * 0.12, "Bhf " + ph.B.toFixed(1) + " T");
  });
  badge(ctx, "MODEL", R, 14);
});
if (fm) seg("fm-pair", PAIRS.map(p => p.name), fm);

/* ---------- fd: how deep each signal looks (three rocks side by side on one depth axis, no toggle) ---------- */
// 95 % information depth (um), 14.4 / 6.4 keV, off resonance, our head's median angles (56 deg in, 62 deg out):
// 1Research/sinrg/factsheet/build/D_info_depth.json (xraydb mass attenuation; compositions listed there).
// The model is single exponential, weight(z) ~ exp(-mu_eff z), so mu_eff = ln 20 / z95 and the shading below is exact.
const DEPTH = [
  { name: "Basalt", note: "FeO 14 wt %, 2.9 g/cm³", d14: 303, d64: 91 },
  { name: "Highland soil", note: "FeO 4.5 wt %, 1.5 g/cm³", d14: 768, d64: 170 },
  { name: "Hematite", note: "Fe₂O₃, 5.3 g/cm³", d14: 54, d64: 48 },
];
const LN20 = Math.log(20);
const fd = fig("fd", 0.5, 1.05, (ctx, w, h) => {
  const narrow = w < 560, L = 50, R = w - 6, T = narrow ? 96 : 78, B = h - 12, max = 800;
  const Y = z => T + z / max * (B - T);
  // legend
  const sw = (x, y, c, s) => { ctx.fillStyle = c; ctx.fillRect(x, y - 9, 12, 10); txt(ctx, s, x + 17, y, { size: 12 }); };
  sw(L, 16, C.purple, "14.4 keV γ (Mössbauer)");
  if (narrow) sw(L, 34, C.red, "6.4 keV Fe X-ray"); else sw(L + 190, 16, C.red, "6.4 keV Fe X-ray");
  badge(ctx, "MODEL", R, 16);
  // depth axis
  [0, 200, 400, 600, 800].forEach(z => { txt(ctx, String(z), L - 8, Y(z) + 4, { size: 11, col: C.mute, align: "right" });
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, Y(z)); ctx.lineTo(R, Y(z)); ctx.stroke(); });
  ctx.save(); ctx.translate(13, (T + B) / 2); ctx.rotate(-Math.PI / 2); txt(ctx, "depth below the surface (µm)", 0, 0, { size: 11.5, col: C.mute, align: "center" }); ctx.restore();
  const cw = (R - L) / 3;
  DEPTH.forEach((D, i) => {
    const x0 = L + i * cw + 5, x1 = x0 + cw - 10, cx = (x0 + x1) / 2;
    ctx.fillStyle = "#efe8da"; ctx.fillRect(x0, T, x1 - x0, B - T);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, T); ctx.lineTo(x1, T); ctx.stroke();
    txt(ctx, D.name, cx, T - (narrow ? 22 : 24), { size: 12.5, w: 600, align: "center" });
    txt(ctx, narrow ? D.note.split(",")[0] : D.note, cx, T - 8, { size: 10.5, col: C.mute, align: "center" });
    const bw = (x1 - x0) * 0.34;
    [[D.d14, C.purple, 0.28], [D.d64, C.red, 0.72]].forEach(([z95, c, f]) => {
      const bx = x0 + (x1 - x0) * f - bw / 2, g = ctx.createLinearGradient(0, T, 0, B), rgb = [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16));
      for (let k = 0; k <= 40; k++) { const z = k / 40 * max; g.addColorStop(k / 40, `rgba(${rgb},${(0.9 * Math.exp(-LN20 * z / z95)).toFixed(3)})`); }
      ctx.fillStyle = g; ctx.fillRect(bx, T, bw, B - T);
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx - 3, Y(z95)); ctx.lineTo(bx + bw + 3, Y(z95)); ctx.stroke();
      txt(ctx, String(z95), bx + bw / 2, Y(z95) + 15 > B - 2 ? Y(z95) - 7 : Y(z95) + 15,{ size: 11.5, w: 600, col: c, align: "center" });
    });
  });
});

let tm = null;
const all = () => draws.forEach(d => d.redraw());
window.addEventListener("resize", () => { clearTimeout(tm); tm = setTimeout(all, 120); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
all();
})();
