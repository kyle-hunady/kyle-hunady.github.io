/* Figures for entropy.html. Needs md.js (linePlot). Each figure is a function of its root
 * element, wired by data-hea="<name>".
 *
 * Teaching models are tagged "model" on the page. The data figures (hea-cp.json, the entropy
 * budget) are the published values of Hunady, Elmasri & Fultz, Acta Mater. 321, 122808 (2026).
 */
(function () {
  'use strict';
  var SAGE = '#8FA095', GOLD = '#D9B26F', BLUE = '#7FA7C9', ROSE = '#C98A7F', LILAC = '#A99BC9',
      INK = 'rgba(242,243,240,0.55)', RULE = 'rgba(242,243,240,0.14)', WHITE = '#F2F3F0';
  var ELEM = [BLUE, GOLD, ROSE, SAGE, LILAC, '#C9C27F'];
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(r, s) { return r.querySelector(s); }
  function ctx2d(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.font = '10px "IBM Plex Mono", monospace';
    return { c: c, w: w, h: h };
  }
  function onResize(f) { var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(f, 80); }); }

  /* ---------------------------------------------------------------- the name ---
   * A 2-D square lattice standing in for one crystal plane. n elements, equal amounts,
   * placed at random. Right panel: S_cfg = kB ln n for n = 1..6, current n highlighted. */
  function name(root) {
    var cv = $(root, 'canvas.hea-lattice'), cvS = $(root, 'canvas.hea-ln'),
        n = $(root, '.hea-n'), shuffle = $(root, '.hea-shuffle'), out = $(root, '.fig-out');
    var COLS = 22, ROWS = 12, grid = [];
    function fill() {
      var k = +n.value, N = COLS * ROWS, a = [];
      for (var i = 0; i < N; i++) a.push(i % k);
      for (var j = N - 1; j > 0; j--) { var r = Math.floor(Math.random() * (j + 1)), t = a[j]; a[j] = a[r]; a[r] = t; }
      grid = a;
    }
    function draw() {
      var g = ctx2d(cv), c = g.c, k = +n.value;
      var s = Math.min(g.w / COLS, g.h / ROWS), ox = (g.w - s * COLS) / 2, oy = (g.h - s * ROWS) / 2;
      for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
        c.fillStyle = ELEM[grid[y * COLS + x]];
        c.beginPath(); c.arc(ox + (x + 0.5) * s, oy + (y + 0.5) * s, s * 0.36, 0, 6.2832); c.fill();
      }
      var h = ctx2d(cvS), d = h.c, L = 46, B = 26, T = 14, R = 8, bw = (h.w - L - R) / 6;
      var Y = function (v) { return h.h - B - v / 1.9 * (h.h - T - B); };
      d.strokeStyle = RULE; d.beginPath(); d.moveTo(L, T); d.lineTo(L, h.h - B); d.lineTo(h.w - R, h.h - B); d.stroke();
      d.fillStyle = INK; d.textAlign = 'right';
      [0, 0.5, 1, 1.5].forEach(function (v) { d.fillText(v, L - 5, Y(v) + 3); });
      for (var i = 1; i <= 6; i++) {
        var v = Math.log(i), x0 = L + (i - 1) * bw + bw * 0.18;
        d.fillStyle = i === k ? GOLD : 'rgba(143,160,149,0.45)';
        d.fillRect(x0, Y(v), bw * 0.64, Y(0) - Y(v));
        d.fillStyle = INK; d.textAlign = 'center'; d.fillText(i, x0 + bw * 0.32, h.h - B + 13);
      }
      d.fillText('number of elements', (L + h.w - R) / 2, h.h - 2);
      d.save(); d.translate(10, (T + h.h - B) / 2); d.rotate(-Math.PI / 2); d.fillText('S_cfg  (kB / atom)', 0, 0); d.restore();
      var W = Math.pow(k, COLS * ROWS);
      out.textContent = k + (k === 1 ? ' element' : ' elements') + '  ·  S_cfg = kB ln ' + k + ' = ' +
        Math.log(k).toFixed(2) + ' kB/atom  ·  this patch alone has ' +
        (k === 1 ? '1 arrangement' : '~10^' + Math.round(COLS * ROWS * Math.log10(k)) + ' arrangements');
    }
    n.addEventListener('input', function () { fill(); draw(); });
    shuffle.addEventListener('click', function () { fill(); draw(); });
    onResize(draw); fill(); draw();
  }

  /* ---------------------------------------------------------- the assumption ---
   * G = H - TS for two competing states, per atom, in meV.
   *   random solid solution: H = dH (enthalpy penalty), S = kB ln n + dSvib
   *   ordered compound:      H = 0,                       S = 0  (reference)
   * Crossover T* = dH / S_ss. The vibrational slider is a difference between the two states,
   * the size measured in the paper (tenths of kB/atom). */
  function gibbs(root) {
    var cv = $(root, 'canvas.hea-g'), n = $(root, '.hea-n'), dh = $(root, '.hea-dh'),
        sv = $(root, '.hea-svib'), out = $(root, '.fig-out');
    var KB = 0.08617;                         // meV/K
    function draw() {
      var k = +n.value, dH = +dh.value, dSv = +sv.value;
      var Sss = Math.log(k) + dSv;            // kB/atom, relative to the ordered state
      var TMAX = 2000, Ts = [], Gss = [], Gord = [];
      for (var T = 0; T <= TMAX; T += 20) { Ts.push(T); Gss.push(dH - T * KB * Sss); Gord.push(0); }
      var Tx = Sss > 0 ? dH / (KB * Sss) : Infinity;
      var lo = Math.min(-150, Gss[Gss.length - 1] - 10), hi = Math.max(dH + 20, 60);
      linePlot(cv, [
        { x: Ts, y: Gord, color: ROSE, width: 1.8 },
        { x: Ts, y: Gss, color: SAGE, width: 2 }
      ], { xmin: 0, xmax: TMAX, ymin: lo, ymax: hi, xticks: [0, 500, 1000, 1500, 2000],
           yticks: [Math.round(lo), 0, Math.round(dH)], xlabel: 'temperature (K)', ylabel: 'G  (meV / atom)',
           marks: Tx < TMAX ? [{ x: Tx, label: 'solid solution wins above ' + Math.round(Tx) + ' K', color: GOLD }] : [] });
      out.textContent = 'entropy advantage of the solid solution ' + Sss.toFixed(2) + ' kB/atom  (' +
        Math.log(k).toFixed(2) + ' mixing ' + (dSv >= 0 ? '+ ' : '− ') + Math.abs(dSv).toFixed(2) + ' vibrational)  ·  ' +
        (Tx < TMAX ? 'crossover ' + Math.round(Tx) + ' K' : 'no crossover below 2000 K');
    }
    [n, dh, sv].forEach(function (el) { el.addEventListener('input', draw); });
    onResize(draw); draw();
  }

  /* ------------------------------------------------------------ the budget ---
   * Published Table 3 of the paper, 385 K, kB/atom. One row per alloy: measured
   * (vibrational + magnetic + electronic) next to the configurational estimate. */
  var TABLE = [
    { a: 'CoCrFeNi', m: 4.61, ci: 1.39, ce: null },
    { a: 'Al0.2CoCrFeNi', m: 4.56, ci: 1.50, ce: null },
    { a: 'AlCoCrFeNi', m: 4.23, ci: 1.61, ce: 1.31 },
    { a: 'CoCrFeMnNi', m: 4.71, ci: 1.61, ce: null },
    { a: 'Al1.25CoCrFeMnNi', m: 4.27, ci: 1.79, ce: 1.43 },
    { a: 'NbTa0.5TiZr', m: 5.62, ci: 1.35, ce: 1.31 },
    { a: 'Al0.2NbTa0.5TiZr', m: 5.40, ci: 1.49, ce: 1.46 },
    { a: 'Al0.3NbTa0.5TiZr', m: 5.28, ci: 1.52, ce: 1.47 }
  ];
  var DELTA = [   // Table 3(b): adding Al
    { a: 'CoCrFeNi → AlCoCrFeNi', cfgI: 0.22, meas: -0.38, cfgE: -0.08 },
    { a: 'CoCrFeMnNi → Al1.25CoCrFeMnNi', cfgI: 0.18, meas: -0.44, cfgE: -0.18 },
    { a: 'NbTa0.5TiZr → Al0.3NbTa0.5TiZr', cfgI: 0.16, meas: -0.34, cfgE: 0.17 }
  ];
  function sub(s) { return s.replace(/(\d+(\.\d+)?)/g, function (m) { return m; }); }
  function budget(root) {
    var cv = $(root, 'canvas.hea-budget');
    function draw() {
      var g = ctx2d(cv), c = g.c, L = Math.min(150, g.w * 0.36), R = 12, T = 8, B = 30;
      var rowH = (g.h - T - B) / TABLE.length, X = function (v) { return L + v / 6.2 * (g.w - L - R); };
      c.strokeStyle = RULE; c.beginPath(); c.moveTo(L, T); c.lineTo(L, g.h - B); c.lineTo(g.w - R, g.h - B); c.stroke();
      c.fillStyle = INK; c.textAlign = 'center';
      [0, 1, 2, 3, 4, 5, 6].forEach(function (v) { c.fillText(v, X(v), g.h - B + 13); });
      c.fillText('entropy at 385 K  (kB / atom)', (L + g.w - R) / 2, g.h - 3);
      TABLE.forEach(function (r, i) {
        var y = T + i * rowH, bh = rowH * 0.3;
        if (i === 3 || i === 5) { c.strokeStyle = RULE; c.beginPath(); c.moveTo(4, y); c.lineTo(g.w - R, y); c.stroke(); }
        c.fillStyle = WHITE; c.textAlign = 'right'; c.fillText(sub(r.a), L - 8, y + rowH / 2 + 3);
        c.fillStyle = SAGE; c.fillRect(X(0), y + rowH * 0.14, X(r.m) - X(0), bh);
        c.fillStyle = INK; c.textAlign = 'left'; c.fillText(r.m.toFixed(2), X(r.m) + 4, y + rowH * 0.14 + bh - 2);
        var ce = r.ce == null ? r.ci : r.ce, yb = y + rowH * 0.52;
        c.fillStyle = BLUE; c.fillRect(X(0), yb, X(ce) - X(0), bh);
        if (r.ce != null && r.ce < r.ci) {      // the part ordering/segregation removes
          c.strokeStyle = BLUE; c.setLineDash([3, 2]); c.strokeRect(X(ce), yb + 0.5, X(r.ci) - X(ce), bh - 1); c.setLineDash([]);
        }
        c.fillStyle = INK; c.fillText(r.ci.toFixed(2), X(r.ci) + 4, yb + bh - 2);
      });
    }
    onResize(draw); draw();
    var cv2 = $(root, 'canvas.hea-delta');
    function drawDelta() {
      var g = ctx2d(cv2), c = g.c, L = 12, R = 12, T = 22, B = 46;
      var groups = DELTA.length, gw = (g.w - L - R) / groups;
      var Y = function (v) { return T + (0.3 - v) / 0.95 * (g.h - T - B); };
      c.strokeStyle = 'rgba(242,243,240,0.35)'; c.beginPath(); c.moveTo(L, Y(0)); c.lineTo(g.w - R, Y(0)); c.stroke();
      DELTA.forEach(function (d, i) {
        var x0 = L + i * gw, bars = [
          { v: d.cfgI, col: BLUE, lab: 'mixing, ideal' },
          { v: d.meas, col: SAGE, lab: 'measured' },
          { v: d.cfgE - d.cfgI, col: LILAC, lab: 'ordering or segregation' },
          { v: d.meas + d.cfgE, col: GOLD, lab: 'net' }
        ], bw = gw / 5.2;
        bars.forEach(function (b, j) {
          var x = x0 + bw * (0.5 + j * 1.15);
          c.fillStyle = b.col; c.fillRect(x, Math.min(Y(0), Y(b.v)), bw, Math.abs(Y(b.v) - Y(0)));
          c.fillStyle = INK; c.textAlign = 'center';
          c.fillText((b.v > 0 ? '+' : '') + b.v.toFixed(2), x + bw / 2, b.v >= 0 ? Y(b.v) - 4 : Y(b.v) + 11);
        });
        c.fillStyle = WHITE; c.textAlign = 'center';
        var parts = d.a.split(' → ');
        c.fillText('+ Al', x0 + gw / 2, g.h - B + 16);
        c.fillStyle = INK; c.fillText(parts[0], x0 + gw / 2, g.h - B + 30);
      });
      c.fillStyle = INK; c.textAlign = 'left'; c.fillText('change on adding Al  (kB / atom)', L, 12);
    }
    onResize(drawDelta); drawDelta();
  }

  /* ---------------------------------------------------------- measured Cp ---
   * hea-cp.json: measured points (dots). Three panels share the temperature axis;
   * the slider marks a temperature and reads S(T) for each alloy in the family. */
  var FAM = {
    cantor: { title: 'Al_xCoCrFeNi', cols: [BLUE, SAGE, GOLD] },
    cantor5: { title: 'Al_yCoCrFeMnNi', cols: [BLUE, GOLD] },
    refractory: { title: 'Al_zNbTa0.5TiZr', cols: [BLUE, SAGE, GOLD] }
  };
  var CP = null, cpWaiters = [];
  function withCp(f) {
    if (CP) return f(CP);
    cpWaiters.push(f);
    if (cpWaiters.length > 1) return;
    fetch($(document, '[data-hea-src]').dataset.heaSrc).then(function (r) { return r.json(); })
      .then(function (j) { CP = j; cpWaiters.forEach(function (w) { w(j); }); });
  }
  function interp(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    for (var i = 1; i < xs.length; i++) if (xs[i] >= x) {
      var t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
    return ys[ys.length - 1];
  }
  function cpdata(root) {
    var fam = $(root, '.hea-fam'), tt = $(root, '.hea-t'), out = $(root, '.fig-out'), leg = $(root, '.legend'),
        cA = $(root, 'canvas.hea-cp'), cB = $(root, 'canvas.hea-cpt'), cC = $(root, 'canvas.hea-s');
    withCp(function (J) {
      function draw() {
        var f = fam.value, rows = J.samples.filter(function (s) { return s.family === f; }), T = +tt.value;
        var cols = FAM[f].cols, mk = [{ x: T, color: 'rgba(217,178,111,0.6)' }];
        var dots = function (key) {
          return rows.map(function (s, i) {
            var y = key === 'CpT' ? s.Cp.map(function (v, k) { return 1000 * v / s.T[k]; }) : s[key];
            return { x: s.T, y: y, color: cols[i], dots: true, r: 1.8 };
          });
        };
        linePlot(cA, dots('Cp'), { xmin: 0, xmax: 400, ymin: 0, ymax: 3.6, xticks: [0, 100, 200, 300, 400],
          yticks: [0, 1, 2, 3], xlabel: 'temperature (K)', ylabel: 'Cp  (kB/atom)', marks: mk.concat([{ y: 3, label: '3 kB', color: 'rgba(242,243,240,0.3)' }]) });
        linePlot(cB, dots('CpT'), { xmin: 0, xmax: 400, ymin: 0, ymax: f === 'refractory' ? 32 : 24,
          xticks: [0, 100, 200, 300, 400], yticks: [0, 10, 20, 30].filter(function (v) { return v <= (f === 'refractory' ? 32 : 24); }),
          xlabel: 'temperature (K)', ylabel: 'Cp/T  (10⁻³ kB/atom/K)', marks: mk });
        linePlot(cC, dots('S'), { xmin: 0, xmax: 400, ymin: 0, ymax: 6, xticks: [0, 100, 200, 300, 400],
          yticks: [0, 2, 4, 6], xlabel: 'temperature (K)', ylabel: 'S  (kB/atom)',
          marks: mk.concat([{ y: Math.log(5), label: 'kB ln 5', color: BLUE }]) });
        leg.innerHTML = rows.map(function (s, i) {
          return '<span><i style="background:' + cols[i] + '"></i>' + s.label.replace(/(\d+(\.\d+)?)/g, '<sub>$1</sub>') + '</span>';
        }).join('');
        out.textContent = 'S(' + T + ' K):  ' + rows.map(function (s) {
          return s.label + ' ' + interp(s.T, s.S, T).toFixed(2);
        }).join('  ·  ') + '  kB/atom';
      }
      fam.addEventListener('change', draw); tt.addEventListener('input', draw);
      onResize(draw); draw();
    });
  }

  /* ---------------------------------------------------- simulated Cp ---
   * hea-sim.json (written by tools/hea_phonons.py): harmonic phonon Cv(T) from a
   * MACE-MP-0 force field on special quasirandom supercells, against the measured dots. */
  function sim(root) {
    var cv = $(root, 'canvas.hea-sim'), pick = $(root, '.hea-pick'), out = $(root, '.fig-out'),
        cvD = $(root, 'canvas.hea-dos');
    withCp(function (J) {
      fetch(root.dataset.sim).then(function (r) { return r.json(); }).then(function (S) {
        pick.innerHTML = S.alloys.map(function (a, i) { return '<option value="' + i + '">' + a.label + '</option>'; }).join('');
        function draw() {
          var a0 = S.alloys[+pick.value], m = J.samples.filter(function (s) { return s.id === a0.id; })[0];
          var keep = a0.T.map(function (t) { return t <= 400; });
          var cut = function (arr) { return arr.filter(function (_, k) { return keep[k]; }); };
          var a = { label: a0.label, kind: a0.kind, T: cut(a0.T), Cv: cut(a0.Cv), S: cut(a0.S) };
          var cvt = a.Cv.map(function (v, k) { return 1000 * v / a.T[k]; });
          var mt = m.Cp.map(function (v, k) { return 1000 * v / m.T[k]; });
          var ser = [{ x: a.T, y: cvt, color: GOLD, width: 1.8 },
                     { x: m.T, y: mt, color: SAGE, dots: true, r: 1.9 }];
          linePlot(cv, ser, { xmin: 0, xmax: 400, ymin: 0, ymax: 30, xticks: [0, 100, 200, 300, 400],
            yticks: [0, 10, 20, 30], xlabel: 'temperature (K)', ylabel: 'Cp/T  (10⁻³ kB/atom/K)' });
          if (cvD) linePlot(cvD, [{ x: a.T, y: a.S, color: GOLD, width: 1.8 }, { x: m.T, y: m.S, color: SAGE, dots: true, r: 1.9 }],
            { xmin: 0, xmax: 400, ymin: 0, ymax: 6, xticks: [0, 100, 200, 300, 400], yticks: [0, 2, 4, 6],
              xlabel: 'temperature (K)', ylabel: 'S  (kB/atom)' });
          var Ssim = interp(a.T, a.S, 385), Smeas = interp(m.T, m.S, 385);
          out.textContent = a.label + ' at 385 K:  measured S ' + Smeas.toFixed(2) + '  ·  MACE ' + (a.kind === 'qha' ? 'quasi-harmonic' : 'harmonic') + ' phonons ' +
            Ssim.toFixed(2) + '  ·  difference ' + (Smeas - Ssim >= 0 ? '+' : '') + (Smeas - Ssim).toFixed(2) + ' kB/atom';
        }
        pick.addEventListener('change', draw); onResize(draw); draw();
      });
    });
  }

  /* ------------------------------------------------------------------ XRD ---
   * hea-xrd.json: the eight Cu K-alpha patterns, each scaled to its strongest peak and
   * stacked. The dashed line is where the B2 {100} superlattice peak falls for a = 2.88 A. */
  function xrd(root) {
    var cv = $(root, 'canvas.hea-xrd'), fam = $(root, '.hea-fam');
    fetch(root.dataset.src).then(function (r) { return r.json(); }).then(function (J) {
      var GROUP = { cantor: ['CCFN1', 'Ap2CCFN2', 'ACCFN1', 'CCFMN1', 'A1p25CCFMN1'],
                    refractory: ['NTTZ1', 'Ap2NTTZ1', 'Ap3NTTZ1'] };
      function draw() {
        var ids = GROUP[fam.value], P = J.patterns.filter(function (p) { return ids.indexOf(p.id) >= 0; });
        var ser = P.map(function (p, i) {
          var off = (P.length - 1 - i) * 1.05, col = p.structure === 'B2' ? GOLD : (p.structure === 'BCC' ? SAGE : BLUE);
          return { x: p.tt, y: p.I.map(function (v) { return v + off; }), color: col, width: 1.1 };
        });
        var b2 = 2 * Math.asin(1.5418 / (2 * 2.88)) * 180 / Math.PI;
        var ax = linePlot(cv, ser, { xmin: 20, xmax: 90, ymin: 0, ymax: P.length * 1.05 + 0.1,
          xticks: [20, 30, 40, 50, 60, 70, 80, 90], yticks: [], xlabel: '2θ  (degrees, Cu Kα)', ylabel: 'intensity, offset',
          marks: fam.value === 'cantor' ? [{ x: b2, label: 'B2 {100}', color: GOLD }] : [] });
        var c = cv.getContext('2d'); c.font = '10px "IBM Plex Mono", monospace'; c.textAlign = 'right';
        P.forEach(function (p, i) {
          var off = (P.length - 1 - i) * 1.05;
          c.fillStyle = ser[i].color; c.fillText(p.label + '  ' + p.structure, ax.X(75.5), ax.Y(off + 0.62));
        });
      }
      fam.addEventListener('change', draw); onResize(draw); draw();
    });
  }

  var FIGS = { name: name, gibbs: gibbs, budget: budget, cpdata: cpdata, sim: sim, xrd: xrd };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-hea]').forEach(function (el) {
      var f = FIGS[el.dataset.hea]; if (f) f(el);
    });
  });
})();
