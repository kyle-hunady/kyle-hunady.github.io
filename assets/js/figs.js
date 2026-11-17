/* Interactive figures for the project pages. Each one is a plain function that
 * takes a root element holding its canvases and controls, so a page includes
 * this file once and calls only the figures it shows. Needs md.js (linePlot).
 *
 * Every figure here is a teaching model, labelled as such on the page. None of
 * them plots unpublished data.
 */
(function () {
  'use strict';
  var SAGE = '#8FA095', GOLD = '#D9B26F', BLUE = '#7FA7C9', ROSE = '#C98A7F',
      FAINT = 'rgba(242,243,240,0.35)';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(root, sel) { return root.querySelector(sel); }
  function onVisible(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver(function (es) { cb(es[0].isIntersecting); }).observe(el);
  }
  function poisson(lam) {
    if (lam > 30) return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss()));
    var L = Math.exp(-lam), k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }
  function gauss() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ------------------------------------------------ Mossbauer spectrum ----
   * A simulated backscatter spectrum of alpha-iron building up count by count.
   * Line positions are the textbook alpha-Fe sextet (+-5.33, +-3.08, +-0.84
   * mm/s, intensities 3:2:1:1:2:3). In backscatter the resonance shows up as
   * PEAKS above the background, not dips. Linewidth, effect size and count
   * rate are illustrative. */
  function mossbauer(root) {
    var cv = $(root, 'canvas.fig-spec'), rate = $(root, '.fig-rate'),
        play = $(root, '.fig-play'), reset = $(root, '.fig-reset'), out = $(root, '.fig-out');
    var NCH = 180, VMAX = 8, GAMMA = 0.28, EFFECT = 0.14;
    var LINES = [-5.33, -3.08, -0.84, 0.84, 3.08, 5.33], W = [3, 2, 1, 1, 2, 3];
    var v = [], shape = [], counts = [];
    for (var i = 0; i < NCH; i++) {
      v.push(-VMAX + 2 * VMAX * (i + 0.5) / NCH);
      var s = 1;
      for (var k = 0; k < 6; k++) {
        var d = (v[i] - LINES[k]) / (GAMMA / 2);
        s += EFFECT * (W[k] / 3) / (1 + d * d);
      }
      shape.push(s);
    }
    var MEAN = shape.reduce(function (a, b) { return a + b; }, 0) / NCH;
    var t = 0, running = !reduced, visible = true, raf = null;
    function clear() { counts = shape.map(function () { return 0; }); t = 0; }
    clear();
    function cps() { return Math.pow(10, +rate.value); }          // counts / s over the whole spectrum
    function advance(dt) {
      var per = cps() * dt / NCH;
      for (var i = 0; i < NCH; i++) counts[i] += poisson(per * shape[i]);
      t += dt;
    }
    function draw() {
      var total = counts.reduce(function (a, b) { return a + b; }, 0);
      var base = total / NCH / MEAN || 1;
      var model = shape.map(function (s) { return s * base; });
      var lo = Math.max(0, base * (1 - 4 / Math.sqrt(base + 1)) - 2),
          hi = base * (1 + EFFECT * 1.25) + 4 * Math.sqrt(base + 1) + 2;
      if (!total) { lo = 0; hi = 1; }
      linePlot(cv, [
        { x: v, y: model, color: GOLD, width: 1.2, dash: [4, 3] },
        { x: v, y: counts, color: SAGE, dots: true, r: 1.7 }
      ], { xmin: -VMAX, xmax: VMAX, ymin: lo, ymax: hi, xticks: [-8, -4, 0, 4, 8],
           yticks: total ? [Math.round(lo), Math.round(hi)] : [0, 1],
           xlabel: 'source velocity (mm/s)', ylabel: 'counts / channel' });
      // signal-to-noise of the strongest line: excess counts over the
      // Poisson noise of the background under it
      var snr = base * EFFECT / Math.sqrt(base);
      var hrs = t / 3600;
      out.textContent = Math.round(cps()).toLocaleString() + ' counts/s  ·  ' +
        (hrs < 1 ? Math.round(t / 60) + ' min' : hrs.toFixed(1) + ' h') +
        ' of counting  ·  ' + Math.round(total).toLocaleString() + ' counts  ·  outer-line S/N ' + snr.toFixed(1);
    }
    // The loop keeps ticking while running and only does work when the figure
    // is on screen, so a missed visibility callback cannot stall it.
    function frame() {
      raf = null;
      if (!running) return;
      if (visible) {
        advance(60 * 2);                     // two simulated minutes per frame
        draw();
        if (t > 72 * 3600) { running = false; play.textContent = 'Play'; return; }
      }
      raf = requestAnimationFrame(frame);
    }
    function go() { if (!raf && running) raf = requestAnimationFrame(frame); }
    play.addEventListener('click', function () {
      running = !running; play.textContent = running ? 'Pause' : 'Play'; go();
    });
    reset.addEventListener('click', function () { clear(); draw(); go(); });
    rate.addEventListener('input', function () { clear(); draw(); go(); });
    play.textContent = running ? 'Pause' : 'Play';
    onVisible(cv, function (vis) { visible = vis; go(); });
    window.addEventListener('resize', draw);
    if (reduced) { advance(6 * 3600); }
    draw();
    go();
  }

  /* ------------------------------------------------- vibrational entropy ---
   * Debye model. C_p/T integrated from 0 to T is the entropy; the shaded area
   * IS the number in the readout. Compared with the ideal configurational
   * entropy of an equimolar five-component solid solution, R ln 5. */
  function entropy(root) {
    var cvA = $(root, 'canvas.fig-cpt'), cvB = $(root, 'canvas.fig-s'),
        th = $(root, '.fig-theta'), tt = $(root, '.fig-temp'), out = $(root, '.fig-out');
    var R = 8.314, TMAX = 400;
    function cvDebye(T, theta) {
      if (T <= 0) return 0;
      var xd = theta / T, n = 200, h = xd / n, s = 0;
      for (var i = 0; i <= n; i++) {
        var x = i * h || 1e-9, ex = Math.exp(x);
        var f = Math.pow(x, 4) * ex / ((ex - 1) * (ex - 1));
        s += f * (i === 0 || i === n ? 1 : (i % 2 ? 4 : 2));
      }
      return 9 * R * Math.pow(T / theta, 3) * s * h / 3;
    }
    function curves(theta) {
      var Ts = [], cpt = [], S = [], acc = 0, prev = 0, dT = 2;
      for (var T = dT; T <= TMAX; T += dT) {
        var c = cvDebye(T, theta) / T;
        acc += 0.5 * (c + prev) * dT; prev = c;
        Ts.push(T); cpt.push(c); S.push(acc);
      }
      return { T: Ts, cpt: cpt, S: S };
    }
    function draw() {
      var theta = +th.value, T = +tt.value, c = curves(theta);
      var idx = Math.min(c.T.length - 1, Math.max(0, Math.round(T / 2) - 1));
      var shadeX = c.T.slice(0, idx + 1), shadeY = c.cpt.slice(0, idx + 1);
      var ymax = Math.max.apply(null, c.cpt) * 1.12;
      linePlot(cvA, [
        { x: shadeX, y: shadeY, color: 'transparent', fill: 'rgba(143,160,149,0.28)', fillOnly: true },
        { x: c.T, y: c.cpt, color: SAGE }
      ], { xmin: 0, xmax: TMAX, ymin: 0, ymax: ymax, xticks: [0, 100, 200, 300, 400],
           yticks: [0, +ymax.toFixed(2)], xlabel: 'temperature (K)', ylabel: 'Cp / T  (J/mol·K²)',
           marks: [{ x: T, label: T + ' K', color: GOLD }] });
      var cfg = R * Math.log(5);
      var smax = Math.max(45, Math.ceil(c.S[c.S.length - 1] * 1.1 / 5) * 5);
      linePlot(cvB, [
        { x: c.T, y: c.S, color: SAGE },
        { x: [0, TMAX], y: [cfg, cfg], color: BLUE, dash: [5, 4], width: 1.3 }
      ], { xmin: 0, xmax: TMAX, ymin: 0, ymax: smax, xticks: [0, 100, 200, 300, 400],
           yticks: [0, 15, 30, 45].filter(function (v) { return v <= smax; }), xlabel: 'temperature (K)', ylabel: 'S  (J/mol·K)',
           marks: [{ x: T, color: GOLD }, { y: cfg, label: 'R ln 5', color: BLUE }] });
      var Sv = c.S[idx];
      out.textContent = 'At ' + T + ' K: vibrational ' + Sv.toFixed(1) + ' J/mol·K  ·  ideal mixing ' +
        cfg.toFixed(1) + ' J/mol·K  ·  ratio ' + (Sv / cfg).toFixed(1) + '×';
    }
    th.addEventListener('input', draw); tt.addEventListener('input', draw);
    window.addEventListener('resize', draw);
    draw();
  }

  /* ---------------------------------------------- backscatter ray toy ----
   * 2-D cross-section of the instrument head. A collimated source sits above
   * the sample; detectors form a ring (two bars in cross-section) at radius r.
   * Each photon enters the sample, travels an exponential path, is re-emitted
   * in a random direction, and is attenuated on the way out. A sweep over r
   * gives the efficiency curve: the geometry search in miniature. */
  function rays(root) {
    var cv = $(root, 'canvas.fig-rays'), cvC = $(root, 'canvas.fig-eff'),
        rr = $(root, '.fig-ring'), hh = $(root, '.fig-height'), out = $(root, '.fig-out');
    var MU_IN = 1.2, MU_OUT = 2.0, HALF = 0.18, DW = 3.0, HOUSING = 3.5;   // 1/mm, rad, mm, mm
    var paths = [], raf = null, visible = true;

    function shoot(r, H, keep) {
      var th = (Math.random() * 2 - 1) * HALF;
      var x0 = H * Math.tan(th);
      var dx = Math.sin(th), dy = -Math.cos(th);
      var l = -Math.log(1 - Math.random()) / MU_IN;
      var xi = x0 + dx * l, yi = dy * l;
      var a = Math.random() * 2 * Math.PI, ex = Math.cos(a), ey = Math.sin(a);
      var p = { x0: 0, y0: H, x1: x0, x2: xi, y2: yi, hit: false, out: false };
      if (ey > 0) {
        var lo = -yi / ey;                                 // path back to the surface
        if (Math.random() < Math.exp(-MU_OUT * lo)) {
          p.out = true;
          var xs = xi + ex * lo;
          var k = H / ey, xd = xs + ex * k;                // where it crosses the detector plane
          p.x3 = xs; p.x4 = xd; p.y4 = H;
          // the source housing shadows the middle of the detector plane
          if (Math.abs(xd) > HOUSING && Math.abs(Math.abs(xd) - r) < DW / 2) p.hit = true;
        }
      }
      if (keep) { paths.push(p); if (paths.length > 160) paths.shift(); }
      return p.hit;
    }
    function eff(r, H, n) { var h = 0; for (var i = 0; i < n; i++) if (shoot(r, H, false)) h++; return h / n; }

    function drawScene() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var r = +rr.value, H = +hh.value, span = 22, sc = w / span, oy = h * 0.72;
      var X = function (x) { return w / 2 + x * sc; }, Y = function (y) { return oy - y * sc; };
      ctx.fillStyle = 'rgba(201,138,127,0.16)'; ctx.fillRect(0, oy, w, h - oy);
      ctx.strokeStyle = 'rgba(201,138,127,0.6)'; ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(w, oy); ctx.stroke();
      paths.forEach(function (p) {
        ctx.strokeStyle = 'rgba(242,243,240,0.10)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X(p.x0), Y(p.y0)); ctx.lineTo(X(p.x1), Y(0)); ctx.lineTo(X(p.x2), Y(p.y2)); ctx.stroke();
        if (p.out) {
          ctx.strokeStyle = p.hit ? 'rgba(143,160,149,0.95)' : 'rgba(217,178,111,0.22)';
          ctx.lineWidth = p.hit ? 1.6 : 1;
          ctx.beginPath(); ctx.moveTo(X(p.x2), Y(p.y2)); ctx.lineTo(X(p.x3), Y(0)); ctx.lineTo(X(p.x4), Y(p.y4)); ctx.stroke();
        }
      });
      ctx.fillStyle = BLUE;
      [-r, r].forEach(function (c) { ctx.fillRect(X(c - DW / 2), Y(H) - 4, DW * sc, 8); });
      ctx.fillStyle = 'rgba(217,178,111,0.18)'; ctx.fillRect(X(-HOUSING), Y(H) - 14, 2 * HOUSING * sc, 18);
      ctx.fillStyle = GOLD;
      ctx.beginPath(); ctx.moveTo(X(0), Y(H) + 2); ctx.lineTo(X(-0.7), Y(H) - 12); ctx.lineTo(X(0.7), Y(H) - 12); ctx.fill();
      ctx.fillStyle = 'rgba(242,243,240,0.6)'; ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center';
      ctx.fillText('source', X(0), Y(H) - 16);
      ctx.fillText('detector', X(r), Y(H) - 9); ctx.fillText('detector', X(-r), Y(H) - 9);
      ctx.fillText('sample', X(0), oy + 16);
    }
    var curve = null;
    function sweep() {
      var H = +hh.value, xs = [], ys = [];
      for (var r = 2; r <= 10.01; r += 0.5) { xs.push(r); ys.push(100 * eff(r, H, 3000)); }
      curve = { x: xs, y: ys };
    }
    function drawCurve() {
      var r = +rr.value, best = 0;
      for (var i = 1; i < curve.y.length; i++) if (curve.y[i] > curve.y[best]) best = i;
      var ymax = Math.max(1, Math.max.apply(null, curve.y) * 1.25);
      linePlot(cvC, [{ x: curve.x, y: curve.y, color: SAGE, dots: true, r: 2.2 }],
        { xmin: 2, xmax: 10, ymin: 0, ymax: ymax, xticks: [2, 4, 6, 8, 10], yticks: [0, +ymax.toFixed(1)],
          xlabel: 'detector ring radius (mm)', ylabel: 'detected (%)',
          marks: [{ x: r, color: GOLD, label: 'you' }] });
      var here = eff(r, +hh.value, 6000) * 100;
      out.textContent = 'This geometry: ' + here.toFixed(2) + ' % of source photons detected  ·  best in sweep: r = ' +
        curve.x[best].toFixed(1) + ' mm (' + curve.y[best].toFixed(2) + ' %)';
    }
    function frame() {
      raf = null;
      if (!visible) return;
      for (var i = 0; i < 3; i++) shoot(+rr.value, +hh.value, true);
      drawScene();
      if (!reduced) raf = requestAnimationFrame(frame);
    }
    function go() { if (!raf) raf = requestAnimationFrame(frame); }
    rr.addEventListener('input', function () { paths = []; drawCurve(); go(); });
    hh.addEventListener('input', function () { paths = []; sweep(); drawCurve(); go(); });
    onVisible(cv, function (v) { visible = v; if (v) go(); });
    window.addEventListener('resize', function () { drawScene(); drawCurve(); });
    sweep(); drawCurve();
    if (reduced) for (var i = 0; i < 120; i++) shoot(+rr.value, +hh.value, true);
    drawScene(); go();
  }

  /* ------------------------------------------------- MD page wiring ------ */
  function mdPage(root) {
    var cv = $(root, 'canvas.fig-md'), cvT = $(root, 'canvas.fig-md-t'),
        temp = $(root, '.fig-temp'), mode = $(root, '.fig-mode'), play = $(root, '.fig-play'),
        quench = $(root, '.fig-quench'), out = $(root, '.fig-out'), legend = $(root, '.legend');
    var n = 0;
    var sim = new MDSim(cv, {
      cols: 30, rows: 14, T: +temp.value, stepsPerFrame: 5,
      onFrame: function (s) {
        if (++n % 3) return;
        var h = s.history;
        linePlot(cvT, [
          { x: h.map(function (p) { return p.t; }), y: h.map(function (p) { return p.T; }), color: GOLD, width: 1.3 },
          { x: h.map(function (p) { return p.t; }), y: h.map(function (p) { return p.xf; }), color: SAGE, width: 1.6 }
        ], { xmin: h.length ? h[0].t : 0, xmax: h.length ? Math.max(h[h.length - 1].t, h[0].t + 1) : 1,
             ymin: 0, ymax: 1.4, yticks: [0, 0.5, 1], xlabel: 'time (reduced units)',
             xticks: h.length ? [h[0].t, h[h.length - 1].t] : [0, 1] });
        out.textContent = 'temperature ' + s.T.toFixed(2) + '  ·  crystal-like atoms ' +
          Math.round(100 * s.crystalFraction()) + ' %';
      }
    });
    sim.targetT = +temp.value;
    temp.addEventListener('input', function () { sim.targetT = +temp.value; });
    mode.addEventListener('change', function () {
      sim.setMode(mode.value);
      legend.dataset.mode = mode.value;
    });
    quench.addEventListener('click', function () { temp.value = 0.05; sim.targetT = 0.05; });
    play.textContent = sim.running ? 'Pause' : 'Play';
    play.addEventListener('click', function () {
      if (sim.running) sim.pause(); else sim.play();
      play.textContent = sim.running ? 'Pause' : 'Play';
    });
    if (!sim.running) { for (var i = 0; i < 40; i++) sim.tick(); }
  }

  window.Figs = { mossbauer: mossbauer, entropy: entropy, rays: rays, mdPage: mdPage };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-fig]').forEach(function (el) {
      var f = window.Figs[el.dataset.fig];
      if (f) f(el);
    });
  });
})();
