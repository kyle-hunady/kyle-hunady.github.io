/* A small 2-D molecular dynamics toy.
 *
 * Lennard-Jones particles in reduced units (epsilon = sigma = mass = 1),
 * velocity-Verlet integration, periodic box, Berendsen thermostat.
 * Two modes:
 *   pure  : one species, atoms colored by local hexagonal order |psi6|
 *           (near 1 = crystal-like surroundings, low = defect or liquid)
 *   alloy : five species with sizes spread +-8 %, colored by species, to
 *           show how atomic-size mismatch strains a close-packed lattice.
 * It is a toy. 2-D melting is not 3-D melting, and nothing here is fitted to
 * a real metal.
 *
 *   const sim = new MDSim(canvas, { n: 16, auto: true });
 */
(function () {
  'use strict';

  var SPECIES = [
    { sigma: 0.92, color: '#8FA095' },
    { sigma: 0.96, color: '#D9B26F' },
    { sigma: 1.00, color: '#7FA7C9' },
    { sigma: 1.04, color: '#C98A7F' },
    { sigma: 1.08, color: '#B9A6D3' }
  ];
  var CRYSTAL = '#8FA095', DEFECT = '#D9B26F';
  var DT = 0.004, TAU = 0.08, RC = 2.5, FMAX = 400;

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function MDSim(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cols = opts.cols || 18;          // atoms per row
    this.rows = opts.rows || 14;          // rows (even, for periodic triangular lattice)
    this.auto = !!opts.auto;              // thumbnail mode: cycle melt/freeze by itself
    this.mode = opts.mode || 'pure';
    this.T = opts.T != null ? opts.T : 0.15;
    this.targetT = this.T;
    this.stepsPerFrame = opts.stepsPerFrame || 6;
    this.onFrame = opts.onFrame || null;
    this.running = false;
    this.visible = true;
    this.time = 0;
    this.history = [];                    // {t, T, pe}
    this.reset();
    this.resize();

    var self = this;
    window.addEventListener('resize', function () { self.resize(); self.draw(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        self.visible = es[0].isIntersecting;
        if (self.visible && self.running) self.loop();
      }).observe(canvas);
    }
    if (!reducedMotion() && opts.autostart !== false) this.play();
    else this.draw();
  }

  MDSim.prototype.reset = function () {
    var a = Math.pow(2, 1 / 6) * 1.0 * 1.05;        // nearest-neighbor spacing, a little expanded so it can melt
    var cols = this.cols, rows = this.rows;
    this.Lx = cols * a;
    this.Ly = rows * a * Math.sqrt(3) / 2;
    var n = cols * rows;
    this.n = n;
    this.x = new Float64Array(n); this.y = new Float64Array(n);
    this.vx = new Float64Array(n); this.vy = new Float64Array(n);
    this.fx = new Float64Array(n); this.fy = new Float64Array(n);
    this.sp = new Uint8Array(n);
    this.coord = new Uint8Array(n);
    this.qc = new Float64Array(n); this.qs = new Float64Array(n); this.order = new Uint8Array(n);
    var k = 0;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        this.x[k] = (c + (r % 2) * 0.5 + 0.25) * a;
        this.y[k] = (r + 0.5) * a * Math.sqrt(3) / 2;
        this.sp[k] = this.mode === 'alloy' ? Math.floor(Math.random() * 5) : 2;
        k++;
      }
    }
    // Maxwell-ish velocities at the current temperature, zero net momentum.
    var px = 0, py = 0;
    for (var i = 0; i < n; i++) {
      this.vx[i] = gauss() * Math.sqrt(this.T); this.vy[i] = gauss() * Math.sqrt(this.T);
      px += this.vx[i]; py += this.vy[i];
    }
    for (i = 0; i < n; i++) { this.vx[i] -= px / n; this.vy[i] -= py / n; }
    this.time = 0;
    this.history = [];
    this.forces();
  };

  MDSim.prototype.setMode = function (mode) { this.mode = mode; this.reset(); this.draw(); };

  MDSim.prototype.forces = function () {
    var n = this.n, x = this.x, y = this.y, fx = this.fx, fy = this.fy;
    var Lx = this.Lx, Ly = this.Ly, sp = this.sp, coord = this.coord;
    var pe = 0, i, j;
    var qc = this.qc, qs = this.qs;
    for (i = 0; i < n; i++) { fx[i] = 0; fy[i] = 0; coord[i] = 0; qc[i] = 0; qs[i] = 0; }
    for (i = 0; i < n; i++) {
      var si = SPECIES[sp[i]].sigma;
      for (j = i + 1; j < n; j++) {
        var dx = x[i] - x[j], dy = y[i] - y[j];
        if (dx > Lx / 2) dx -= Lx; else if (dx < -Lx / 2) dx += Lx;
        if (dy > Ly / 2) dy -= Ly; else if (dy < -Ly / 2) dy += Ly;
        var s = 0.5 * (si + SPECIES[sp[j]].sigma);
        var r2 = dx * dx + dy * dy, rc = RC * s;
        if (r2 > rc * rc) continue;
        if (r2 < 1.4 * 1.4 * s * s) {
          coord[i]++; coord[j]++;
          var th6 = 6 * Math.atan2(dy, dx), c6 = Math.cos(th6), s6 = Math.sin(th6);
          qc[i] += c6; qs[i] += s6; qc[j] += c6; qs[j] += s6;   // 6(theta+pi) = 6 theta mod 2 pi
        }
        var ir2 = s * s / r2, ir6 = ir2 * ir2 * ir2;
        var f = 24 * ir6 * (2 * ir6 - 1) / r2;
        if (f > FMAX) f = FMAX;
        fx[i] += f * dx; fy[i] += f * dy;
        fx[j] -= f * dx; fy[j] -= f * dy;
        pe += 4 * ir6 * (ir6 - 1);
      }
    }
    for (i = 0; i < n; i++) {
      var m = coord[i] ? Math.sqrt(qc[i] * qc[i] + qs[i] * qs[i]) / coord[i] : 0;
      this.order[i] = m > 0.8 ? 1 : 0;
    }
    this.pe = pe / n;
  };

  MDSim.prototype.step = function () {
    var n = this.n, i, h = DT;
    for (i = 0; i < n; i++) {
      this.vx[i] += 0.5 * h * this.fx[i]; this.vy[i] += 0.5 * h * this.fy[i];
      this.x[i] += h * this.vx[i]; this.y[i] += h * this.vy[i];
      if (this.x[i] < 0) this.x[i] += this.Lx; else if (this.x[i] >= this.Lx) this.x[i] -= this.Lx;
      if (this.y[i] < 0) this.y[i] += this.Ly; else if (this.y[i] >= this.Ly) this.y[i] -= this.Ly;
    }
    this.forces();
    var ke = 0;
    for (i = 0; i < n; i++) {
      this.vx[i] += 0.5 * h * this.fx[i]; this.vy[i] += 0.5 * h * this.fy[i];
      ke += 0.5 * (this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
    }
    this.T = ke / n;                                  // 2 dof per atom, kB = 1
    // Berendsen: nudge toward the set point instead of snapping to it.
    var lam = Math.sqrt(1 + (h / TAU) * (this.targetT / Math.max(this.T, 1e-6) - 1));
    lam = Math.min(Math.max(lam, 0.9), 1.1);
    for (i = 0; i < n; i++) { this.vx[i] *= lam; this.vy[i] *= lam; }
    this.time += h;
  };

  MDSim.prototype.crystalFraction = function () {
    var c = 0;
    for (var i = 0; i < this.n; i++) if (this.order[i]) c++;
    return c / this.n;
  };

  MDSim.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = this.canvas.clientWidth || 300;
    var h = w * this.Ly / this.Lx;
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = this.canvas.width / this.Lx;
  };

  MDSim.prototype.draw = function () {
    var ctx = this.ctx, s = this.scale, n = this.n;
    ctx.fillStyle = '#0F110F';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (var i = 0; i < n; i++) {
      var sp = SPECIES[this.sp[i]];
      ctx.fillStyle = this.mode === 'alloy' ? sp.color
        : (this.order[i] ? CRYSTAL : DEFECT);
      ctx.beginPath();
      ctx.arc(this.x[i] * s, this.y[i] * s, 0.42 * sp.sigma * s, 0, 6.2832);
      ctx.fill();
    }
  };

  MDSim.prototype.tick = function () {
    if (this.auto) {
      // Thumbnail: heat for a while, then cool, forever. Period ~ 40 time units.
      var ph = (this.time % 40) / 40;
      this.targetT = ph < 0.45 ? 1.1 : 0.08;
    }
    for (var k = 0; k < this.stepsPerFrame; k++) this.step();
    this.history.push({ t: this.time, T: this.T, pe: this.pe, xf: this.crystalFraction() });
    if (this.history.length > 600) this.history.shift();
    this.draw();
    if (this.onFrame) this.onFrame(this);
  };

  MDSim.prototype.loop = function () {
    var self = this;
    if (this._raf) return;
    var frame = function () {
      self._raf = null;
      if (!self.running || !self.visible) return;
      self.tick();
      self._raf = requestAnimationFrame(frame);
    };
    this._raf = requestAnimationFrame(frame);
  };

  MDSim.prototype.play = function () { this.running = true; this.loop(); };
  MDSim.prototype.pause = function () { this.running = false; };

  function gauss() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* A minimal line plot on a canvas, shared by the figure pages. */
  function linePlot(canvas, series, o) {
    o = o || {};
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var L = 40, R = 10, T = 12, B = 26;
    var x0 = o.xmin, x1 = o.xmax, y0 = o.ymin, y1 = o.ymax;
    var X = function (v) { return L + (v - x0) / (x1 - x0) * (w - L - R); };
    var Y = function (v) { return h - B - (v - y0) / (y1 - y0) * (h - T - B); };
    ctx.strokeStyle = 'rgba(242,243,240,0.14)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, T); ctx.lineTo(L, h - B); ctx.lineTo(w - R, h - B); ctx.stroke();
    ctx.fillStyle = 'rgba(242,243,240,0.55)'; ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    (o.yticks || [y0, y1]).forEach(function (v) { ctx.fillText(fmt(v), L - 5, Y(v) + 3); });
    ctx.textAlign = 'center';
    (o.xticks || [x0, x1]).forEach(function (v) { ctx.fillText(fmt(v), X(v), h - B + 13); });
    if (o.xlabel) ctx.fillText(o.xlabel, (L + w - R) / 2, h - 2);
    if (o.ylabel) { ctx.save(); ctx.translate(10, (T + h - B) / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.ylabel, 0, 0); ctx.restore(); }
    series.forEach(function (s) {
      if (s.fill) {
        ctx.fillStyle = s.fill; ctx.beginPath();
        ctx.moveTo(X(s.x[0]), Y(y0));
        for (var i = 0; i < s.x.length; i++) ctx.lineTo(X(s.x[i]), Y(Math.min(Math.max(s.y[i], y0), y1)));
        ctx.lineTo(X(s.x[s.x.length - 1]), Y(y0)); ctx.fill();
      }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 1.6;
      if (s.dash) ctx.setLineDash(s.dash); else ctx.setLineDash([]);
      if (s.dots) {
        ctx.fillStyle = s.color;
        for (var k = 0; k < s.x.length; k++) {
          ctx.beginPath(); ctx.arc(X(s.x[k]), Y(Math.min(Math.max(s.y[k], y0), y1)), s.r || 1.6, 0, 6.2832); ctx.fill();
        }
      } else if (!s.fillOnly) {
        ctx.beginPath();
        for (var m = 0; m < s.x.length; m++) {
          var px = X(s.x[m]), py = Y(Math.min(Math.max(s.y[m], y0), y1));
          if (m) ctx.lineTo(px, py); else ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    });
    if (o.marks) o.marks.forEach(function (mk) {
      ctx.strokeStyle = mk.color || 'rgba(242,243,240,0.4)'; ctx.setLineDash([3, 3]);
      ctx.beginPath();
      if (mk.x != null) { ctx.moveTo(X(mk.x), T); ctx.lineTo(X(mk.x), h - B); }
      else { ctx.moveTo(L, Y(mk.y)); ctx.lineTo(w - R, Y(mk.y)); }
      ctx.stroke(); ctx.setLineDash([]);
      if (mk.label) {
        ctx.fillStyle = mk.color || 'rgba(242,243,240,0.7)'; ctx.textAlign = mk.x != null ? 'left' : 'right';
        if (mk.x != null) ctx.fillText(mk.label, X(mk.x) + 4, T + 10);
        else ctx.fillText(mk.label, w - R - 2, Y(mk.y) - 4);
      }
    });
    return { X: X, Y: Y };
  }
  function fmt(v) {
    var a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 100) return v.toFixed(0);
    if (a >= 10) return v.toFixed(0);
    if (a >= 1) return v.toFixed(1).replace(/\.0$/, '');
    return v.toFixed(2);
  }

  window.MDSim = MDSim;
  window.linePlot = linePlot;
  window.MDSPECIES = SPECIES;
})();
