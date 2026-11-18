/* montecarlo.html, part I and III: the Mössbauer primer figures (mineral library, rock overlays, smear cases)
   and the spectrum build-up animation. Data: assets/data/mc.json "teach" (tools/mc_page.py, from smear_core /
   desmear in the rock-spectra smear study). */
(function () {
  "use strict";
  var INK = "#2b2f2a", GRID = "rgba(0,0,0,0.08)";
  var CFG = { displaylogo: false, responsive: true, modeBarButtonsToRemove: ["select2d", "lasso2d", "toImage"] };
  var FONT = { family: "Inter, system-ui, sans-serif", size: 11, color: INK };
  var COL = { hematite: "#7b341e", magnetite: "#319795", goethite: "#b7791f", olivine: "#2c5282", pyroxene: "#4299e1",
              "np-oxide": "#ed8936", npOx: "#ed8936", jarosite: "#c05621", "magnetite tet-Fe3+": "#319795",
              "magnetite oct-Fe2.5+": "#4fd1c5", ilmenite: "#2b6cb0" };
  var NICE = { "np-oxide": "nanophase oxide", npOx: "nanophase oxide", "magnetite tet-Fe3+": "magnetite, site A",
               "magnetite oct-Fe2.5+": "magnetite, site B" };
  var C_OURS = "#d95f02", C_1MM = "#6b46c1";
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")"; }
  function axis(extra) { var a = { gridcolor: GRID, zeroline: false, linecolor: "#bbb", ticks: "outside", tickcolor: "#bbb", tickfont: { size: 10 } };
    for (var k in (extra || {})) a[k] = extra[k]; return a; }
  function base(extra) { var l = { font: FONT, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", hovermode: "closest",
    margin: { l: 30, r: 10, t: 30, b: 40 } }; for (var k in (extra || {})) l[k] = extra[k]; return l; }
  function narrow(el) { return el.clientWidth < 600; }

  /* grid of small multiples: n panels, cols per row; returns layout with xaxisN/yaxisN domains */
  function grid(n, cols, gapx, gapy) {
    var rows = Math.ceil(n / cols), L = {}, w = (1 - gapx * (cols - 1)) / cols, h = (1 - gapy * (rows - 1)) / rows;
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / cols), c = i % cols, s = i ? String(i + 1) : "";
      L["xaxis" + s] = axis({ domain: [c * (w + gapx), c * (w + gapx) + w], anchor: "y" + s });
      L["yaxis" + s] = axis({ domain: [1 - (r + 1) * h - r * gapy, 1 - r * h - r * gapy], anchor: "x" + s, showticklabels: false, range: [0, 1.12] });
    }
    return L;
  }
  function title(i, x, text) { var s = i ? String(i + 1) : "";
    return { text: text, xref: "x" + s + " domain", yref: "y" + s + " domain", x: 0, y: 1.0, xanchor: "left", yanchor: "bottom", showarrow: false, align: "left", font: { size: 11 } }; }

  /* ---------- I.b mineral fingerprints ---------- */
  function library(el, T) {
    var cols = narrow(el) ? 2 : 4, L = grid(T.lib.length, cols, 0.03, 0.2), tr = [], ann = [];
    T.lib.forEach(function (m, i) {
      var s = i ? String(i + 1) : "", c = COL[m.key];
      tr.push({ x: T.v, y: m.y, xaxis: "x" + s, yaxis: "y" + s, type: "scatter", mode: "lines", fill: "tozeroy",
        line: { color: c, width: 1.6 }, fillcolor: rgba(c, 0.25), name: m.name, showlegend: false,
        hovertemplate: "%{x:.2f} mm/s<extra>" + m.name + "</extra>" });
      L["xaxis" + s].range = m.kind === "s" ? [-10.5, 10.5] : [-2.2, 3.6];
      if (i >= T.lib.length - cols) L["xaxis" + s].title = { text: "velocity (mm/s)", font: { size: 10 } };
      ann.push(title(i, 0, "<b>" + m.name + "</b> · " + m.note));
    });
    L.annotations = ann;
    Plotly.newPlot(el, tr, base(L), CFG);
  }

  /* ---------- I.c rocks are mixtures ---------- */
  function rocks(el, T) {
    var stack = narrow(el), L = grid(T.rocks.length, stack ? 1 : 2, 0.05, 0.22), tr = [], ann = [], seen = {};
    T.rocks.forEach(function (r, i) {
      var s = i ? String(i + 1) : "";
      r.comps.forEach(function (c) {
        var col = COL[c.name] || "#888", nm = (NICE[c.name] || c.name);
        tr.push({ x: T.v, y: c.y, xaxis: "x" + s, yaxis: "y" + s, type: "scatter", mode: "lines", fill: "tozeroy",
          line: { color: col, width: 1 }, fillcolor: rgba(col, 0.28), name: nm, legendgroup: nm, showlegend: !seen[nm],
          hovertemplate: nm + ", " + c.pct + " % of the iron<extra></extra>" });
        seen[nm] = 1;
      });
      tr.push({ x: T.v, y: r.total, xaxis: "x" + s, yaxis: "y" + s, type: "scatter", mode: "lines",
        line: { color: INK, width: 2 }, name: "combined spectrum", legendgroup: "sum", showlegend: i === 0,
        hovertemplate: "%{x:.2f} mm/s<extra>sum</extra>" });
      L["xaxis" + s].range = [-10.5, 10.5];
      L["xaxis" + s].title = { text: "velocity (mm/s)", font: { size: 10 } };
      ann.push(title(i, 0, "<b>" + r.name + "</b>, Gusev crater · " + r.note));
    });
    L.annotations = ann; L.showlegend = true;
    L.legend = { orientation: "h", y: -0.18, yanchor: "top", x: 0, font: { size: 10 } };
    L.margin = { l: 20, r: 10, t: 26, b: 20 };
    Plotly.newPlot(el, tr, base(L), CFG);
  }

  /* ---------- III smear cases ---------- */
  function cases(el, T) {
    var cols = narrow(el) ? 1 : 2, L = grid(T.cases.length, cols, 0.05, 0.16), tr = [], ann = [];
    T.cases.forEach(function (c, i) {
      var s = i ? String(i + 1) : "", na = NICE[c.a] || c.a, nb = NICE[c.b] || c.b, sext = (c.a === "hematite");
      [[c.ya, na, COL[c.a]], [c.yb, nb, COL[c.b]]].forEach(function (q) {
        tr.push({ x: T.v, y: q[0], xaxis: "x" + s, yaxis: "y" + s, type: "scatter", mode: "lines", fill: "tozeroy",
          line: { color: q[2], width: 0.8 }, fillcolor: rgba(q[2], 0.18), name: q[1], showlegend: false,
          hovertemplate: q[1] + "<extra></extra>" });
      });
      var spec = [[c.y0, "mixture before broadening", "#8a8f87", 2.2], [c.y_ours, "current design (1.8% stretch)", C_OURS, 1.8]];
      spec.forEach(function (q, k) {
        tr.push({ x: T.v, y: q[0], xaxis: "x" + s, yaxis: "y" + s, type: "scatter", mode: "lines", line: { color: q[2], width: q[3] },
          name: q[1], legendgroup: q[1], showlegend: i === 0, hovertemplate: "%{x:.2f} mm/s<extra>" + q[1] + "</extra>" });
      });
      L["xaxis" + s].range = sext ? [-10.5, 10.5] : [-1.6, 3.4];
      L["xaxis" + s].title = { text: "velocity (mm/s)", font: { size: 10 } };
      var o = c.rows[0], h = c.rows[1];
      ann.push(title(i, 0, "<b>" + na + " + " + nb + "</b> · time ×" + o.time.toFixed(2) + " (current), ×" + h.time.toFixed(1) + " (8 mm)"));
    });
    L.annotations = ann; L.showlegend = true;
    L.legend = { orientation: "h", y: -0.12, yanchor: "top", x: 0, font: { size: 10 } };
    L.margin = { l: 20, r: 10, t: 26, b: 20 };
    Plotly.newPlot(el, tr, base(L), CFG);
    var tb = document.getElementById("mc-cases-table");
    if (tb) tb.innerHTML = T.cases.map(function (c) {
      return "<tr><td>" + (NICE[c.a] || c.a) + " + " + (NICE[c.b] || c.b) + "</td>" + c.rows.slice(0, 2).map(function (r) {
        return "<td>×" + r.time.toFixed(2) + " · " + Math.round(100 * Math.min(r.sep, 1)) + " %</td>"; }).join("") + "</tr>";
    }).join("");
  }

  /* ---------- I.a the spectrum builds up: a moving source, counts per velocity ---------- */
  function build(fig, T) {
    var cv = fig.querySelector("canvas"), ctx = cv.getContext("2d"), out = fig.querySelector(".fig-out");
    var btn = fig.querySelector("button"), hem = T.lib[0].y, V = T.v, NCH = 128, counts, sweeps, t0, running = true;
    var BASE = 400;                                    // background counts per channel per sweep (toy scale)
    function reset() { counts = new Float64Array(NCH); sweeps = 0; t0 = performance.now(); }
    function shape(v) { var j = Math.round((v - V[0]) / (V[1] - V[0])); return j >= 0 && j < hem.length ? hem[j] : 0; }
    function pois(m) { var g = m + Math.sqrt(m) * gauss(); return Math.max(0, g); }
    function gauss() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    function vel(i) { return -11 + 22 * (i + 0.5) / NCH; }
    function size() { var r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); ctx.setTransform(d, 0, 0, d, 0, 0); return r; }
    var R = size(); window.addEventListener("resize", function () { R = size(); });
    function frame(now) {
      if (!running) return;
      var per = 2400, ph = ((now - t0) % per) / per, vnow = 11 * Math.sin(2 * Math.PI * ph);
      for (var k = 0; k < 6; k++) { sweeps += 1 / 6;
        for (var i = 0; i < NCH; i++) counts[i] += pois((BASE / 6) * (1 + 0.12 * shape(vel(i)))); }
      var W = R.width, H = R.height, sx = Math.min(130, W * 0.28), px = sx + 30, pw = W - px - 10, ph2 = H - 46;
      ctx.clearRect(0, 0, W, H);
      // source on its drive
      var cx = sx / 2 + (sx / 2 - 22) * (vnow / 11), cy = H * 0.42;
      ctx.strokeStyle = "#bbb"; ctx.beginPath(); ctx.moveTo(10, cy + 22); ctx.lineTo(sx - 10, cy + 22); ctx.stroke();
      ctx.fillStyle = "#e31a1c"; ctx.fillRect(cx - 14, cy - 10, 28, 20);
      ctx.fillStyle = INK; ctx.font = "11px Inter, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("⁵⁷Co source", sx / 2, cy - 20); ctx.fillText("v = " + vnow.toFixed(1) + " mm/s", sx / 2, cy + 40);
      ctx.strokeStyle = "#e31a1c"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + vnow * 2.2, cy); ctx.stroke();
      // spectrum so far
      var mx = 0, mn = Infinity; for (i = 0; i < NCH; i++) { mx = Math.max(mx, counts[i]); mn = Math.min(mn, counts[i]); }
      var lo = mn - (mx - mn) * 0.15, hi = mx + (mx - mn) * 0.1 + 1e-9, bw = pw / NCH;
      ctx.fillStyle = "#7b341e";
      for (i = 0; i < NCH; i++) { var y = 10 + ph2 * (1 - (counts[i] - lo) / (hi - lo)); ctx.beginPath(); ctx.arc(px + (i + 0.5) * bw, y, 1.8, 0, 7); ctx.fill(); }
      var xi = px + pw * (vnow + 11) / 22;
      ctx.strokeStyle = "rgba(227,26,28,0.6)"; ctx.beginPath(); ctx.moveTo(xi, 10); ctx.lineTo(xi, 10 + ph2); ctx.stroke();
      ctx.fillStyle = "#4a4f48"; ctx.textAlign = "center"; ctx.fillText("velocity (mm/s)", px + pw / 2, H - 6);
      [-10, -5, 0, 5, 10].forEach(function (t) { ctx.fillText(t, px + pw * (t + 11) / 22, H - 22); });
      ctx.save(); ctx.translate(px - 8, 10 + ph2 / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("counts", 0, 0); ctx.restore();
      out.textContent = "Sweeps completed: " + Math.floor(sweeps) + ". Halving the relative counting noise takes four times as many counts.";
      if (sweeps > 2000) reset();
    }
    reset();
    btn.addEventListener("click", function () { reset(); });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { running = e[0].isIntersecting; }).observe(fig);
    setInterval(function () { frame(performance.now()); }, 40);   // a timer, not rAF: pauses itself off-screen via `running`
  }

  function go(D) {
    var T = D.teach, q = function (s) { return document.querySelector(s); };
    if (q("#mc-lib")) library(q("#mc-lib"), T);
    if (q("#mc-rocks")) rocks(q("#mc-rocks"), T);
    if (q("#mc-cases")) cases(q("#mc-cases"), T);
    if (q("[data-mc=build]")) build(q("[data-mc=build]"), T);
    document.documentElement.dataset.mcTeach = "ready";
  }
  function start() {
    if (!window.Plotly) { setTimeout(start, 60); return; }
    var src = document.querySelector("script[data-mc]");
    fetch(src ? src.getAttribute("data-mc") : "assets/data/mc.json").then(function (r) { return r.json(); }).then(go)
      .catch(function (e) { document.documentElement.dataset.mcTeach = "error: " + e; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
