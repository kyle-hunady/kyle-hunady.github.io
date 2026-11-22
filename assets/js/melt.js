/* Figures for melting.html. Each figure is a function of its root element, wired by
 * data-melt="<name>". Teaching models are tagged "model" on the page; the MD figures replay
 * real MACE-OMAT-0 trajectories exported by melt-sele/scripts/website_export.py.
 *
 * TABLE holds every number the comparison figures draw, each with its source. Update it (and
 * the page text) when a new result is graded.
 */
(function () {
  'use strict';
  var SAGE = '#8FA095', GOLD = '#D9B26F', BLUE = '#7FA7C9', ROSE = '#C98A7F', LILAC = '#A99BC9',
      INK = 'rgba(242,243,240,0.55)', RULE = 'rgba(242,243,240,0.14)', WHITE = '#F2F3F0';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(r, s) { return r.querySelector(s); }
  function ctx2d(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    c.font = '10px "IBM Plex Mono", monospace';
    return { c: c, w: w, h: h };
  }
  function onResize(f) { var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(f, 80); }); }
  function u16(b64) { var s = atob(b64), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new Uint16Array(a.buffer); }
  function u8(b64) { var s = atob(b64), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
  function watch(root, set) { if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { set(es[0].isIntersecting); }).observe(root); }
  // axes: returns {X, Y} mappers and draws frame + ticks + labels
  function axes(g, o) {
    var c = g.c, L = o.L || 44, B = o.B || 28, T = o.T || 12, R = o.R || 10;
    var X = function (v) { return L + (v - o.x0) / (o.x1 - o.x0) * (g.w - L - R); };
    var Y = function (v) { return g.h - B - (v - o.y0) / (o.y1 - o.y0) * (g.h - T - B); };
    c.strokeStyle = RULE; c.beginPath(); c.moveTo(L, T); c.lineTo(L, g.h - B); c.lineTo(g.w - R, g.h - B); c.stroke();
    c.fillStyle = INK; c.textAlign = 'right';
    (o.yt || []).forEach(function (v) { c.fillText(v, L - 5, Y(v) + 3); });
    c.textAlign = 'center';
    (o.xt || []).forEach(function (v) { c.fillText(v, X(v), g.h - B + 13); });
    if (o.xl) c.fillText(o.xl, (L + g.w - R) / 2, g.h - 3);
    if (o.yl) { c.save(); c.translate(10, (T + g.h - B) / 2); c.rotate(-Math.PI / 2); c.fillText(o.yl, 0, 0); c.restore(); }
    return { X: X, Y: Y, L: L, B: B, T: T, R: R };
  }

  /* ------------------------------------------------------------ 3-D viewer ---
   * Same look and handling as research_kit cell3d / motion3d (the report viewers): shaded spheres,
   * left-drag rotates, right-drag (or shift-drag) pans, Ctrl+scroll zooms, double-click resets.
   * Linked panes share one view. Element colours are the kit's colors.py hues; Pb and Zn are
   * lightened so they read on this dark page. */
  var EL = { Pb: '#8DA3BA', Ge: '#47B39C', Si: '#17BECF', Bi: '#D6457F', Sn: '#F0A202', Zn: '#A7AEB5' };
  var SPR = {};
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var m = function (v) { return Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)); };
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }
  function sprite(col) {               // one pre-shaded sphere per colour, drawn scaled (fast for 2,000 atoms)
    if (SPR[col]) return SPR[col];
    var s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    var c = cv.getContext('2d'), gr = c.createRadialGradient(s * 0.36, s * 0.34, s * 0.04, s / 2, s / 2, s / 2);
    gr.addColorStop(0, shade(col, 0.75)); gr.addColorStop(0.35, col); gr.addColorStop(1, shade(col, -0.62));
    c.fillStyle = gr; c.beginPath(); c.arc(s / 2, s / 2, s / 2 - 0.5, 0, 6.2832); c.fill();
    return (SPR[col] = cv);
  }
  var HOME = { yaw: 0.55, pit: 0.32, zoom: 1, px: 0, py: 0 };
  /* o.scene() -> {atoms: [[x, y, z, colour, radiusÅ, alpha]], corners: 8 points or null, centre: [x,y,z], ext: Å},
   * o.under(c, P) / o.over(c, P): extra drawing behind / in front of the sphere at depth 0 (cutoff spheres). */
  function viewer(cv, o) {
    var V = Object.assign({}, o.home || HOME), H = Object.assign({}, V), me = { V: V, cv: cv };
    function P3(g, s) {
      var cy = Math.cos(V.yaw), sy = Math.sin(V.yaw), cp = Math.cos(V.pit), sp = Math.sin(V.pit), C = s.centre;
      var sc = (o.fit ? o.fit(g, s) : Math.min(g.w, g.h) * 0.46 / s.ext) * V.zoom, ox = g.w / 2 + V.px, oy = g.h / 2 + V.py;
      var f = function (x, y, z) {
        x -= C[0]; y -= C[1]; z -= C[2];
        var x1 = x * cy - y * sy, y1 = x * sy + y * cy;
        return [ox + x1 * sc, oy + (-z * cp - y1 * sp) * sc, y1 * cp - z * sp];   // [screen x, screen y, depth: + = far]
      };
      f.sc = sc; f.ox = ox; f.oy = oy; return f;
    }
    function draw() {
      var g = ctx2d(cv), c = g.c, s = o.scene(), P = P3(g, s), pts = [];
      if (s.corners) {
        var E = s.corners.map(function (e) { return P(e[0], e[1], e[2]); });
        c.strokeStyle = 'rgba(242,243,240,0.22)'; c.lineWidth = 1;
        [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(function (e) {
          c.beginPath(); c.moveTo(E[e[0]][0], E[e[0]][1]); c.lineTo(E[e[1]][0], E[e[1]][1]); c.stroke();
        });
      }
      s.atoms.forEach(function (a) { var q = P(a[0], a[1], a[2]); q.push(a[3], a[4], a[5] == null ? 1 : a[5]); pts.push(q); });
      pts.sort(function (a, b) { return b[2] - a[2]; });
      var span = s.ext, under = true;
      for (var i = 0; i < pts.length; i++) {
        var q = pts[i];
        if (under && q[2] < 0 && o.under) { o.under(c, P, s); under = false; }
        var r = Math.max(1.1, q[4] * P.sc), fog = 0.72 + 0.28 * Math.max(0, Math.min(1, 0.5 - q[2] / (2 * span)));
        c.globalAlpha = q[5] * fog; c.drawImage(sprite(q[3]), q[0] - r, q[1] - r, 2 * r, 2 * r);
      }
      c.globalAlpha = 1;
      if (under && o.under) o.under(c, P, s);
      if (o.over) o.over(c, P, s, g);
    }
    function sync() { (o.group || [me]).forEach(function (m) { if (m !== me) { Object.assign(m.V, V); m.draw(); } }); }
    var drag = null;
    cv.style.touchAction = 'pan-y'; cv.style.cursor = 'grab';
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey, v: Object.assign({}, V) };
      cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; if (o.onGrab) o.onGrab();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (drag.pan) { V.px = drag.v.px + dx; V.py = drag.v.py + dy; }
      else { V.yaw = drag.v.yaw + dx * 0.01; V.pit = Math.max(-1.5, Math.min(1.5, drag.v.pit + dy * 0.008)); }
      draw(); sync();
    });
    cv.addEventListener('pointerup', function () { drag = null; cv.style.cursor = 'grab'; });
    cv.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return; e.preventDefault();
      V.zoom = Math.max(0.4, Math.min(6, V.zoom * Math.exp(-e.deltaY * 0.0015))); draw(); sync();
    }, { passive: false });
    cv.addEventListener('dblclick', function () { Object.assign(V, H); draw(); sync(); });
    me.draw = draw;
    if (o.group) o.group.push(me);
    return me;
  }
  /* Push every periodic image of one atom that lies inside the box or within FADE Å of a face. Inside = opaque;
   * outside, the image fades out over FADE Å while its twin on the opposite face fades in. An atom crossing a face
   * therefore slides out as a ghost and in on the other side: nothing jumps (Kyle 2026-11-22). */
  var FADE = 2.2;
  function images(out, x, y, z, L, col, r) {
    var p = [x, y, z], opts = [];
    for (var k = 0; k < 3; k++) {
      var w = ((p[k] % L[k]) + L[k]) % L[k], o = [[w, 1]];
      if (w > L[k] - FADE) o.push([w - L[k], 1 - (L[k] - w) / FADE]);
      if (w < FADE) o.push([w + L[k], 1 - w / FADE]);
      opts.push(o);
    }
    opts[0].forEach(function (a) { opts[1].forEach(function (b) { opts[2].forEach(function (c) {
      var al = a[1] * b[1] * c[1]; if (al > 0.03) out.push([a[0], b[0], c[0], col, r, al < 1 ? 0.15 + 0.6 * al : 1]);
    }); }); });
  }
  function box8(L) { return [[0, 0, 0], [L[0], 0, 0], [L[0], L[1], 0], [0, L[1], 0], [0, 0, L[2]], [L[0], 0, L[2]], [L[0], L[1], L[2]], [0, L[1], L[2]]]; }
  function cell8(M) {                  // corners of a cell from lattice rows a, b, c
    return [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map(function (f) {
      return [0, 1, 2].map(function (k) { return f[0] * M[0][k] + f[1] * M[1][k] + f[2] * M[2][k]; });
    });
  }
  var VIEWHINT = 'Drag to rotate · right-drag to pan · Ctrl+scroll to zoom · double-click to reset.';

  /* Every comparison number on the page. k_B per atom; K. src = where it comes from. */
  var TABLE = [
    { el: 'Pb', kind: 'metal', Tx: 600.6, Tm: 611, Tlo: 608, Thi: 614, Tmtp: 663, fx: 0.95, fh: 1.03, fm: 1.20, sfm: 0.05,
      vib: -0.08, el_h: 0.07, conf: 1.03, el_m: 0.008, sel_m: 0.0005,
      src: 'T_m: coexistence, calcs 013/032 (611 ± 3 K). ΔS_fus: calc 028, rerun 2026-11-22 with the 611 K frames. ΔS_el: VASP on MACE frames at 611 K, calc 032.' },
    { el: 'Zn', kind: 'metal', Tx: 692.7, Tm: 460, Tlo: 440, Thi: 480, Tmtp: null, fx: 1.27, fh: null, fm: 1.15, sfm: 0.06,
      src: 'T_m: coexistence, calc 026 (440–480 K). Not in the thesis. The model crystal has a stretched c/a.' },
    { el: 'Sn', kind: 'metal', Tx: 505, Tm: null, Tmtp: null, fx: 1.67, fh: null, fm: null,
      src: 'The model loses the β-Sn crystal 180–255 K below the melting point (calc 014), so it has no melting point to compare.' },
    { el: 'Bi', kind: 'semimetal', Tx: 544.6, Tm: 445, Tlo: 440, Thi: 453, Tmtp: null, fx: 2.50, fh: null, fm: 2.47, sfm: 0.34,
      vib: 0.57, el_m: 0.084, prelim_el: true,
      src: 'T_m: coexistence, calcs 025/030. ΔS_fus: calc 028 rerun at T_m 445 K (2026-11-22). ΔS_el: first estimate with spin–orbit coupling, liquid at the measured density (calcs 004–006).' },
    { el: 'Ge', kind: 'semiconductor', Tx: 1211, Tm: 825, Tlo: 821, Thi: 829, Tmtp: 978, fx: 3.67, fh: 3.78, fm: 3.57, sfm: 0.07,
      vib: 1.48, el_h: 0.16, conf: 2.14, el_m: 0.1016, sel_m: 0.0007,
      src: 'T_m: coexistence, calc 015 + ladder (825 ± 4 K). ΔS_fus: calc 028 rerun at 825 K (2026-11-22). ΔS_el: VASP on MACE frames at 825 K, calc 022 T825 (0.1016 ± 0.0007).' },
    { el: 'Si', kind: 'semiconductor', Tx: 1687, Tm: 1450, Tlo: 1445, Thi: 1455, Tmtp: 1452, fx: 3.58, fh: 3.51, fm: 3.44, sfm: 0.05,
      vib: 1.09, el_h: 0.19, conf: 2.24, el_m: 0.1587, sel_m: 0.0026,
      src: 'T_m: coexistence, calc 015 (1450 ± 5 K). ΔS_fus: calc 028 rerun (2026-11-22). ΔS_el: VASP on MACE frames at 1446 K, calc 022 TSI (0.1587 ± 0.0026).' }
  ];


  /* The cutoff figure: MACE-OMAT-0's radial cutoff and three ideal crystals at measured room-temperature lattices.
   * Neighbour counts are computed on the page from these (checked offline: Pb 18 / 224, Ge 34 / 292, Bi 25 / 196). */
  var MACE_RC = { value: 6.0, src: 'MACE-OMAT-0 model (Batatia et al.; OMat24 release): radial cutoff r_max = 6 Å per message-passing layer, 2 layers.' };
  var CRYSTALS = {
    Pb: { el: 'Pb', kind: 'fcc', a: 4.9508, label: 'Pb · fcc', src: 'fcc lead, a = 4.9508 Å at room temperature (Wyckoff, Crystal Structures, vol. 1).' },
    Ge: { el: 'Ge', kind: 'diamond', a: 5.6575, label: 'Ge · diamond', src: 'diamond germanium, a = 5.6575 Å at room temperature (Wyckoff, Crystal Structures, vol. 1).' },
    Bi: { el: 'Bi', kind: 'A7', a: 4.5461, c: 11.8622, z: 0.23389, label: 'Bi · A7 (layered)', src: 'A7 bismuth, hexagonal a = 4.5461 Å, c = 11.8622 Å, z = 0.23389 at 298 K (Cucka & Barrett, Acta Cryst. 15, 865, 1962).' }
  };

  /* ------------------------------------------------------------------ G = H - TS ---
   * Per atom, solid as the reference: G_s = 0, G_l = dH - T dS. They cross at T_m = dH/dS. */
  function gibbs(root) {
    var cv = $(root, 'canvas.m-g'), dh = $(root, '.m-dh'), ds = $(root, '.m-ds'), out = $(root, '.fig-out');
    function draw() {
      var H = +dh.value, S = +ds.value, kB = 0.0083145, Tm = H / (S * kB), g = ctx2d(cv), c = g.c;
      var a = axes(g, { x0: 0, x1: 2000, y0: -12, y1: 12, xt: [0, 500, 1000, 1500, 2000], yt: [-10, 0, 10], xl: 'temperature (K)', yl: 'G − G_solid (kJ/mol)', L: 40 });
      c.strokeStyle = SAGE; c.lineWidth = 2; c.beginPath(); c.moveTo(a.X(0), a.Y(0)); c.lineTo(a.X(2000), a.Y(0)); c.stroke();
      c.strokeStyle = BLUE; c.beginPath();
      for (var T = 0; T <= 2000; T += 20) { var v = H - T * S * kB; v = Math.max(-12, Math.min(12, v)); if (T) c.lineTo(a.X(T), a.Y(v)); else c.moveTo(a.X(T), a.Y(v)); }
      c.stroke(); c.lineWidth = 1;
      if (Tm < 2000) {
        c.setLineDash([3, 3]); c.strokeStyle = GOLD; c.beginPath(); c.moveTo(a.X(Tm), a.T); c.lineTo(a.X(Tm), g.h - a.B); c.stroke(); c.setLineDash([]);
        c.fillStyle = GOLD; c.textAlign = 'left'; c.fillText('T_m = ' + Math.round(Tm) + ' K', a.X(Tm) + 5, a.T + 10);
      }
      c.textAlign = 'right'; c.fillStyle = SAGE; c.fillText('crystal', g.w - 14, a.Y(0) - 6);
      c.fillStyle = BLUE; c.fillText('liquid', g.w - 14, a.Y(Math.max(-11, Math.min(11, H - 1950 * S * kB))) + (H - 1950 * S * kB > 0 ? 14 : -6));
      out.textContent = 'Latent heat ' + H.toFixed(1) + ' kJ/mol  ·  entropy of fusion ' + S.toFixed(2) + ' kB/atom  ·  melting point ' +
        (Tm < 9999 ? Math.round(Tm) + ' K' : '—');
    }
    dh.addEventListener('input', draw); ds.addEventListener('input', draw); onResize(draw); draw();
  }

  /* ------------------------------------------------------- measured dS_fus + parts ---
   * Bars: measured entropy of fusion. Where the thesis split it, the bar is drawn as
   * vibrational + electronic + configurational (Bernal-Choban et al. 2024). */
  function fus(root) {
    var cv = $(root, 'canvas.m-fus'), parts = $(root, '.m-parts'), out = $(root, '.fig-out');
    function draw() {
      var g = ctx2d(cv), c = g.c, split = parts.checked;
      var a = axes(g, { x0: 0, x1: TABLE.length, y0: -0.3, y1: 4, yt: [0, 1, 2, 3, 4], yl: 'ΔS_fus (kB / atom)', L: 40 });
      c.setLineDash([4, 4]); c.strokeStyle = 'rgba(242,243,240,0.3)'; c.beginPath(); c.moveTo(a.L, a.Y(1.1)); c.lineTo(g.w - a.R, a.Y(1.1)); c.stroke(); c.setLineDash([]);
      c.fillStyle = INK; c.textAlign = 'left'; c.fillText("Richards' rule ≈ 1.1", a.L + 6, a.Y(1.1) - 5);
      TABLE.forEach(function (r, i) {
        var x0 = a.X(i + 0.2), bw = a.X(i + 0.8) - x0;
        if (split && r.conf != null) {
          var y = 0;
          [[r.vib, ROSE], [r.el_h, SAGE], [r.conf, LILAC]].forEach(function (p) {
            var v = p[0]; c.fillStyle = p[1];
            if (v < 0) { c.fillRect(x0, a.Y(0), bw, a.Y(v) - a.Y(0)); return; }
            c.fillRect(x0, a.Y(y + v), bw, a.Y(y) - a.Y(y + v)); y += v;
          });
        } else {
          c.fillStyle = split ? 'rgba(143,160,149,0.35)' : SAGE; c.fillRect(x0, a.Y(r.fx), bw, a.Y(0) - a.Y(r.fx));
        }
        c.fillStyle = WHITE; c.textAlign = 'center'; c.fillText(r.el, x0 + bw / 2, g.h - a.B + 13);
        c.fillStyle = INK; c.fillText(r.fx.toFixed(2), x0 + bw / 2, a.Y(Math.max(r.fx, (r.vib || 0) + (r.el_h || 0) + (r.conf || 0))) - 5);
      });
      out.textContent = split ? 'Split shown for Pb, Ge and Si, the elements the thesis decomposed completely: vibrational (rose), electronic (green), configurational (lilac).'
        : 'Measured entropy of fusion. Metals sit near 1 kB/atom; Bi, Ge and Si sit far above.';
    }
    parts.addEventListener('change', draw); onResize(draw); draw();
  }

  var JC = {};
  function getJ(u) { return JC[u] || (JC[u] = fetch(u).then(function (r) { return r.json(); })); }
  function lazy(root, f) {             // build a data figure only when it nears the screen (the slab data is 2 MB)
    if (!('IntersectionObserver' in window)) return f(root);
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); f(root); } }, { rootMargin: '600px' });
    io.observe(root);
  }
  var RAD = { Pb: 1.25, Ge: 0.95, Si: 0.92, Bi: 1.2, Sn: 1.2, Zn: 1.05 };   // drawn sphere radius, Å (~0.37 × nearest-neighbour distance)
  function row(el) { for (var i = 0; i < TABLE.length; i++) if (TABLE[i].el === el) return TABLE[i]; return null; }

  /* ----------------------------------------------------- solid vs liquid MD cells ---
   * Real MACE frames: Pb (fcc) and Ge (diamond) crystal and liquid near the model T_m, 240 CONSECUTIVE
   * saved steps each (Pb every 30 fs, Ge every 20 fs), played forward then back so the loop never jumps. */
  function cells(root) {
    var cvS = $(root, 'canvas.m-cs'), cvL = $(root, 'canvas.m-cl'), cvG = $(root, 'canvas.m-gr'), pick = $(root, '.m-el'),
        out = $(root, '.fig-out'), play = $(root, '.m-play'), capS = $(root, '.m-capS'), capL = $(root, '.m-capL');
    getJ(root.dataset.src).then(function (J) {
      var B = J.bulk, P = {}, F = 0, running = !reduced, visible = true, last = 0, grp = [];
      Object.keys(B).forEach(function (k) { P[k] = u16(B[k].pos); });
      function scene(key) {
        return function () {
          var b = B[key], d = P[key], N = b.natoms, NF = b.movie_frames, L = b.movie_box, el = key.slice(0, 2),
              p = F % (2 * NF - 2), f = p < NF ? p : 2 * NF - 2 - p, at = [];
          var lo = b.lo, hi = b.hi, col = key.slice(-1) === 's' ? GOLD : BLUE;
          for (var i = 0; i < N; i++) {
            var o = (f * N + i) * 3;
            images(at, lo[0] + d[o] / 65535 * (hi[0] - lo[0]), lo[1] + d[o + 1] / 65535 * (hi[1] - lo[1]), lo[2] + d[o + 2] / 65535 * (hi[2] - lo[2]), L, col, RAD[el]);
          }
          return { atoms: at, corners: box8(L), centre: [L[0] / 2, L[1] / 2, L[2] / 2], ext: 0.9 * Math.hypot(L[0], L[1], L[2]) / 2 };
        };
      }
      function tag(ph) {        // phase + temperature written on the pane itself
        return function (c) {
          var b = B[pick.value + '_' + ph]; c.textAlign = 'left'; c.font = '500 12px "IBM Plex Mono", monospace';
          c.fillStyle = ph === 's' ? GOLD : BLUE; c.fillText((ph === 's' ? 'crystal' : 'liquid') + ' · ' + Math.round(b.T_set) + ' K', 10, 18);
        };
      }
      var vS = viewer(cvS, { group: grp, over: tag('s'), scene: function () { return scene(pick.value + '_s')(); } }),
          vL = viewer(cvL, { group: grp, over: tag('l'), scene: function () { return scene(pick.value + '_l')(); } });
      function drawGr() {
        var el = pick.value, s = B[el + '_s'], l = B[el + '_l'], g = ctx2d(cvG), c = g.c;
        var ym = Math.ceil(Math.max.apply(null, s.gr.concat(l.gr)));
        var a = axes(g, { x0: 0, x1: 8, y0: 0, y1: ym, xt: [0, 2, 4, 6, 8], yt: [0, Math.round(ym / 2), ym], xl: 'distance from an atom, r (Å)', yl: 'g(r)', L: 34 });
        [[s, GOLD], [l, BLUE]].forEach(function (p) {
          c.strokeStyle = p[1]; c.lineWidth = 1.8; c.beginPath();
          p[0].gr_r.forEach(function (r, i) { var X = a.X(r), Y = a.Y(p[0].gr[i]); if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.stroke();
        });
        c.lineWidth = 1; c.setLineDash([3, 3]); c.strokeStyle = RULE; c.beginPath(); c.moveTo(a.X(s.rc), a.T); c.lineTo(a.X(s.rc), g.h - a.B); c.stroke(); c.setLineDash([]);
        c.fillStyle = INK; c.textAlign = 'left'; c.fillText('first-neighbour shell', a.X(s.rc) + 4, a.T + 10);
      }
      function caps() {
        var el = pick.value, s = B[el + '_s'], l = B[el + '_l'];
        var ps = function (b) { return (b.movie_frames * b.movie_dt_fs / 1000).toFixed(1); };
        var tt = function (b) { return '<span style="color:#F2F3F0">' + Math.round(b.T_set) + ' K</span> · '; };
        capS.innerHTML = '<b>' + s.label + '</b>' + tt(s) + s.natoms + ' atoms · ' + s.cn.toFixed(1) + ' neighbours · ' + s.vol_per_atom.toFixed(1) + ' Å³ per atom · ' + ps(s) + ' ps shown';
        capL.innerHTML = '<b>' + l.label + '</b>' + tt(l) + l.natoms + ' atoms · ' + l.cn.toFixed(1) + ' neighbours · ' + l.vol_per_atom.toFixed(1) + ' Å³ per atom · ' + ps(l) + ' ps shown';
        var dv = (l.vol_per_atom / s.vol_per_atom - 1) * 100;
        out.textContent = el + ' on melting: neighbours ' + s.cn.toFixed(1) + ' → ' + l.cn.toFixed(1) + '  ·  volume ' + (dv >= 0 ? '+' : '') + dv.toFixed(1) + ' %' +
          (dv < 0 ? '  ·  the liquid is denser than the crystal' : '') + '  ·  ' + VIEWHINT;
      }
      function draw() { vS.draw(); vL.draw(); }
      function full() { caps(); drawGr(); draw(); }
      function frame(ts) { if (running && visible && ts - last > 40) { last = ts; F++; draw(); } requestAnimationFrame(frame); }
      pick.addEventListener('change', full);
      play.addEventListener('click', function () { running = !running; play.textContent = running ? 'Pause' : 'Play'; });
      play.textContent = running ? 'Pause' : 'Play';
      watch(root, function (v) { visible = v; });
      onResize(full); full(); requestAnimationFrame(frame);
    });
  }

  /* ------------------------------------------------- what MACE "sees": the cutoff ---
   * Ideal crystals (measured lattices, CRYSTALS below). The translucent sphere is MACE-OMAT-0's 6 Å
   * cutoff around the white atom; atoms inside it are bright and counted. The second shell (12 Å)
   * is how far information reaches after two message-passing layers. */
  function crystalPts(k) {
    var C = CRYSTALS[k], M, B;
    if (C.kind === 'fcc' || C.kind === 'diamond') {
      var a = C.a; M = [[a, 0, 0], [0, a, 0], [0, 0, a]];
      B = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]];
      if (C.kind === 'diamond') B = B.concat(B.map(function (p) { return [p[0] + 0.25, p[1] + 0.25, p[2] + 0.25]; }));
    } else {                                          // A7 in the hexagonal setting, atoms at ±z on the R-centred sites
      M = [[C.a, 0, 0], [-C.a / 2, C.a * Math.sqrt(3) / 2, 0], [0, 0, C.c]]; B = [];
      [[0, 0, 0], [2 / 3, 1 / 3, 1 / 3], [1 / 3, 2 / 3, 2 / 3]].forEach(function (t) { [C.z, -C.z].forEach(function (s) { B.push([t[0], t[1], t[2] + s]); }); });
    }
    var cart = function (f) { return [0, 1, 2].map(function (k2) { return f[0] * M[0][k2] + f[1] * M[1][k2] + f[2] * M[2][k2]; }); };
    var c0 = cart(B[0]), pts = [], R = 12.5, n = 6;
    for (var i = -n; i <= n; i++) for (var j = -n; j <= n; j++) for (var l = -n; l <= n; l++) B.forEach(function (b) {
      var p = cart([b[0] + i, b[1] + j, b[2] + l]), d = Math.hypot(p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]);
      if (d <= R) pts.push([p[0] - c0[0], p[1] - c0[1], p[2] - c0[2], d]);
    });
    return pts;
  }
  function cutoff(root) {
    var cvs = root.querySelectorAll('canvas.m-cut'), two = $(root, '.m-lay2'), out = $(root, '.fig-out'), grp = [], spin = !reduced, visible = true;
    var RC = MACE_RC.value;
    var views = Array.prototype.map.call(cvs, function (cv) {
      var k = cv.dataset.xtal, C = CRYSTALS[k], pts = crystalPts(k), el = C.el;
      var n1 = pts.filter(function (p) { return p[3] > 1e-6 && p[3] <= RC + 1e-6; }).length,
          n2 = pts.filter(function (p) { return p[3] > 1e-6 && p[3] <= 2 * RC + 1e-6; }).length;
      cv.dataset.n1 = n1; cv.dataset.n2 = n2;
      function sphere(c, P, r, fillA, dash) {
        var q = P(0, 0, 0), R = r * P.sc, gr = c.createRadialGradient(q[0] - R * 0.3, q[1] - R * 0.3, R * 0.1, q[0], q[1], R);
        gr.addColorStop(0, 'rgba(217,178,111,' + fillA * 0.5 + ')'); gr.addColorStop(1, 'rgba(217,178,111,' + fillA * 1.6 + ')');
        c.fillStyle = gr; c.beginPath(); c.arc(q[0], q[1], R, 0, 6.2832); c.fill();
        c.strokeStyle = dash ? 'rgba(217,178,111,0.5)' : GOLD; c.setLineDash(dash ? [5, 4] : []); c.lineWidth = 1.3; c.stroke(); c.setLineDash([]); c.lineWidth = 1;
      }
      return viewer(cv, {
        group: grp, onGrab: function () { spin = false; },
        scene: function () {
          var big = two.checked, lim = big ? 2 * RC + 0.3 : RC + 2.4, at = [];
          pts.forEach(function (p) {
            if (p[3] > lim) return;
            if (p[3] < 1e-6) at.push([p[0], p[1], p[2], WHITE, RAD[el] * 1.15]);
            else if (p[3] <= RC + 1e-6) at.push([p[0], p[1], p[2], EL[el], RAD[el]]);
            else if (big && p[3] <= 2 * RC + 1e-6) at.push([p[0], p[1], p[2], EL[el], RAD[el] * 0.7, 0.4]);
            else at.push([p[0], p[1], p[2], '#6B7178', RAD[el] * 0.6, 0.35]);
          });
          return { atoms: at, corners: null, centre: [0, 0, 0], ext: lim };
        },
        under: function (c, P) { if (two.checked) sphere(c, P, 2 * RC, 0.025, true); sphere(c, P, RC, 0.07, false); },
        over: function (c, P, s, g) {
          c.textAlign = 'left'; c.fillStyle = WHITE; c.font = '500 12px "IBM Plex Mono", monospace'; c.fillText(C.label, 10, 18);
          c.font = '11px "IBM Plex Mono", monospace'; c.fillStyle = GOLD; c.fillText(n1 + ' atoms inside ' + RC + ' Å', 10, 34);
          if (two.checked) { c.fillStyle = 'rgba(217,178,111,0.75)'; c.fillText(n2 + ' inside ' + 2 * RC + ' Å', 10, 49); }
        }
      });
    });
    function drawAll() {
      views.forEach(function (v) { v.draw(); });
      out.textContent = two.checked
        ? 'Two layers: each neighbour has already gathered its own 6 Å surroundings, so information reaches 12 Å, a few hundred atoms. ' + VIEWHINT
        : 'One layer: the white atom’s energy depends only on the bright atoms inside the 6 Å sphere. ' + VIEWHINT;
    }
    var last = 0;
    function frame(ts) {
      if (spin && visible && ts - last > 33) { last = ts; views.forEach(function (v) { v.V.yaw += 0.006; }); views.forEach(function (v) { v.draw(); }); }
      requestAnimationFrame(frame);
    }
    two.addEventListener('change', drawAll); watch(root, function (v) { visible = v; });
    onResize(drawAll); drawAll(); requestAnimationFrame(frame);
  }

  /* --------------------------------------------------------- coexistence slab ---
   * Pb, 1,024 atoms, half crystal and half liquid in one long periodic box; the long axis runs left to right.
   * Gold = crystal-like surroundings (averaged q6 > 0.33), blue = liquid-like. Frames are saved every 0.5 ps;
   * positions in between are interpolated (shortest path across the periodic box) so the motion is smooth. */
  function coex(root) {
    var cvs = root.querySelectorAll('canvas.m-slab'), cvF = $(root, 'canvas.m-frac'), play = $(root, '.m-play'),
        scrub = $(root, '.m-t'), out = $(root, '.fig-out');
    getJ(root.dataset.src).then(function (J) {
      var keys = ['590', '663'], R = keys.map(function (k) {
        var x = J.runs[k]; return { J: x, P: u16(x.pos), F: u8(x.flags), tsh: x.shown.map(function (i) { return x.t_ps[i]; }) };
      });
      var tmax = Math.max.apply(null, R.map(function (r) { return r.J.t_ps[r.J.t_ps.length - 1]; })), t = 0, running = !reduced, visible = true, last = 0, grp = [];
      scrub.max = tmax.toFixed(1);
      function at(r) {                     // frame index + interpolation weight at time t (held at the last frame once a run ends)
        var n = r.tsh.length, k = 0;
        if (t >= r.tsh[n - 1]) return [n - 1, 0];
        while (k + 2 < n && r.tsh[k + 1] <= t) k++;
        return [k, Math.max(0, Math.min(1, (t - r.tsh[k]) / (r.tsh[k + 1] - r.tsh[k])))];
      }
      var views = Array.prototype.map.call(cvs, function (cv, ki) {
        var r = R[ki];
        return viewer(cv, {
          group: grp, home: { yaw: 0.1, pit: 0.28, zoom: 1, px: 0, py: 8 },
          fit: function (g, s) { return Math.min(g.w * 0.47 / (s.L[2] / 2), (g.h - 22) * 0.5 / (Math.hypot(s.L[0], s.L[1]) / 2)); },
          scene: function () {
            var fw = at(r), f = fw[0], w = fw[1], f1 = Math.min(f + 1, r.tsh.length - 1), N = r.J.natoms, nb = Math.ceil(N / 8);
            var L0 = r.J.box[f], L1 = r.J.box[f1], L = [0, 1, 2].map(function (k) { return L0[k] + w * (L1[k] - L0[k]); }), atoms = [];
            var fl = w < 0.5 ? f : f1;
            var lo = r.J.lo, hi = r.J.hi, Lw = [L[2], L[1], L[0]];
            for (var i = 0; i < N; i++) {
              var o = (f * N + i) * 3, o1 = (f1 * N + i) * 3, q = [];
              for (var k = 0; k < 3; k++) { var a = r.P[o + k], b2 = r.P[o1 + k], u = lo[k] + (a + w * (b2 - a)) / 65535 * (hi[k] - lo[k]); q.push(u * L[k]); }
              var cr = (r.F[fl * nb + (i >> 3)] >> (i & 7)) & 1;
              images(atoms, q[2], q[1], q[0], Lw, cr ? GOLD : BLUE, 1.25);      // world x = the long axis
            }
            return { atoms: atoms, corners: box8([L[2], L[1], L[0]]), centre: [L[2] / 2, L[1] / 2, L[0] / 2], ext: L[2] / 2, L: L, f: f };
          },
          over: function (c, P, s, g) {
            var fr = r.J.frac_crystal[r.J.shown[s.f]];
            c.fillStyle = WHITE; c.textAlign = 'left'; c.font = '11px "IBM Plex Mono", monospace';
            c.fillText(r.J.T + ' K  ·  ' + Math.round(fr * 100) + ' % crystal-like  ·  ' + (r.J.verdict === 'GROW' ? 'the crystal grows' : 'the crystal melts'), 10, 15);
          }
        });
      });
      function drawFrac() {
        var g = ctx2d(cvF), c = g.c, a = axes(g, { x0: 0, x1: Math.ceil(tmax / 10) * 10, y0: 0, y1: 1, xt: [0, 20, 40, 60, 80], yt: [0, 0.5, 1], xl: 'time (ps)', yl: 'crystal fraction', L: 40 });
        R.forEach(function (r, k) {
          c.strokeStyle = k ? BLUE : GOLD; c.lineWidth = 1.8; c.beginPath();
          r.J.t_ps.forEach(function (tt, i) { var X = a.X(tt), Y = a.Y(r.J.frac_crystal[i]); if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.stroke();
          c.fillStyle = k ? BLUE : GOLD; c.textAlign = 'right'; var n = r.J.t_ps.length - 1;
          c.fillText(r.J.T + ' K', a.X(r.J.t_ps[n]) - 4, a.Y(r.J.frac_crystal[n]) - 6);
        });
        c.lineWidth = 1; c.strokeStyle = WHITE; c.beginPath(); c.moveTo(a.X(t), a.T); c.lineTo(a.X(t), g.h - a.B); c.stroke();
      }
      function draw() { views.forEach(function (v) { v.draw(); }); drawFrac(); scrub.value = t; out.textContent = 't = ' + t.toFixed(1) + ' ps  ·  ' + VIEWHINT; }
      function frame(ts) {
        if (running && visible) { if (!last) last = ts; var dt = Math.min(0.1, (ts - last) / 1000); last = ts; t += dt * 4; if (t > tmax + 2) t = 0; draw(); }
        else last = 0;
        requestAnimationFrame(frame);
      }
      scrub.addEventListener('input', function () { t = +scrub.value; draw(); });
      play.addEventListener('click', function () { running = !running; play.textContent = running ? 'Pause' : 'Play'; });
      play.textContent = running ? 'Pause' : 'Play';
      watch(root, function (v) { visible = v; });
      onResize(draw); draw(); requestAnimationFrame(frame);
    });
  }

  /* ----------------------------------------- structure gallery (port of report 002) ---
   * Measured crystal beside the MACE cell after its run, every atom flagged crystal-like (gold) or
   * liquid-like (blue) by the same local-order test the report uses. Static cells; all panes rotate together. */
  function gallery(root) {
    var box = $(root, '.m-gal');
    getJ(root.dataset.src).then(function (J) {
      var grp = [];
      J.gallery.forEach(function (T) {
        var fig = document.createElement('figure'), cv = document.createElement('canvas'), cap = document.createElement('figcaption');
        cv.setAttribute('aria-label', T.title); fig.appendChild(cv); fig.appendChild(cap); box.appendChild(fig);
        var badge = { SOLID: GOLD, LIQUID: BLUE, MIXED: LILAC }[T.badge] || INK;
        cap.innerHTML = '<b>' + T.title + '</b>' + T.sub + ' · <span style="color:' + badge + '">' + T.badge.toLowerCase() + '</span>';
        // the report rotated each cell so c points up the screen (to_up); undo it so c is this viewer's vertical
        var M = T.lat.map(function (v) { return [v[0], -v[2], v[1]]; }), fr = u16(T.frac), sol = u8(T.solid), at = [];
        for (var i = 0; i < T.n; i++) {
          var f = [fr[3 * i] / 65535, fr[3 * i + 1] / 65535, fr[3 * i + 2] / 65535];
          var p = [0, 1, 2].map(function (k) { return f[0] * M[0][k] + f[1] * M[1][k] + f[2] * M[2][k]; });
          at.push([p[0], p[1], p[2], (sol[i >> 3] >> (i & 7)) & 1 ? GOLD : BLUE, RAD[T.sp] || 1.1]);
        }
        var C = cell8(M), cen = [0, 1, 2].map(function (k) { return (C[0][k] + C[6][k]) / 2; }),
            ext = Math.max.apply(null, C.map(function (q) { return Math.hypot(q[0] - cen[0], q[1] - cen[1], q[2] - cen[2]); })) * 0.85;
        viewer(cv, { group: grp, scene: function () { return { atoms: at, corners: C, centre: cen, ext: ext }; } });
      });
      function drawAll() { grp.forEach(function (v) { v.draw(); }); }
      onResize(drawAll); drawAll();
    });
  }

  /* --------------------------------------- melting bracket v(T) (port of report 002) ---
   * Every graded slab run: the interface velocity (+ = the crystal grows). Extraction: average the seeds at each
   * temperature, find the two neighbouring temperatures where the mean changes sign, and interpolate linearly to
   * v = 0 (report 002 tm_mace). Drawn only where it agrees with the model T_m in TABLE to 10 K; Bi's T_m comes from
   * a finer ladder of short runs that is not drawn. Hover a dot for its run. */
  var VCOL = { GROW: GOLD, MELT: BLUE, QUIET: INK, invalid: 'rgba(242,243,240,0.35)' },
      VWORD = { GROW: 'the crystal grows', MELT: 'the crystal melts', QUIET: 'no clear motion', invalid: 'failed a start-up check, not used' };
  function zeroCross(rows) {
    var by = {};
    rows.forEach(function (q) { if (q.cls !== 'invalid') (by[q.T] = by[q.T] || []).push(q.v); });
    var m = Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (T) {
      return [T, by[T].reduce(function (a, b) { return a + b; }, 0) / by[T].length];
    });
    for (var i = 0; i + 1 < m.length; i++) if (m[i][1] > 0 && m[i + 1][1] <= 0)
      return { T: m[i][0] + (m[i + 1][0] - m[i][0]) * m[i][1] / (m[i][1] - m[i + 1][1]), a: m[i], b: m[i + 1] };
    return null;
  }
  function vtPanel(cv, el, rows, big) {
    var r = row(el), g = ctx2d(cv), c = g.c, hit = [];
    var Ts = rows.map(function (q) { return q.T; }).concat([r.Tx], big && r.Tmtp ? [r.Tmtp] : []), vs = rows.map(function (q) { return q.v; });
    var x0 = Math.floor((Math.min.apply(null, Ts) - 20) / 20) * 20, x1 = Math.ceil((Math.max.apply(null, Ts) + 20) / 20) * 20;
    var vm = Math.max(0.05, Math.max.apply(null, vs.map(Math.abs))) * 1.15, yt = vm > 0.2 ? [-0.2, -0.1, 0, 0.1, 0.2] : vm > 0.1 ? [-0.1, 0, 0.1] : [-0.05, 0, 0.05];
    var span = x1 - x0, step = span > 500 ? 200 : span > 250 ? 100 : span > 120 ? 50 : 20, xt = [];
    for (var x = Math.ceil(x0 / step) * step; x <= x1; x += step) xt.push(x);
    var a = axes(g, { x0: x0, x1: x1, y0: -vm, y1: vm, xt: xt, yt: yt.filter(function (v) { return Math.abs(v) <= vm; }), xl: 'temperature (K)', yl: 'interface velocity (Å/ps)', L: 48, T: 22 });
    c.strokeStyle = RULE; c.beginPath(); c.moveTo(a.L, a.Y(0)); c.lineTo(g.w - a.R, a.Y(0)); c.stroke();
    if (r.Tlo) { c.fillStyle = 'rgba(169,155,201,0.22)'; c.fillRect(a.X(r.Tlo), a.T, Math.max(2, a.X(r.Thi) - a.X(r.Tlo)), g.h - a.B - a.T); }
    c.setLineDash([4, 3]); c.strokeStyle = 'rgba(242,243,240,0.6)'; c.beginPath(); c.moveTo(a.X(r.Tx), a.T); c.lineTo(a.X(r.Tx), g.h - a.B); c.stroke();
    if (big && r.Tmtp) { c.setLineDash([1.5, 3]); c.strokeStyle = LILAC; c.beginPath(); c.moveTo(a.X(r.Tmtp), a.T); c.lineTo(a.X(r.Tmtp), g.h - a.B); c.stroke(); }
    c.setLineDash([]);
    var z = zeroCross(rows), ok = z && r.Tm && Math.abs(z.T - r.Tm) <= 10;
    if (ok) {
      c.strokeStyle = WHITE; c.lineWidth = 1.4; c.beginPath(); c.moveTo(a.X(z.a[0]), a.Y(z.a[1])); c.lineTo(a.X(z.b[0]), a.Y(z.b[1])); c.stroke(); c.lineWidth = 1;
      [z.a, z.b].forEach(function (p) { c.strokeStyle = WHITE; c.strokeRect(a.X(p[0]) - 3.5, a.Y(p[1]) - 3.5, 7, 7); });
      var X = a.X(z.T), Y = a.Y(0); c.strokeStyle = WHITE; c.lineWidth = 2; c.beginPath(); c.moveTo(X - 5, Y - 5); c.lineTo(X + 5, Y + 5); c.moveTo(X - 5, Y + 5); c.lineTo(X + 5, Y - 5); c.stroke(); c.lineWidth = 1;
    }
    rows.forEach(function (q) {
      var X = a.X(q.T) + (q.seed === 2 ? 3 : -3), Y = a.Y(q.v), rad = big ? 4.5 : 3.6; c.beginPath(); c.arc(X, Y, rad, 0, 6.2832);
      if (q.cls === 'invalid') { c.strokeStyle = VCOL.invalid; c.stroke(); } else { c.fillStyle = VCOL[q.cls] || INK; c.fill(); }
      hit.push([X, Y, q]);
    });
    c.fillStyle = WHITE; c.textAlign = 'left'; c.font = '500 12px "IBM Plex Mono", monospace'; c.fillText(el, a.L + 4, 14);
    c.font = '10px "IBM Plex Mono", monospace'; c.textAlign = 'right';
    c.fillStyle = INK; c.fillText((ok ? 'v = 0 at ' + Math.round(z.T) + ' K · ' : '') + 'model ' + (r.Tm ? r.Tm + ' K' : '—') + ' · measured ' + r.Tx + ' K', g.w - 6, 14);
    c.textAlign = 'left'; c.fillStyle = INK; c.fillText('grows ↑', a.L + 4, a.T + 12); c.fillText('melts ↓', a.L + 4, g.h - a.B - 5);
    if (big) {
      c.textAlign = 'left'; c.fillStyle = 'rgba(242,243,240,0.75)'; c.fillText('measured', a.X(r.Tx) + 4, g.h - a.B - 18);
      if (r.Tmtp) { c.fillStyle = LILAC; c.fillText('fitted MTP', a.X(r.Tmtp) - 64, a.T + 26); }
    }
    return { hit: hit, z: ok ? z : null };
  }
  function hover(cv, getHit, out, fmt, idle) {
    cv.addEventListener('pointermove', function (e) {
      var b = cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top, best = null, bd = 144;
      getHit().forEach(function (h) { var d = (h[0] - mx) * (h[0] - mx) + (h[1] - my) * (h[1] - my); if (d < bd) { bd = d; best = h; } });
      out.textContent = best ? fmt(best[2]) : idle();
      cv.style.cursor = best ? 'crosshair' : 'default';
    });
    cv.addEventListener('pointerleave', function () { out.textContent = idle(); });
  }
  function runText(el) { return function (q) { return el + ' · ' + q.T + ' K · seed ' + q.seed + ' · v = ' + (q.v >= 0 ? '+' : '') + q.v.toFixed(3) + ' Å/ps · ' + VWORD[q.cls] + (q.motion_ps ? ' · ' + q.motion_ps + ' ps run' : ''); }; }
  function vt(root) {
    var cvs = root.querySelectorAll('canvas.m-vt'), out = $(root, '.fig-out');
    getJ(root.dataset.src).then(function (J) {
      var H = {}, idle = function () { return 'Hover a dot to see its run. The white line joins the seed averages either side of zero; × marks v = 0.'; };
      function draw() { Array.prototype.forEach.call(cvs, function (cv) { H[cv.dataset.el] = vtPanel(cv, cv.dataset.el, J.vt[cv.dataset.el] || [], cv.classList.contains('m-big')).hit; }); }
      Array.prototype.forEach.call(cvs, function (cv) { hover(cv, function () { return H[cv.dataset.el] || []; }, out, runText(cv.dataset.el), idle); });
      onResize(draw); draw(); out.textContent = idle();
    });
  }

  /* -------------------------------------- electronic DOS near E_F (port of report 002) ---
   * VASP density of states per atom, averaged over MACE frames of each phase. Electronic entropy comes from
   * states within a few k_B T of the Fermi level E_F, so the gap between the curves at E = 0 is what matters. */
  function dos(root) {
    var cvs = root.querySelectorAll('canvas.m-dos');
    getJ(root.dataset.src).then(function (J) {
      var out = $(root, '.fig-out'), G = {};
      function draw() {
        Array.prototype.forEach.call(cvs, function (cv) {
          var el = cv.dataset.el, D = J.dos[el], g = ctx2d(cv), c = g.c;
          if (!D || !D.solid || !D.liquid) return;
          var all = [];
          [D.solid, D.liquid].forEach(function (ph) { ph.frames.forEach(function (f) { all = all.concat(f); }); });
          var ym = Math.ceil(Math.max.apply(null, all) * 1.05 * 10) / 10, x0 = D.E[0], x1 = D.E[D.E.length - 1], xt = [];
          for (var x = Math.ceil(x0 / 2) * 2; x <= x1; x += 2) xt.push(x);
          var a = axes(g, { x0: x0, x1: x1, y0: 0, y1: ym, xt: xt, yt: [0, +(ym / 2).toFixed(2), ym], xl: 'E − E_F (eV)', yl: 'DOS (states / eV / atom)', L: 44, T: 20 });
          c.fillStyle = 'rgba(242,243,240,0.05)'; c.fillRect(a.X(-0.25), a.T, a.X(0.25) - a.X(-0.25), g.h - a.B - a.T);
          c.setLineDash([3, 3]); c.strokeStyle = 'rgba(242,243,240,0.45)'; c.beginPath(); c.moveTo(a.X(0), a.T); c.lineTo(a.X(0), g.h - a.B); c.stroke(); c.setLineDash([]);
          function line(y, col, w, al) {
            c.strokeStyle = col; c.globalAlpha = al; c.lineWidth = w; c.beginPath();
            D.E.forEach(function (e, i) { var X = a.X(e), Y = a.Y(y[i]); if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }); c.stroke(); c.globalAlpha = 1; c.lineWidth = 1;
          }
          [[D.solid, GOLD], [D.liquid, BLUE]].forEach(function (p) { p[0].frames.forEach(function (f) { line(f, p[1], 0.8, 0.28); }); });
          [[D.solid, GOLD], [D.liquid, BLUE]].forEach(function (p) { line(p[0].mean, p[1], 2.2, 1); });
          c.fillStyle = WHITE; c.textAlign = 'left'; c.font = '500 12px "IBM Plex Mono", monospace';
          c.fillText(el + ', ' + Math.round(D.T) + ' K', a.L + 6, 14);
          G[el] = { a: a, D: D };
        });
      }
      var idle = function () { return 'Hover a panel to read the averaged crystal and liquid DOS at that energy.'; };
      Array.prototype.forEach.call(cvs, function (cv) {
        cv.addEventListener('pointermove', function (e) {
          var q = G[cv.dataset.el]; if (!q) return;
          var b = cv.getBoundingClientRect(), mx = e.clientX - b.left, E = q.D.E, k = 0, best = 1e9;
          E.forEach(function (x, i) { var d = Math.abs(q.a.X(x) - mx); if (d < best) { best = d; k = i; } });
          out.textContent = cv.dataset.el + ' · E − E_F = ' + E[k].toFixed(2) + ' eV · crystal ' + q.D.solid.mean[k].toFixed(3) + ' · liquid ' + q.D.liquid.mean[k].toFixed(3) + ' states/eV/atom (mean of ' + q.D.solid.n + ' and ' + q.D.liquid.n + ' snapshots)';
        });
        cv.addEventListener('pointerleave', function () { out.textContent = idle(); });
      });
      out.textContent = idle();
      onResize(draw); draw();
    });
  }

  /* ---------------------------------------------- model T_m and dS_fus vs measured --- */
  function compare(root) {
    var cv = $(root, 'canvas.m-cmp'), what = $(root, '.m-what'), out = $(root, '.fig-out'), leg = $(root, '.legend');
    function dot(c, x, y, col, r) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r || 4.5, 0, 6.2832); c.fill(); }
    function draw() {
      var g = ctx2d(cv), c = g.c, m = what.value, rows = TABLE, n = rows.length;
      if (m === 'tm') {
        var a = axes(g, { x0: 0.5, x1: 1.15, y0: 0, y1: n, xt: [0.6, 0.7, 0.8, 0.9, 1.0, 1.1], xl: 'melting point ÷ measured', L: 40 });
        c.setLineDash([3, 3]); c.strokeStyle = SAGE; c.beginPath(); c.moveTo(a.X(1), a.T); c.lineTo(a.X(1), g.h - a.B); c.stroke(); c.setLineDash([]);
        rows.forEach(function (r, i) {
          var y = a.Y(n - i - 0.5); c.fillStyle = WHITE; c.textAlign = 'right'; c.fillText(r.el, a.L - 8, y + 3);
          if (r.Tmtp) dot(c, a.X(r.Tmtp / r.Tx), y, LILAC, 4);
          if (r.Tm) { c.strokeStyle = GOLD; c.beginPath(); c.moveTo(a.X(r.Tlo / r.Tx), y); c.lineTo(a.X(r.Thi / r.Tx), y); c.stroke(); dot(c, a.X(r.Tm / r.Tx), y, GOLD); c.fillStyle = INK; c.textAlign = 'left'; c.fillText(r.Tm + ' K vs ' + r.Tx, a.X(Math.max(r.Thi, r.Tmtp || 0) / r.Tx) + 8, y + 3); }
          else { c.fillStyle = ROSE; c.textAlign = 'left'; c.fillText('crystal lost before melting', a.X(0.52), y + 3); }
        });
        leg.innerHTML = '<span><i style="background:#D9B26F"></i>MACE-OMAT-0 (this project)</span><span><i style="background:#A99BC9"></i>MTP (thesis)</span><span><i style="background:#8FA095"></i>measured = 1</span>';
        out.textContent = 'The model melts Pb within 2 % of experiment, but Bi, Ge, Zn and Si 14–34 % low.';
      } else if (m === 'fus') {
        var b = axes(g, { x0: 0, x1: 4.2, y0: 0, y1: n, xt: [0, 1, 2, 3, 4], xl: 'ΔS_fus (kB / atom)', L: 40 });
        rows.forEach(function (r, i) {
          var y = b.Y(n - i - 0.5); c.fillStyle = WHITE; c.textAlign = 'right'; c.fillText(r.el, b.L - 8, y + 3);
          dot(c, b.X(r.fx), y - 5, SAGE);
          if (r.fh != null) dot(c, b.X(r.fh), y, LILAC, 4);
          if (r.fm != null) { c.strokeStyle = GOLD; c.beginPath(); c.moveTo(b.X(r.fm - r.sfm), y + 5); c.lineTo(b.X(r.fm + r.sfm), y + 5); c.stroke(); dot(c, b.X(r.fm), y + 5, GOLD); }
          else { c.fillStyle = ROSE; c.textAlign = 'left'; c.fillText('no model melting point', b.X(r.fx) + 10, y + 3); }
        });
        leg.innerHTML = '<span><i style="background:#8FA095"></i>measured</span><span><i style="background:#A99BC9"></i>computed in the thesis (MTP)</span><span><i style="background:#D9B26F"></i>MACE-OMAT-0, at its own T_m</span>';
        out.textContent = 'Each value is the latent heat divided by the melting point of the same model.';
      } else {
        var e = axes(g, { x0: 0, x1: 0.22, y0: 0, y1: n, xt: [0, 0.05, 0.1, 0.15, 0.2], xl: 'ΔS_el, electronic entropy of fusion (kB / atom)', L: 40 });
        rows.forEach(function (r, i) {
          var y = e.Y(n - i - 0.5); c.fillStyle = WHITE; c.textAlign = 'right'; c.fillText(r.el, e.L - 8, y + 3);
          if (r.el_h != null) dot(c, e.X(r.el_h), y - 4, LILAC, 4);
          if (r.el_m != null) { dot(c, e.X(r.el_m), y + 4, r.prelim_el ? 'rgba(217,178,111,0.55)' : GOLD); }
          if (r.el_h == null && r.el_m == null) { c.fillStyle = INK; c.textAlign = 'left'; c.fillText('in progress', e.X(0.005), y + 3); }
        });
        leg.innerHTML = '<span><i style="background:#A99BC9"></i>thesis (DFT)</span><span><i style="background:#D9B26F"></i>this project (DFT on MACE snapshots)</span><span><i style="background:rgba(217,178,111,0.55)"></i>preliminary</span>';
        out.textContent = 'At each model melting point: Pb 0.008 vs 0.07 in the thesis, Ge 0.10 vs 0.16, Si 0.16 vs 0.19. Bi had no value; the first estimate is 0.08.';
      }
    }
    what.addEventListener('change', draw); onResize(draw); draw();
  }

  var FIGS = { gibbs: gibbs, fus: fus, cells: cells, cutoff: cutoff, coex: coex, compare: compare, gallery: gallery, vt: vt, dos: dos };
  function init() {
    document.querySelectorAll('[data-melt]').forEach(function (el) {
      var f = FIGS[el.dataset.melt]; if (f) { try { if (el.dataset.src) lazy(el, f); else f(el); } catch (err) { if (window.console) console.error(err); } }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
