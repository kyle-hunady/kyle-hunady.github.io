/* cards.js - motion for the project-card thumbnails on index.html.
   The static <img> stays in the card and is what no-JS, reduced-motion and data-saver visitors see.
   A motion layer is laid over it only when motion is allowed, fades in once it is ready, and only
   runs while the card is on screen. Every animation is a function of (time mod period), so the
   loop point has no jump.

   data-motion="lit"  sideways-scrolling strip of paper first pages (assets/img/proj-literature-strip.jpg,
                      built by tools/lit_strip.py; CSS animation, repeat-x so the wrap is seamless)
   data-motion="melt" the two Pb coexistence slabs from melting.html, crystal growing at 590 K and melting at 663 K
   data-motion="mc"   the Monte Carlo head redrawn live: the fe_8mm geometry from mc-story-data.js
                      (montecarlo.html, frame 6), turning 360 deg per loop, photons flying source ->
                      sample -> detector and collecting on the chip. Only the left panel is redrawn;
                      the sextet on the right is the static PNG showing through. */
"use strict";
(function () {
  var thumbs = document.querySelectorAll(".project__thumb[data-motion]");
  if (!thumbs.length || !("IntersectionObserver" in window)) return;
  var RM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var conn = navigator.connection || {};
  var slowNet = !!conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "");

  var live = [];   // {el, layer, start(), stop(), visible}
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var m = live.find(function (x) { return x.el === e.target; }); if (!m) return;
      m.visible = e.isIntersecting; m.visible && !document.hidden ? m.start() : m.stop();
    });
  }, { rootMargin: "80px 0px" });
  document.addEventListener("visibilitychange", function () {
    live.forEach(function (m) { m.visible && !document.hidden ? m.start() : m.stop(); });
  });

  function init() {
    if (RM && RM.matches) return;
    thumbs.forEach(function (el) {
      var kind = el.getAttribute("data-motion"), m = null;
      if (kind === "lit" && !slowNet) m = litStrip(el);
      if (kind === "mc") m = mcHead(el);
      if (kind === "drift") m = drift(el);
      if (kind === "melt" && !slowNet) m = meltSlabs(el);
      if (!m) return;
      m.el = el; m.visible = false; live.push(m); io.observe(el);
    });
  }
  function teardown() {
    live.forEach(function (m) { m.stop(); io.unobserve(m.el); m.layer.remove(); });
    live = [];
  }
  if (RM && RM.addEventListener) RM.addEventListener("change", function () { teardown(); init(); });
  function layerOn(el, node) {
    var d = document.createElement("div"); d.className = "thumb-motion"; d.setAttribute("aria-hidden", "true");
    d.appendChild(node); el.appendChild(d); return d;
  }

  /* ---------------------------------------------------------------- photo drift */
  // a slow push-in and back on the photo itself (CSS, alternate direction, so the loop has no jump)
  function drift(el) {
    el.classList.add("is-drift");
    return { layer: { remove: function () { el.classList.remove("is-drift", "is-on"); } },
      start: function () { el.classList.add("is-on"); }, stop: function () { el.classList.remove("is-on"); } };
  }

  /* ---------------------------------------------------------------- literature strip */
  function litStrip(el) {
    var src = el.getAttribute("data-strip"); if (!src) return null;
    var strip = document.createElement("div"); strip.className = "lit-strip";
    var layer = layerOn(el, strip), img = new Image();
    img.onload = function () {
      strip.style.backgroundImage = "url(" + src + ")";
      strip.style.aspectRatio = (2 * img.naturalWidth) + " / " + img.naturalHeight;   // two copies: translate -50% = one strip
      layer.classList.add("is-ready");
    };
    var loaded = false;
    return { layer: layer,
      start: function () { if (!loaded) { loaded = true; img.src = src; } layer.classList.add("is-on"); },
      stop: function () { layer.classList.remove("is-on"); } };
  }

  /* ---------------------------------------------------------------- Monte Carlo head */
  function mcHead(el) {
    var cv = document.createElement("canvas"), ctx = cv.getContext("2d"); if (!ctx) return null;
    var layer = layerOn(el, cv);
    var IW = 1252, IH = 782, PANEL = 614;          // the PNG's pixel frame; x < PANEL is redrawn
    var BG = "#1f201e", LABEL = "#a3a39b", FONT = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
    var T = 24;                                    // seconds per turn = loop period
    var add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
        sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
        mul = function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
        dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
        cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; },
        norm = function (a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
        basis = function (n) { var u = norm(cross(n, Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])); return [u, cross(n, u)]; };
    var seed = 99; function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    function thetaRGB(th) { var t = Math.max(0, Math.min(1, th / 25)), a = [0x2b, 0x6c, 0xb0], b = [0x80, 0x5a, 0xd5];
      return a.map(function (x, i) { return Math.round(x + (b[i] - x) * t); }); }

    // fe_8mm head (SB.kernels.fe_8mm.config), mm; z up, sample plane at z = ZS
    var S = [-21.1956, 0, 43.2150], F = [0, 0, 0], ZS = 3.3941, STAND = 19.7257, AP = 3.9, SRC = 4,
        D = [6.3990, 0, 27.1859], DET = 3.85;
    var n = norm(sub(F, S)), uv = basis(n), u = uv[0], v = uv[1], A = add(S, mul(n, STAND)), back = mul(n, -1);
    var dn = norm(sub(F, D)), dnb = basis(dn);
    function revolve(o, ax, prof, closed, k) {
      k = k || 32; var b = basis(ax), tris = [];
      var P = function (s, r, f) { return add(o, add(mul(ax, s), add(mul(b[0], r * Math.cos(f)), mul(b[1], r * Math.sin(f))))); };
      var ne = closed === false ? prof.length - 1 : prof.length;
      for (var e = 0; e < ne; e++) {
        var p0 = prof[e], p1 = prof[(e + 1) % prof.length];
        for (var j = 0; j < k; j++) {
          var f0 = 2 * Math.PI * j / k, f1 = 2 * Math.PI * (j + 1) / k;
          var a = P(p0[0], p0[1], f0), bb = P(p0[0], p0[1], f1), c = P(p1[0], p1[1], f1), d = P(p1[0], p1[1], f0);
          if (p0[1] > 1e-6) tris.push([a, bb, c]); if (p1[1] > 1e-6) tris.push([a, c, d]);
        }
      }
      return tris;
    }
    function edgesOf(tris) {   // crease + boundary edges, as the page engine draws them
      var key = function (p) { return p.map(function (x) { return x.toFixed(2); }).join(","); }, E = new Map(), cmax = Math.cos(Math.PI / 6);
      tris.forEach(function (t) {
        var nr = norm(cross(sub(t[1], t[0]), sub(t[2], t[0])));
        for (var i = 0; i < 3; i++) { var a = t[i], b = t[(i + 1) % 3], ka = key(a), kb = key(b), kk = ka < kb ? ka + "|" + kb : kb + "|" + ka;
          var e = E.get(kk); if (e) e.n.push(nr); else E.set(kk, { a: a, b: b, n: [nr] }); }
      });
      var out = []; E.forEach(function (e) { if (e.n.length === 1 || Math.abs(dot(e.n[0], e.n[1])) < cmax) out.push([e.a, e.b]); });
      return out;
    }
    function bodyOf(tris, col, op, edgeOp) {
      var c = [0, 0, 0]; tris.forEach(function (t) { t.forEach(function (p) { for (var i = 0; i < 3; i++) c[i] += p[i] / (3 * tris.length); }); });
      return { tris: tris, edges: edgesOf(tris), col: col, op: op, eop: edgeOp, c: c };
    }
    var GLASS = "214,219,224", SRCC = "221,107,32", CHIP = "79,209,197";
    var bodies = [
      bodyOf(revolve(A, back, [[0, 8], [24, 8], [24, 10], [0, 10]]), GLASS, 0.07, 0.42),          // Pb tube
      bodyOf(revolve(A, back, [[0, AP], [2, AP], [2, 8], [0, 8]]), GLASS, 0.07, 0.42),            // Pb plate with the opening
      bodyOf(revolve(S, back, [[-0.5, 4], [0, 4], [0, 7], [-0.5, 7]]), GLASS, 0.09, 0.5),          // capsule lip
      bodyOf(revolve(S, back, [[0, 0], [5.5, 0], [5.5, 7], [0, 7]]), GLASS, 0.09, 0.5),            // capsule
      bodyOf(revolve(S, back, [[5.5, 0], [13.5, 0], [13.5, 3], [5.5, 3]]), GLASS, 0.09, 0.5),      // stem
      bodyOf(revolve(add(S, mul(n, 0.05)), n, [[0, 0], [0, SRC]], false), SRCC, 0.85, 0.9),        // 57Co active area
      bodyOf(revolve(D, dn, [[0, 0], [0, DET]], false), CHIP, 0.55, 0.8),                          // detector chip
      bodyOf(revolve(add(D, mul(dn, 1.75)), mul(dn, -1), [[0, 0], [9, 0], [9, 7], [0, 7]]), GLASS, 0.10, 0.5),   // detector cap
    ];
    var ring = []; for (var i = 0; i <= 48; i++) { var f = 2 * Math.PI * i / 48; ring.push(add(A, add(mul(u, AP * Math.cos(f)), mul(v, AP * Math.sin(f))))); }
    var axisLine = [add(S, mul(n, -22)), add(S, mul(n, STAND + 14))];

    // rays that clear the opening (the grey blocked ones are left out); a share also gets a sample -> chip leg
    var rays = [];
    for (var k = 0; rays.length < 240 && k < 60000; k++) {
      var rr = SRC * Math.sqrt(rnd()), ph = 2 * Math.PI * rnd();
      var P = add(S, add(mul(u, rr * Math.cos(ph)), mul(v, rr * Math.sin(ph))));
      var ct = 1 - rnd() * (1 - Math.cos(35 * Math.PI / 180)), sn = Math.sqrt(1 - ct * ct), p2 = 2 * Math.PI * rnd();
      var dir = add(mul(n, ct), add(mul(u, sn * Math.cos(p2)), mul(v, sn * Math.sin(p2))));
      var Q = add(P, mul(dir, dot(sub(A, P), n) / dot(dir, n)));
      var t2 = (ZS - P[2]) / dir[2]; if (t2 <= 0 || Math.hypot.apply(null, sub(Q, A)) > AP) continue;
      var H = add(P, mul(dir, t2)), th = Math.acos(ct) * 180 / Math.PI, ray = { P: P, H: H, rgb: thetaRGB(th) };
      if (rays.length % 2 === 0) {
        var cr = DET * 0.92 * Math.sqrt(rnd()), cf = 2 * Math.PI * rnd();
        ray.C = add(D, add(mul(dnb[0], cr * Math.cos(cf)), mul(dnb[1], cr * Math.sin(cf))));
      }
      rays.push(ray);
    }
    // photons: each detected path fires K times per turn at random phases; speed in mm/s
    var SPEED = 34, HOLD = 5, K = 2, shots = [];
    rays.forEach(function (r) {
      if (!r.C) return;
      var l1 = Math.hypot.apply(null, sub(r.H, r.P)), l2 = Math.hypot.apply(null, sub(r.C, r.H));
      for (var j = 0; j < K; j++) shots.push({ r: r, t0: rnd() * T, d1: l1 / SPEED, d2: l2 / SPEED });
    });

    var CTR = [(S[0] + D[0]) / 2, 0, (S[2] + ZS) / 2 + 1], SPAN = 60, PITCH = 0.35, YAW0 = -0.75, PLATE = 26;
    var W = 0, Hc = 0, sc = 1, ox = 0;
    function fit() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return false;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      W = cv.width; Hc = cv.height; sc = Hc / IH; ox = (W - IW * sc) / 2;   // object-fit: cover, scaled by height
      return true;
    }
    function draw(t) {
      if (!fit()) return;
      var yaw = YAW0 + 2 * Math.PI * (t % T) / T, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(PITCH), sp = Math.sin(PITCH);
      var scl = PANEL / SPAN, cx0 = PANEL / 2 + 6, cy0 = IH * 0.5;
      var rot = function (p) { var x = p[0] - CTR[0], y = p[1] - CTR[1], z = p[2] - CTR[2], x1 = cy * x - sy * y, y1 = sy * x + cy * y; return [x1, cp * y1 - sp * z, sp * y1 + cp * z]; };
      var pr = function (p) { var q = rot(p), s = 160 / (160 + q[1]); return [cx0 + scl * q[0] * s, cy0 - scl * q[2] * s]; };
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, Hc);
      ctx.setTransform(sc, 0, 0, sc, ox, 0);
      ctx.fillStyle = BG; ctx.fillRect(-ox / sc - 1, -1, PANEL + ox / sc + 1, IH + 2);
      ctx.save(); ctx.beginPath(); ctx.rect(-ox / sc, 0, PANEL + ox / sc, IH); ctx.clip();
      ctx.lineJoin = "round";
      // sample plate: a disc with a 5 mm grid (round, so its outline doesn't swell as it turns)
      var X = CTR[0], plate = [];
      for (var i = 0; i <= 64; i++) { var f = 2 * Math.PI * i / 64; plate.push(pr([X + PLATE * Math.cos(f), PLATE * Math.sin(f), ZS])); }
      ctx.beginPath(); plate.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath();
      ctx.fillStyle = "rgba(139,94,60,.17)"; ctx.fill();
      ctx.save(); ctx.clip(); ctx.strokeStyle = "rgba(139,94,60,.22)"; ctx.lineWidth = 1; ctx.beginPath();
      for (var g = -PLATE; g <= PLATE + 1e-6; g += 5) {
        var a = pr([X + g, -PLATE, ZS]), b = pr([X + g, PLATE, ZS]), c = pr([X - PLATE, g, ZS]), d = pr([X + PLATE, g, ZS]);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
      }
      ctx.stroke(); ctx.restore();
      ctx.beginPath(); plate.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath();
      ctx.strokeStyle = "rgba(139,94,60,.35)"; ctx.lineWidth = 1.2; ctx.stroke();
      // bodies far to near, rays + photons between the far and the near half
      var bs = bodies.map(function (bd) { return { bd: bd, d: rot(bd.c)[1] }; }).sort(function (p, q) { return q.d - p.d; });
      function drawBody(bd) {
        ctx.beginPath();
        bd.tris.forEach(function (tr) { var A0 = pr(tr[0]), B0 = pr(tr[1]), C0 = pr(tr[2]);
          if ((B0[0] - A0[0]) * (C0[1] - A0[1]) - (B0[1] - A0[1]) * (C0[0] - A0[0]) < 0) { var x = B0; B0 = C0; C0 = x; }
          ctx.moveTo(A0[0], A0[1]); ctx.lineTo(B0[0], B0[1]); ctx.lineTo(C0[0], C0[1]); ctx.closePath(); });
        ctx.fillStyle = "rgba(" + bd.col + "," + bd.op + ")"; ctx.fill("nonzero");
        ctx.beginPath(); bd.edges.forEach(function (e) { var p = pr(e[0]), q = pr(e[1]); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); });
        ctx.strokeStyle = "rgba(" + bd.col + "," + bd.eop + ")"; ctx.lineWidth = 1.1; ctx.stroke();
      }
      bs.forEach(function (o) { if (o.d > 0) drawBody(o.bd); });
      ctx.lineWidth = 1.15;
      rays.forEach(function (r) {
        var p = pr(r.P), h = pr(r.H); ctx.strokeStyle = "rgba(" + r.rgb + ",.62)";
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(h[0], h[1]); ctx.stroke();
        if (r.C) { var c = pr(r.C); ctx.strokeStyle = "rgba(" + r.rgb + ",.16)"; ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(c[0], c[1]); ctx.stroke(); }
      });
      // photons in flight (with a short tail) and the ones already on the chip
      var tm = t % T, landed = 0;
      shots.forEach(function (s) {
        var age = ((tm - s.t0) % T + T) % T, r = s.r, pos, hold = -1;
        if (age < s.d1) pos = r.P.map(function (x, i) { return x + (r.H[i] - x) * age / s.d1; });
        else if (age < s.d1 + s.d2) { var f = (age - s.d1) / s.d2; pos = r.H.map(function (x, i) { return x + (r.C[i] - x) * f; }); }
        else if (age < s.d1 + s.d2 + HOLD) hold = (age - s.d1 - s.d2) / HOLD;
        else return;
        if (hold >= 0) {
          landed += 1 - hold; var q = pr(r.C);
          ctx.fillStyle = "rgba(205,250,245," + (0.95 * (1 - hold)).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(q[0], q[1], 2.4, 0, 7); ctx.fill(); return;
        }
        var tb = Math.max(0, age - 0.18), bp;
        if (tb < s.d1) bp = r.P.map(function (x, i) { return x + (r.H[i] - x) * tb / s.d1; });
        else bp = r.H.map(function (x, i) { return x + (r.C[i] - x) * (tb - s.d1) / s.d2; });
        var q2 = pr(pos), q1 = pr(bp), rgb = r.rgb.map(function (x) { return Math.round(x + (255 - x) * 0.55); }).join(",");
        var gr = ctx.createLinearGradient(q1[0], q1[1], q2[0], q2[1]); gr.addColorStop(0, "rgba(" + rgb + ",0)"); gr.addColorStop(1, "rgba(" + rgb + ",.9)");
        ctx.strokeStyle = gr; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.stroke();
        ctx.fillStyle = "rgb(" + rgb + ")"; ctx.beginPath(); ctx.arc(q2[0], q2[1], 2.6, 0, 7); ctx.fill();
      });
      ctx.strokeStyle = "rgba(240,242,238,.95)"; ctx.lineWidth = 3; ctx.beginPath();   // limiting opening
      ring.forEach(function (p, i) { var q = pr(p); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.stroke();
      var a0 = pr(axisLine[0]), a1 = pr(axisLine[1]); ctx.strokeStyle = "rgba(214,219,224,.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a1[0], a1[1]); ctx.stroke();
      bs.forEach(function (o) { if (o.d <= 0) drawBody(o.bd); });
      // the chip glows with the photons it is holding
      var cpt = pr(D), glow = Math.min(1, landed / 30);
      var rg = ctx.createRadialGradient(cpt[0], cpt[1], 0, cpt[0], cpt[1], 46);
      rg.addColorStop(0, "rgba(" + CHIP + "," + (0.35 * glow).toFixed(3) + ")"); rg.addColorStop(1, "rgba(" + CHIP + ",0)");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cpt[0], cpt[1], 46, 0, 7); ctx.fill();
      // labels ride with their parts
      ctx.font = "400 23px " + FONT; ctx.textBaseline = "alphabetic";
      var label = function (s, p, dx, dy) { var q = pr(p), x = Math.max(12, Math.min(PANEL - ctx.measureText(s).width - 12, q[0] + dx));
        var y = Math.max(28, Math.min(720, q[1] + dy));
        ctx.lineWidth = 5; ctx.strokeStyle = BG; ctx.strokeText(s, x, y); ctx.fillStyle = LABEL; ctx.fillText(s, x, y); };
      label("source", add(S, mul(n, -17)), -40, -8);
      label("detector", add(D, mul(dn, -12)), -40, -12);
      label("sample", [X, -PLATE * 0.6, ZS], -30, 34);
      ctx.restore();
      // ray colour key, fixed, as on the static card
      for (var x = 0; x < 140; x++) { ctx.fillStyle = "rgb(" + thetaRGB(25 * x / 140) + ")"; ctx.fillRect(40 + x, 742, 1.2, 10); }
      ctx.font = "400 16px " + FONT; ctx.fillStyle = LABEL; ctx.fillText("0°", 40, 776); ctx.fillText("25° off the drive axis", 150, 776);
    }

    var raf = 0, last = 0, t = 0, drawn = false;
    function frame(now) {
      t += Math.min(0.1, (now - last) / 1000); last = now; t %= T;
      draw(t); if (!drawn) { drawn = true; layer.classList.add("is-ready"); }
      raf = requestAnimationFrame(frame);
    }
    return { layer: layer,
      start: function () { if (raf) return; last = performance.now(); raf = requestAnimationFrame(frame); },
      stop: function () { if (raf) cancelAnimationFrame(raf); raf = 0; } };
  }

  /* ------------------------------------------------------- melting slabs (melting.html card) */
  // Both 1,024-atom MACE lead slabs from melt-sele (assets/data/melt-thumb.json, written by website_export.py):
  // 590 K, where the crystal (gold) grows, and 663 K, where it melts into the liquid (blue). 40 saved frames per run,
  // interpolated; played forward then backward so the loop has no jump. Atoms crossing a periodic face fade across.
  function meltSlabs(el) {
    var cv = document.createElement("canvas"), ctx = cv.getContext("2d"); if (!ctx) return null;
    var layer = layerOn(el, cv), J = null, loading = false, IW = 1800, IH = 1124, T = 14;
    var GOLD = [217, 178, 111], BLUE = [127, 167, 201], SPR = {};
    function sprite(rgb, r) {
      var k = rgb.join() + r; if (SPR[k]) return SPR[k];
      var c = document.createElement("canvas"); c.width = c.height = 2 * r + 2; var g = c.getContext("2d");
      var gr = g.createRadialGradient(r * 0.65, r * 0.6, r * 0.08, r + 1, r + 1, r);
      var sh = function (f) { return "rgb(" + rgb.map(function (v) { return Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)); }).join(",") + ")"; };
      gr.addColorStop(0, sh(0.7)); gr.addColorStop(0.4, sh(0)); gr.addColorStop(1, sh(-0.6));
      g.fillStyle = gr; g.beginPath(); g.arc(r + 1, r + 1, r, 0, 7); g.fill(); return (SPR[k] = c);
    }
    function dec(b64) { var s = atob(b64), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
    function draw(t) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      var s = Math.max(cv.width / IW, cv.height / IH);
      ctx.setTransform(s, 0, 0, s, (cv.width - IW * s) / 2, (cv.height - IH * s) / 2);
      ctx.fillStyle = "#151716"; ctx.fillRect(0, 0, IW, IH);
      var ph = (t % T) / T, u = ph < 0.5 ? 2 * ph : 2 - 2 * ph;   // ping-pong 0 -> 1 -> 0
      ["590", "663"].forEach(function (key, row) {
        var R = J.runs[key], N = R.n, nf = R.t_ps.length, L = R.box, x = u * (nf - 1), f0 = Math.floor(x), f1 = Math.min(f0 + 1, nf - 1), wgt = x - f0;
        var sc = Math.min((IW - 140) / L[2], 440 / (L[0] + 0.45 * L[1])), x0 = (IW - L[2] * sc) / 2, y0 = 110 + row * 545, r = Math.max(4, Math.round(1.3 * sc)), nb = Math.ceil(N / 8);
        var pts = [], FADE = 2.2;
        for (var i = 0; i < N; i++) {
          var p = [];
          for (var k = 0; k < 3; k++) { var a = R.F[(f0 * N + i) * 3 + k] / 256, d = R.F[(f1 * N + i) * 3 + k] / 256 - a; d -= Math.round(d); p.push(((a + wgt * d) % 1 + 1) % 1 * L[k]); }
          var cr = (R.C[(wgt < 0.5 ? f0 : f1) * nb + (i >> 3)] >> (i & 7)) & 1;
          // periodic images within FADE Å of a face fade in/out, so nothing jumps across the box
          var ox = [[p[0], 1]], oy = [[p[1], 1]], oz = [[p[2], 1]];
          [[ox, 0], [oy, 1], [oz, 2]].forEach(function (q) { var v = p[q[1]], Lk = L[q[1]];
            if (v > Lk - FADE) q[0].push([v - Lk, 1 - (Lk - v) / FADE]); if (v < FADE) q[0].push([v + Lk, 1 - v / FADE]); });
          ox.forEach(function (a1) { oy.forEach(function (b1) { oz.forEach(function (c1) {
            var al = a1[1] * b1[1] * c1[1]; if (al > 0.05) pts.push([x0 + c1[0] * sc, y0 + (a1[0] + 0.45 * b1[0]) * sc, b1[0], cr, al < 1 ? 0.6 * al : 1]);
          }); }); });
        }
        pts.sort(function (a2, b2) { return b2[2] - a2[2]; });
        pts.forEach(function (q) { ctx.globalAlpha = q[4]; ctx.drawImage(sprite(q[3] ? GOLD : BLUE, r), q[0] - r, q[1] - r); });
        ctx.globalAlpha = 1; ctx.font = "500 60px 'IBM Plex Mono', Consolas, monospace"; ctx.fillStyle = "#F2F3F0";
        ctx.fillText(key + " K · the crystal " + (key === "590" ? "grows" : "melts"), x0, y0 - 26);
        ctx.fillStyle = "rgba(242,243,240,0.55)"; ctx.textAlign = "right";
        ctx.fillText((R.t_ps[0] + u * (R.t_ps[nf - 1] - R.t_ps[0])).toFixed(0) + " ps", x0 + L[2] * sc, y0 - 26); ctx.textAlign = "left";
      });
    }
    var raf = 0, last = 0, t = 0, drawn = false;
    function frame(now) {
      t += Math.min(0.1, (now - last) / 1000); last = now; t %= T;
      draw(t); if (!drawn) { drawn = true; layer.classList.add("is-ready"); }
      raf = requestAnimationFrame(frame);
    }
    function go() { last = performance.now(); raf = requestAnimationFrame(frame); }
    return { layer: layer,
      start: function () {
        if (raf) return;
        if (J) return go();
        if (loading) return; loading = true;
        fetch("assets/data/melt-thumb.json").then(function (r) { return r.json(); }).then(function (d) {
          Object.keys(d.runs).forEach(function (k) { d.runs[k].F = dec(d.runs[k].f); d.runs[k].C = dec(d.runs[k].c); });
          J = d; if (el.__meltWant !== false) go();
        }).catch(function () { loading = false; });
      },
      stop: function () { if (raf) cancelAnimationFrame(raf); raf = 0; } };
  }

  init();
})();
