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

  /* ------------------------------------------------- four kinds of entropy ---
   * Four small animated panels, one mechanism each, then a stacked bar of their sizes for
   * CoCrFeMnNi at 385 K: ideal configurational kB ln 5, electronic from DFT (paper Table 2),
   * and vibrational + magnetic = measured 4.71 minus electronic. */
  function kinds(root) {
    var cvs = root.querySelectorAll('canvas.hea-kind'), bar = $(root, 'canvas.hea-kindbar');
    var t = 0, raf = null, visible = true;
    var cfg = [], NX = 9, NY = 6;
    for (var i = 0; i < NX * NY; i++) cfg.push(Math.floor(Math.random() * 5));
    var ph = []; for (var k = 0; k < NX * NY; k++) ph.push([Math.random() * 6.28, Math.random() * 6.28, 0.7 + Math.random() * 0.6]);
    var spin = []; for (var m = 0; m < NX * NY; m++) spin.push(Math.random() * 6.28);
    function grid(g, f) {
      var s = Math.min(g.w / (NX + 0.5), (g.h - 4) / (NY + 0.3)), ox = (g.w - s * NX) / 2 + s / 2, oy = (g.h - s * NY) / 2 + s / 2;
      for (var y = 0; y < NY; y++) for (var x = 0; x < NX; x++) f(ox + x * s, oy + y * s, s, y * NX + x);
    }
    function draw() {
      // 1 configurational: frozen random arrangement
      var g = ctx2d(cvs[0]);
      grid(g, function (x, y, s, i) { g.c.fillStyle = ELEM[cfg[i]]; g.c.beginPath(); g.c.arc(x, y, s * 0.33, 0, 6.2832); g.c.fill(); });
      // 2 vibrational: atoms jiggle about their sites
      g = ctx2d(cvs[1]);
      grid(g, function (x, y, s, i) {
        var p = ph[i], a = s * 0.14;
        g.c.strokeStyle = RULE; g.c.beginPath(); g.c.arc(x, y, s * 0.33, 0, 6.2832); g.c.stroke();
        g.c.fillStyle = SAGE; g.c.beginPath();
        g.c.arc(x + a * Math.sin(t * 3.1 * p[2] + p[0]), y + a * Math.sin(t * 2.7 * p[2] + p[1]), s * 0.3, 0, 6.2832); g.c.fill();
      });
      // 3 electronic: levels filled below the Fermi level, blurred near it
      g = ctx2d(cvs[2]);
      var L = 16, top = 8, bot = g.h - 8, w0 = g.w * 0.22, w1 = g.w * 0.78;
      for (var l = 0; l < L; l++) {
        var y = bot - (l + 0.5) * (bot - top) / L, e = (l - L / 2 + 0.5) / 1.6;
        var occ = 1 / (1 + Math.exp(e));
        g.c.strokeStyle = RULE; g.c.beginPath(); g.c.moveTo(w0, y); g.c.lineTo(w1, y); g.c.stroke();
        for (var q = 0; q < 6; q++) {               // six states per level; near E_F each flickers with probability f(E)
          var r = 0.5 + 0.5 * Math.sin(t * (1.3 + 0.37 * q) + l * 2.3 + q * 1.9);
          if (occ > 0.97 || (occ > 0.03 && r < occ)) {
            g.c.fillStyle = BLUE; g.c.beginPath(); g.c.arc(w0 + (q + 0.5) * (w1 - w0) / 6, y, 2.6, 0, 6.2832); g.c.fill();
          }
        }
      }
      g.c.strokeStyle = GOLD; g.c.setLineDash([4, 3]); g.c.beginPath(); g.c.moveTo(w0 - 10, (top + bot) / 2); g.c.lineTo(w1 + 10, (top + bot) / 2); g.c.stroke(); g.c.setLineDash([]);
      g.c.fillStyle = GOLD; g.c.textAlign = 'left'; g.c.fillText('Fermi level', w1 - 52, (top + bot) / 2 - 5);
      // 4 magnetic: moments that wander
      g = ctx2d(cvs[3]);
      grid(g, function (x, y, s, i) {
        var a = spin[i] + 0.9 * Math.sin(t * 1.3 + i * 2.1), r = s * 0.32;
        g.c.strokeStyle = ROSE; g.c.lineWidth = 1.6; g.c.beginPath();
        g.c.moveTo(x - r * Math.cos(a), y - r * Math.sin(a)); g.c.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); g.c.stroke();
        g.c.fillStyle = ROSE; g.c.beginPath(); g.c.arc(x + r * Math.cos(a), y + r * Math.sin(a), 2.2, 0, 6.2832); g.c.fill();
        g.c.lineWidth = 1;
      });
    }
    function drawBar() {
      var g = ctx2d(bar), c = g.c, L = 8, R = 8, y0 = 22, h = 22;
      var parts = [{ v: 4.71 - 0.155, col: SAGE, lab: 'vibrational + magnetic  4.55' },
                   { v: 0.155, col: BLUE, lab: 'electronic 0.16' },
                   { v: Math.log(5), col: GOLD, lab: 'configurational (ideal)  1.61' }];
      var tot = parts.reduce(function (a, p) { return a + p.v; }, 0), X = function (v) { return L + v / 6.6 * (g.w - L - R); }, x = 0;
      parts.forEach(function (p, i) {
        c.fillStyle = p.col; c.fillRect(X(x), y0, X(x + p.v) - X(x) - 1, h);
        c.fillStyle = i === 1 ? BLUE : WHITE; c.textAlign = i === 1 ? 'center' : 'left';
        if (i === 1) c.fillText('electronic 0.16', X(x + p.v / 2), y0 + h + 14);
        else c.fillText(p.lab, X(x) + 6, y0 + h / 2 + 3);
        x += p.v;
      });
      c.fillStyle = INK; c.textAlign = 'left'; c.fillText('CoCrFeMnNi at 385 K, kB per atom (total ≈ ' + tot.toFixed(1) + ')', L, 12);
    }
    function frame() { raf = null; if (visible && !reduced) { t += 1 / 60; draw(); } if (!reduced) raf = requestAnimationFrame(frame); }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(root);
    onResize(function () { draw(); drawBar(); });
    draw(); drawBar(); if (!reduced) raf = requestAnimationFrame(frame);
  }

  /* --------------------------------------------------------------- B2 cell ---
   * A 2x2x2 block of BCC cells in oblique projection. Two sublattices: corners (alpha)
   * and body centers (beta). Order parameter eta mixes each sublattice from the random
   * equiatomic AlCoCrFeNi (0.2 each) toward full order (alpha: Al, Ni; beta: Co, Cr, Fe).
   * S_cfg = mean over sublattices of -sum c ln c. The {100} superlattice intensity scales
   * as (f_alpha - f_beta)^2 with f ~ Z, normalized to its fully ordered value. */
  function cell(root) {
    var cv = $(root, 'canvas.hea-cell'), cvP = $(root, 'canvas.hea-peak'), eta = $(root, '.hea-eta'), out = $(root, '.fig-out');
    var EL = ['Al', 'Ni', 'Co', 'Cr', 'Fe'], Z = [13, 28, 27, 24, 26], COL = [GOLD, BLUE, SAGE, ROSE, LILAC];
    var ALPHA = [0.5, 0.5, 0, 0, 0], BETA = [0, 0, 1 / 3, 1 / 3, 1 / 3];
    var sites = [];
    for (var x = 0; x <= 2; x++) for (var y = 0; y <= 2; y++) for (var z = 0; z <= 2; z++) sites.push({ p: [x, y, z], sub: 0, u: Math.random() });
    for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) for (var d = 0; d < 2; d++) sites.push({ p: [a + 0.5, b + 0.5, d + 0.5], sub: 1, u: Math.random() });
    function comp(sub, e) { var o = sub ? BETA : ALPHA; return o.map(function (v) { return (1 - e) * 0.2 + e * v; }); }
    function scfg(e) {
      return [0, 1].reduce(function (s, sub) { return s + 0.5 * comp(sub, e).reduce(function (q, c) { return q - (c > 0 ? c * Math.log(c) : 0); }, 0); }, 0);
    }
    function fdiff(e) {
      var fa = comp(0, e).reduce(function (s, c, i) { return s + c * Z[i]; }, 0), fb = comp(1, e).reduce(function (s, c, i) { return s + c * Z[i]; }, 0);
      return fa - fb;
    }
    var F1 = fdiff(1);
    function pick(sub, e, u) { var c = comp(sub, e), acc = 0; for (var i = 0; i < 5; i++) { acc += c[i]; if (u < acc) return i; } return 4; }
    function draw() {
      var e = +eta.value, g = ctx2d(cv), c = g.c;
      var s = Math.min(g.w * 0.8 / 2.62, g.h * 0.8 / 2.44), ox = g.w / 2 - s * 1.31, oy = g.h / 2 + s * 1.22;
      var P = function (p) { return [ox + p[0] * s + p[1] * s * 0.62, oy - p[2] * s - p[1] * s * 0.22]; };
      c.strokeStyle = 'rgba(242,243,240,0.16)';
      for (var i = 0; i <= 2; i++) for (var j = 0; j <= 2; j++) {
        [[[i, j, 0], [i, j, 2]], [[i, 0, j], [i, 2, j]], [[0, i, j], [2, i, j]]].forEach(function (seg) {
          var A = P(seg[0]), B = P(seg[1]); c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
        });
      }
      sites.slice().sort(function (A, B) { return B.p[1] - A.p[1]; }).forEach(function (st) {
        var q = P(st.p), el = pick(st.sub, e, st.u);
        c.fillStyle = COL[el]; c.beginPath(); c.arc(q[0], q[1], st.sub ? s * 0.12 : s * 0.095, 0, 6.2832); c.fill();
        if (st.sub) { c.strokeStyle = 'rgba(11,12,11,0.8)'; c.lineWidth = 1.5; c.stroke(); c.lineWidth = 1; }
      });
      c.textAlign = 'left';
      EL.forEach(function (n, i) { c.fillStyle = COL[i]; c.fillText('● ' + n, 6, 14 + i * 14); });
      c.fillStyle = INK; c.fillText('small: corners', 6, 94); c.fillText('outlined: centers', 6, 108);
      // right: S_cfg vs eta, and the superlattice peak growing
      var Es = [], Ss = []; for (var k = 0; k <= 50; k++) { Es.push(k / 50); Ss.push(scfg(k / 50)); }
      var I = Math.pow(fdiff(e) / F1, 2);
      linePlot(cvP, [{ x: Es, y: Ss, color: GOLD, width: 1.8 }, { x: [e], y: [scfg(e)], color: WHITE, dots: true, r: 4 }],
        { xmin: 0, xmax: 1, ymin: 0.8, ymax: 1.7, xticks: [0, 0.5, 1], yticks: [0.9, 1.31, 1.61],
          xlabel: 'degree of B2 order', ylabel: 'S_cfg  (kB / atom)',
          marks: [{ y: Math.log(5), label: 'random: kB ln 5', color: 'rgba(127,167,201,0.8)' }, { y: 1.31, label: 'AlCoCrFeNi, from XRD', color: 'rgba(201,138,127,0.9)' }] });
      out.textContent = 'order ' + e.toFixed(2) + '  ·  S_cfg ' + scfg(e).toFixed(2) + ' kB/atom  ·  B2 {100} superlattice peak at ' + Math.round(100 * I) + ' % of its fully ordered height';
    }
    eta.addEventListener('input', draw); onResize(draw); draw();
  }

  /* ------------------------------------------------------- count the ways ---
   * N sites, k of them gold, reshuffled continuously. W = N! / (k! (N-k)!), S = kB ln W.
   * The curve is S per site against k/N. */
  function count(root) {
    var cv = $(root, 'canvas.hea-box'), cvS = $(root, 'canvas.hea-w'), kk = $(root, '.hea-k'), out = $(root, '.fig-out');
    var N = 40, COLS = 10, order = [], t = 0, visible = true;
    function lnC(n, k) { var s = 0; for (var i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; }
    function shuffle() { order = []; for (var i = 0; i < N; i++) order.push(i); for (var j = N - 1; j > 0; j--) { var r = Math.floor(Math.random() * (j + 1)), q = order[j]; order[j] = order[r]; order[r] = q; } }
    function draw() {
      var k = +kk.value, g = ctx2d(cv), c = g.c, rows = N / COLS;
      var s = Math.min(g.w / COLS, g.h / rows), ox = (g.w - s * COLS) / 2, oy = (g.h - s * rows) / 2;
      for (var i = 0; i < N; i++) {
        var x = i % COLS, y = Math.floor(i / COLS);
        c.fillStyle = order[i] < k ? GOLD : BLUE;
        c.beginPath(); c.arc(ox + (x + 0.5) * s, oy + (y + 0.5) * s, s * 0.36, 0, 6.2832); c.fill();
      }
      var xs = [], ys = []; for (var m = 0; m <= N; m++) { xs.push(m / N); ys.push(lnC(N, m) / N); }
      linePlot(cvS, [{ x: xs, y: ys, color: GOLD, width: 1.8 }, { x: [k / N], y: [lnC(N, k) / N], color: WHITE, dots: true, r: 4 }],
        { xmin: 0, xmax: 1, ymin: 0, ymax: 0.75, xticks: [0, 0.5, 1], yticks: [0, 0.35, 0.69],
          xlabel: 'fraction gold', ylabel: 'S per site  (kB)', marks: [{ y: Math.log(2), label: 'kB ln 2', color: 'rgba(127,167,201,0.8)' }] });
      var W = lnC(N, k) / Math.LN10;
      out.textContent = k + ' gold of ' + N + '  ·  ' + (k === 0 || k === N ? 'exactly 1 arrangement' :
        (W < 6 ? Math.round(Math.pow(10, W)).toLocaleString() : '~10^' + W.toFixed(1)) + ' arrangements') +
        '  ·  S = kB ln W = ' + (lnC(N, k) / N).toFixed(2) + ' kB per site';
    }
    function frame() { if (visible && ++t % 40 === 0) { shuffle(); draw(); } requestAnimationFrame(frame); }
    kk.addEventListener('input', draw);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(root);
    onResize(draw); shuffle(); draw(); if (!reduced) requestAnimationFrame(frame);
  }

  /* ------------------------------------------------ molecular dynamics ---
   * hea-md.json (tools/md_assets.py): the real MACE MD of a 160-atom Al0.3NbTa0.5TiZr supercell
   * at 50, 150 and 300 K, 150 saved frames 20 fs apart, as displacements from each atom's mean
   * position. Played forwards then backwards: Newton's equations run either way, so the
   * reversed half is also a valid trajectory and the loop has no jump. Drag to turn the cells.
   * Under each cell: the path one niobium atom traces, at true scale. */
  var MDCOL = { Al: GOLD, Nb: BLUE, Ta: LILAC, Ti: SAGE, Zr: ROSE };
  function md(root) {
    var cvs = root.querySelectorAll('canvas.hea-md'), paths = root.querySelectorAll('canvas.hea-path'),
        caps = root.querySelectorAll('.hea-mdcap'), ex = $(root, '.hea-ex'), play = $(root, '.hea-play'),
        out = $(root, '.fig-out');
    fetch(root.dataset.src).then(function (r) { return r.json(); }).then(function (J) {
      var N = J.symbols.length, F = 0, yaw = 0.2, pitch = 0.24, tick = 0, running = !reduced, visible = true;
      var D = J.temps.map(function (t) {
        var b = atob(t.disp), a = new Int8Array(b.length);
        for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i) << 24 >> 24;
        return a;
      });
      var NF = D[0].length / (N * 3), ctr = J.cell.map(function (v) { return v / 2; });
      // the niobium atom nearest the middle of the cell
      var pick = 0, best = 1e9;
      J.ref.forEach(function (p, i) {
        if (J.symbols[i] !== 'Nb') return;
        var d = Math.pow(p[0] - ctr[0], 2) + Math.pow(p[1] - ctr[1], 2) + Math.pow(p[2] - ctr[2], 2);
        if (d < best) { best = d; pick = i; }
      });
      J.temps.forEach(function (t, k) {
        caps[k].innerHTML = '<b>' + t.T + ' K</b>run averaged ' + t.T_mean + ' K · atoms swing ' + t.rms_A.toFixed(2) +
          ' Å rms · a niobium atom moves at ' + t.v_rms_Nb + ' m/s';
      });
      function frameIndex() { var p = F % (2 * NF - 2); return p < NF ? p : 2 * NF - 2 - p; }
      function drawCell(k, f) {
        var g = ctx2d(cvs[k]), c = g.c, s = +ex.value, d = D[k], cy = Math.cos(yaw), sy = Math.sin(yaw),
            cp = Math.cos(pitch), sp = Math.sin(pitch);
        var proj = function (x, y, z) {
          x -= ctr[0]; y -= ctr[1]; z -= ctr[2];
          var x1 = x * cy - y * sy, y1 = x * sy + y * cy;
          return [x1, -z * cp - y1 * sp, y1 * cp - z * sp];
        };
        var sc = Math.min(g.w / 21, g.h / 21), ox = g.w / 2, oy = g.h / 2;
        // cell box
        var L = J.cell, E = [[0, 0, 0], [L[0], 0, 0], [L[0], L[1], 0], [0, L[1], 0], [0, 0, L[2]], [L[0], 0, L[2]], [L[0], L[1], L[2]], [0, L[1], L[2]]];
        var P = E.map(function (e) { return proj(e[0], e[1], e[2]); });
        c.strokeStyle = 'rgba(242,243,240,0.13)';
        [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) {
          c.beginPath(); c.moveTo(ox + P[e[0]][0] * sc, oy + P[e[0]][1] * sc); c.lineTo(ox + P[e[1]][0] * sc, oy + P[e[1]][1] * sc); c.stroke();
        });
        var pts = [];
        for (var i = 0; i < N; i++) {
          var o = (f * N + i) * 3, r = J.ref[i];
          var q = proj(r[0] + d[o] * J.q * s, r[1] + d[o + 1] * J.q * s, r[2] + d[o + 2] * J.q * s);
          pts.push([q[0], q[1], q[2], i]);
        }
        pts.sort(function (a, b) { return b[2] - a[2]; });
        pts.forEach(function (p) {
          var x = ox + p[0] * sc, y = oy + p[1] * sc, rad = sc * (J.symbols[p[3]] === 'Zr' ? 0.5 : 0.44);
          var shade = 0.55 + 0.45 * Math.max(0, Math.min(1, 0.5 - p[2] / 22));
          c.globalAlpha = shade; c.fillStyle = MDCOL[J.symbols[p[3]]];
          c.beginPath(); c.arc(x, y, rad, 0, 6.2832); c.fill();
          if (p[3] === pick) { c.globalAlpha = 1; c.strokeStyle = WHITE; c.lineWidth = 1.6; c.stroke(); c.lineWidth = 1; }
        });
        c.globalAlpha = 1;
      }
      function drawPath(k, f) {
        var g = ctx2d(paths[k]), c = g.c, d = D[k], span = 0.3, sc = Math.min(g.w, g.h) / (2 * span) * 0.9,
            ox = g.w / 2, oy = g.h / 2, t = J.temps[k];
        c.strokeStyle = RULE; c.setLineDash([3, 3]);
        c.beginPath(); c.arc(ox, oy, t.rms_A * sc, 0, 6.2832); c.stroke(); c.setLineDash([]);
        var xy = function (j) { var o = (j * N + pick) * 3; return [ox + d[o] * J.q * sc, oy - d[o + 2] * J.q * sc]; };
        c.strokeStyle = 'rgba(127,167,201,0.35)'; c.beginPath();
        for (var j = 0; j < NF; j++) { var p = xy(j); if (j) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
        c.stroke();
        var cur = xy(f); c.fillStyle = BLUE; c.beginPath(); c.arc(cur[0], cur[1], 4, 0, 6.2832); c.fill();
        c.fillStyle = WHITE; c.beginPath(); c.arc(ox, oy, 1.6, 0, 6.2832); c.fill();
        // scale bar: 0.1 angstrom
        var bx = 10, by = g.h - 10; c.strokeStyle = INK; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + 0.1 * sc, by); c.stroke();
        c.fillStyle = INK; c.textAlign = 'left'; c.fillText('0.1 Å', bx, by - 5);
        c.textAlign = 'right'; c.fillText('same scale in all three', g.w - 8, 14);
        c.textAlign = 'left'; c.fillText('rms ' + t.rms_A.toFixed(2) + ' Å', ox + t.rms_A * sc * 0.72 + 4, oy - t.rms_A * sc * 0.72 - 2);
      }
      function draw() {
        var f = frameIndex();
        for (var k = 0; k < 3; k++) { drawCell(k, f); drawPath(k, f); }
        out.textContent = 't = ' + (f * J.frame_fs / 1000).toFixed(2) + ' ps of a ' + ((NF - 1) * J.frame_fs / 1000).toFixed(1) +
          ' ps stretch  ·  motion in the cells drawn ' + ex.value + '× true size  ·  ringed atom = the niobium traced below';
      }
      function frame() {
        if (running && visible && ++tick % 2 === 0) { F++; draw(); }
        requestAnimationFrame(frame);
      }
      var drag = null;
      cvs.forEach(function (cv) {
        cv.style.touchAction = 'pan-y'; cv.style.cursor = 'grab';
        cv.addEventListener('pointerdown', function (e) { drag = [e.clientX, e.clientY, yaw, pitch]; cv.setPointerCapture(e.pointerId); });
        cv.addEventListener('pointermove', function (e) {
          if (!drag) return;
          yaw = drag[2] + (e.clientX - drag[0]) * 0.01;
          pitch = Math.max(-1.2, Math.min(1.2, drag[3] + (e.clientY - drag[1]) * 0.006));
          draw();
        });
        cv.addEventListener('pointerup', function () { drag = null; });
      });
      ex.addEventListener('change', draw);
      play.addEventListener('click', function () { running = !running; play.textContent = running ? 'pause' : 'play'; });
      play.textContent = running ? 'pause' : 'play';
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(root);
      onResize(draw); draw(); requestAnimationFrame(frame);
    });
  }

  /* ------------------------------------------------------------- phonopy ---
   * How a harmonic phonon calculation works, drawn on a 2-D patch: still crystal -> nudge one
   * atom -> read the forces on its neighbours (toy springs, Al bonds stiffer) -> the springs set
   * the vibrations (a 1-D chain: long wave slow, short wave fast, omega ~ sin(ka/2)).
   * Below: the 477 real harmonic frequencies of the 160-atom MD cell, each bar lit by the
   * entropy one vibration of that frequency carries at the slider temperature,
   * s(x) = x/(e^x - 1) - ln(1 - e^-x), x = h nu / kB T. */
  function phon(root) {
    var cvs = root.querySelectorAll('canvas.hea-ph'), dos = $(root, 'canvas.hea-phdos'), tt = $(root, '.hea-pht'),
        out = $(root, '.fig-out');
    var NX = 5, NY = 4, el = [], t = 0, visible = true;
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    var PAL = [BLUE, LILAC, SAGE, ROSE, GOLD];             // Nb Ta Ti Zr Al
    for (var i = 0; i < NX * NY; i++) { var u = rnd(); el.push(u < 0.26 ? 0 : u < 0.4 ? 1 : u < 0.66 ? 2 : u < 0.92 ? 3 : 4); }
    el[2 * NX + 3] = 4;                                    // one Al right next to the nudged atom
    var CI = 2 * NX + 2;                                   // the atom that gets nudged
    function lat(g) {
      var s = Math.min(g.w / (NX + 0.6), (g.h - 18) / (NY + 0.4));
      return { s: s, ox: (g.w - s * (NX - 1)) / 2, oy: (g.h - 14 - s * (NY - 1)) / 2 };
    }
    function arrow(c, x0, y0, x1, y1, col, w) {
      var a = Math.atan2(y1 - y0, x1 - x0), h = 5;
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w || 1.5;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - h * Math.cos(a - 0.45), y1 - h * Math.sin(a - 0.45));
      c.lineTo(x1 - h * Math.cos(a + 0.45), y1 - h * Math.sin(a + 0.45)); c.closePath(); c.fill(); c.lineWidth = 1;
    }
    function stiff(a, b) { return (el[a] === 4 || el[b] === 4) ? 1.8 : 1; }
    function label(g, txt) { g.c.fillStyle = INK; g.c.textAlign = 'center'; g.c.fillText(txt, g.w / 2, g.h - 5); }
    function atoms(g, L, du) {
      for (var y = 0; y < NY; y++) for (var x = 0; x < NX; x++) {
        var i = y * NX + x, d = du ? du(i) : [0, 0];
        g.c.fillStyle = PAL[el[i]]; g.c.beginPath(); g.c.arc(L.ox + x * L.s + d[0], L.oy + y * L.s + d[1], L.s * 0.26, 0, 6.2832); g.c.fill();
      }
    }
    function still() { var g = ctx2d(cvs[0]), L = lat(g); atoms(g, L); label(g, 'every atom on its site'); }
    function nudge() {
      var g = ctx2d(cvs[1]), c = g.c, L = lat(g), cx = CI % NX, cy = Math.floor(CI / NX), u = L.s * 0.32;
      c.strokeStyle = 'rgba(242,243,240,0.4)'; c.setLineDash([2, 2]);
      c.beginPath(); c.arc(L.ox + cx * L.s, L.oy + cy * L.s, L.s * 0.26, 0, 6.2832); c.stroke(); c.setLineDash([]);
      atoms(g, L, function (i) { return i === CI ? [u, 0] : [0, 0]; });
      arrow(c, L.ox + cx * L.s, L.oy + cy * L.s, L.ox + cx * L.s + u, L.oy + cy * L.s, WHITE, 1.3);
      // force on each neighbour: spring along the bond, stretched by the projection of u on it
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (v) {
        var nx = cx + v[0], ny = cy + v[1]; if (nx < 0 || ny < 0 || nx >= NX || ny >= NY) return;
        var j = ny * NX + nx, n = Math.hypot(v[0], v[1]), rx = v[0] / n, ry = v[1] / n;
        var k = stiff(CI, j) * (n > 1 ? 0.45 : 1), proj = -rx;          // u is along +x; compression pushes away
        var f = k * proj * L.s * 0.6;
        var x0 = L.ox + nx * L.s, y0 = L.oy + ny * L.s;
        if (Math.abs(f) > 1) arrow(c, x0, y0, x0 - f * rx, y0 - f * ry, GOLD, 2.2);
      });
      label(g, 'push one atom, read the forces');
    }
    function springs() {
      var g = ctx2d(cvs[2]), c = g.c, L = lat(g);
      for (var y = 0; y < NY; y++) for (var x = 0; x < NX; x++) {
        [[1, 0], [0, 1]].forEach(function (v) {
          var nx = x + v[0], ny = y + v[1]; if (nx >= NX || ny >= NY) return;
          var a = y * NX + x, b = ny * NX + nx, k = stiff(a, b);
          var x0 = L.ox + x * L.s, y0 = L.oy + y * L.s, x1 = L.ox + nx * L.s, y1 = L.oy + ny * L.s;
          c.strokeStyle = k > 1 ? GOLD : 'rgba(242,243,240,0.45)'; c.lineWidth = k > 1 ? 2.2 : 1;
          c.beginPath(); c.moveTo(x0, y0);
          for (var z = 1; z < 8; z++) {
            var tt = z / 8, px = x0 + (x1 - x0) * tt, py = y0 + (y1 - y0) * tt, o = (z % 2 ? 1 : -1) * L.s * 0.08;
            c.lineTo(px - (y1 - y0) / L.s * o, py + (x1 - x0) / L.s * o);
          }
          c.lineTo(x1, y1); c.stroke(); c.lineWidth = 1;
        });
      }
      atoms(g, L, null);
      label(g, 'bonds to Al (gold) are stiffer');
    }
    function modes() {
      var g = ctx2d(cvs[3]), c = g.c, n = 9, s = (g.w - 24) / (n - 1), A = Math.min(10, g.h * 0.08);
      [[0.25, 0.38, 'long wave · low frequency'], [1, 1, 'short wave · high frequency']].forEach(function (m, r) {
        var y0 = g.h * (r ? 0.66 : 0.24), k = m[0] * Math.PI, w = m[1] * 2.2;
        c.strokeStyle = RULE; c.beginPath(); c.moveTo(12, y0); c.lineTo(g.w - 12, y0); c.stroke();
        for (var i = 0; i < n; i++) {
          var dy = A * Math.cos(k * i) * Math.cos(w * t * 2.4);
          c.fillStyle = SAGE; c.beginPath(); c.arc(12 + i * s, y0 + dy, Math.min(5.5, s * 0.3), 0, 6.2832); c.fill();
        }
        c.fillStyle = INK; c.textAlign = 'center'; c.fillText(m[2], g.w / 2, y0 + A + 18);
      });
    }
    var F = null;
    function drawDos() {
      if (!F) return;
      var g = ctx2d(dos), c = g.c, T = +tt.value, L = 40, R = 10, Tp = 10, B = 28, nb = 36, fmax = 9.5, H = [];
      for (var b = 0; b < nb; b++) H.push(0);
      var hk = 0.04799 * 1000;                               // h/kB in K per THz = 47.99
      var S = 0, sm = function (nu) { var x = hk * nu / T; return x > 50 ? 0 : x / (Math.exp(x) - 1) - Math.log(1 - Math.exp(-x)); };
      F.forEach(function (nu) { H[Math.min(nb - 1, Math.floor(nu / fmax * nb))]++; S += sm(nu); });
      var hmax = Math.max.apply(null, H), bw = (g.w - L - R) / nb;
      c.strokeStyle = RULE; c.beginPath(); c.moveTo(L, g.h - B); c.lineTo(g.w - R, g.h - B); c.stroke();
      for (var j = 0; j < nb; j++) {
        var nu = (j + 0.5) * fmax / nb, lit = Math.min(1, sm(nu) / 3.2), h = H[j] / hmax * (g.h - Tp - B);
        c.fillStyle = 'rgba(217,178,111,' + (0.12 + 0.88 * lit).toFixed(3) + ')';
        c.fillRect(L + j * bw + 1, g.h - B - h, bw - 2, h);
      }
      c.fillStyle = INK; c.textAlign = 'center';
      [0, 2, 4, 6, 8].forEach(function (v) { c.fillText(v, L + v / fmax * (g.w - L - R), g.h - B + 13); });
      c.fillText('vibration frequency (THz, trillions of swings per second)', (L + g.w - R) / 2, g.h - 2);
      c.save(); c.translate(12, (Tp + g.h - B) / 2); c.rotate(-Math.PI / 2); c.fillText('how many', 0, 0); c.restore();
      out.textContent = T + ' K  ·  these ' + F.length + ' vibrations of the 160-atom cell carry S_vib = ' + (S / 160).toFixed(2) +
        ' kB per atom  ·  brighter bar = more entropy per vibration';
    }
    function draw() { still(); nudge(); springs(); modes(); }
    function frame() { if (visible) { t += 1 / 60; modes(); } requestAnimationFrame(frame); }
    fetch(root.dataset.src).then(function (r) { return r.json(); }).then(function (J) { F = J.f_harm_THz; drawDos(); });
    tt.addEventListener('input', drawDos);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(root);
    onResize(function () { draw(); drawDos(); }); draw(); if (!reduced) requestAnimationFrame(frame);
  }

  var FIGS = { count: count, name: name, gibbs: gibbs, budget: budget, cpdata: cpdata, sim: sim, xrd: xrd, kinds: kinds, cell: cell, md: md, phon: phon };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-hea]').forEach(function (el) {
      var f = FIGS[el.dataset.hea]; if (f) f(el);
    });
  });
})();
