/* montecarlo.html: draws the SiNRG Monte Carlo figures from assets/data/mc.json (built by tools/mc_page.py from
   the review-slide study outputs). Plotly is loaded by the page. */
(function () {
  "use strict";
  var INK = "#2b2f2a", MUTE = "#6b7068", GRID = "rgba(0,0,0,0.08)";
  var CFG = { displaylogo: false, responsive: true,
              modeBarButtonsToRemove: ["select2d", "lasso2d", "toImage", "resetCameraLastSave3d"] };
  var FONT = { family: "Inter, system-ui, sans-serif", size: 12, color: INK };

  function ax(title, extra) {
    var a = { title: { text: title, font: { size: 12 } }, gridcolor: GRID, zeroline: false, linecolor: "#bbb",
              ticks: "outside", tickcolor: "#bbb" };
    for (var k in (extra || {})) a[k] = extra[k];
    return a;
  }
  function base(extra) {
    var l = { font: FONT, paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
              margin: { l: 56, r: 14, t: 10, b: 46 }, hovermode: "closest" };
    for (var k in (extra || {})) l[k] = extra[k];
    return l;
  }
  function out(el, html) { var o = el.parentNode.querySelector(".fig-out"); if (o) o.innerHTML = html; }

  /* ---------- 3-D heads (the ver123 study's own traces) ---------- */
  function scene(D, i, n, stack) {
    var s = JSON.parse(JSON.stringify(D.scene));
    s.domain = stack ? { x: [0, 1], y: [1 - (i + 1) / n, 1 - i / n] } : { x: [i / n, (i + 1) / n], y: [0, 1] };
    s.bgcolor = "rgba(0,0,0,0)";
    ["xaxis", "yaxis", "zaxis"].forEach(function (a) { s[a].gridcolor = "#d9d9d4"; s[a].backgroundcolor = "rgba(0,0,0,0)"; s[a].title = { text: s[a].title, font: { size: 10 } }; s[a].tickfont = { size: 9 }; });
    return s;
  }
  function heads(el, D, keys, legend) {
    var stack = el.clientWidth < 600, traces = [], lay = base({ margin: { l: 0, r: 0, t: 0, b: 0 }, showlegend: !!legend,
      legend: { orientation: "h", y: -0.02, yanchor: "top", x: 0, font: { size: 11 } } });
    keys.forEach(function (k, i) {
      D.heads[k].forEach(function (t) {
        t = JSON.parse(JSON.stringify(t));
        t.scene = i ? "scene" + (i + 1) : "scene";
        t.showlegend = !!legend && i === 0 && t.showlegend !== false;
        traces.push(t);
      });
      lay[i ? "scene" + (i + 1) : "scene"] = scene(D, i, keys.length, stack);
    });
    Plotly.newPlot(el, traces, lay, CFG).then(function () {
      if (keys.length < 2) return;
      var busy = false;
      el.on("plotly_relayout", function (e) {
        if (busy) return;
        var cam = null;
        for (var k in e) if (/^scene\d*\.camera$/.test(k)) cam = e[k];
        if (!cam) return;
        var u = {};
        keys.forEach(function (_, i) { u[(i ? "scene" + (i + 1) : "scene") + ".camera"] = cam; });
        busy = true;
        Plotly.relayout(el, u).then(function () { busy = false; }, function () { busy = false; });
      });
    });
  }

  /* ---------- off-axis angle histogram ---------- */
  function theta(el, P) {
    var x = [], e = P.edges;
    for (var i = 0; i < P.counts.length; i++) x.push(0.5 * (e[i] + e[i + 1]));
    var tot = P.counts.reduce(function (a, b) { return a + b; }, 0);
    var y = P.counts.map(function (c) { return 100 * c / tot; });
    Plotly.newPlot(el, [
      { type: "bar", x: x, y: y, width: 0.48, marker: { color: "#d95f02" }, name: "detected photons (Monte Carlo)",
        hovertemplate: "θ %{x:.2f}°: %{y:.2f} %<extra></extra>" },
      { type: "scatter", mode: "lines", x: [P.mean_deg, P.mean_deg], y: [0, Math.max.apply(null, y) * 1.08],
        line: { color: INK, dash: "dash", width: 1.5 }, name: "mean θ = " + P.mean_deg.toFixed(1) + "°", hoverinfo: "skip" }
    ], base({ xaxis: ax("angle from the source axis (°)", { range: [0, 25] }), yaxis: ax("share of detected photons (%)"),
              showlegend: true, legend: { x: 0.98, xanchor: "right", y: 0.98, bgcolor: "rgba(255,255,255,0.7)" },
              bargap: 0 }), CFG);
  }

  /* ---------- kernel matrix, rebuilt from the same (cos θ, weight) pairs as kernel_matrix() ---------- */
  function kernel(P) {
    var n = P.v[2], v0 = P.v[0], dv = (P.v[1] - P.v[0]) / (n - 1), v = [], c = [], q = [], i, j, m;
    for (i = 0; i < n; i++) v.push(+(v0 + i * dv).toFixed(4));
    var tot = P.counts.reduce(function (a, b) { return a + b; }, 0);
    for (m = 0; m < P.counts.length; m++) if (P.counts[m] > 0) {
      c.push(Math.cos(Math.PI / 180 * 0.5 * (P.edges[m] + P.edges[m + 1]))); q.push(P.counts[m] / tot);
    }
    var K = [];
    for (i = 0; i < n; i++) { var row = new Array(n).fill(0);
      for (m = 0; m < c.length; m++) {
        var x = c[m] * v[i]; if (x < v[0] || x > v[n - 1]) continue;
        j = Math.min(Math.max(Math.floor((x - v[0]) / dv), 0), n - 2);
        var t = Math.min(Math.max((x - v[j]) / (v[j + 1] - v[j]), 0), 1);
        row[j] += q[m] * (1 - t); row[j + 1] += q[m] * t;
      }
      K.push(row);
    }
    return { v: v, K: K };
  }
  function kmatrix(el, P) {
    var R = kernel(P), v = R.v, K = R.K;
    // check against the Python row at v = 8.5 mm/s
    var i85 = 0; v.forEach(function (x, i) { if (Math.abs(x - 8.5) < Math.abs(v[i85] - 8.5)) i85 = i; });
    var err = 0; K[i85].forEach(function (x, j) { err = Math.max(err, Math.abs(x - P.k_row_8p5[j])); });
    el.dataset.check = err.toExponential(1);
    var z = K.map(function (r) { return r.map(function (x) { return x > 0 ? Math.sqrt(x) : null; }); });
    Plotly.newPlot(el, [
      { type: "heatmap", x: v, y: v, z: z, colorscale: [[0, "#fff4e6"], [0.35, "#f59f00"], [1, "#7a2e00"]],
        zmin: 0, zmax: 0.55, showscale: true, colorbar: { title: { text: "square root of weight", side: "right" }, thickness: 10, len: 0.8 },
        name: "smearing kernel (Monte Carlo)", hovertemplate: "True: %{x:.2f} mm/s<br>Recorded: %{y:.1f} mm/s<extra></extra>" },
      { type: "scatter", mode: "lines", x: [-11, 11], y: [-11, 11], line: { color: "#1f78b4", dash: "dot", width: 1.5 },
        name: "no broadening (θ = 0)", hoverinfo: "skip" }
    ], base({ xaxis: ax("true line position (mm/s)", { range: [7.0, 10.0] }),
              yaxis: ax("recorded velocity (mm/s)", { range: [7.0, 10.0], scaleanchor: "x" }),
              showlegend: true, legend: { x: 0.02, y: 0.98, bgcolor: "rgba(255,255,255,0.75)" },
              margin: { l: 60, r: 10, t: 10, b: 46 } }), CFG);
    el.on("plotly_hover", function (e) {
      var p = e.points[0]; if (!p || p.data.type !== "heatmap" || p.z == null) return;
      out(el, "A line at <b>" + p.x.toFixed(2) + " mm/s</b> contributes a weight of " + (p.z * p.z).toFixed(3) +
          " at <b>" + p.y.toFixed(2) + " mm/s</b>. Rows sum to 1.");
    });
  }

  /* ---------- hematite through each head ---------- */
  function spectra(elFull, elZoom, D) {
    var S = D.spec, keys = ["ver1", "ver2", "ver3pb"], label = { ver1: "ver1", ver2: "ver2 (in use)", ver3pb: "ver3" };
    function tr(zoom) {
      var t = [{ x: S.v, y: S.expected, type: "scatter", mode: "lines", name: "input sextet",
                 line: { color: "#9aa0a6", width: 1.2 }, fill: "tozeroy", fillcolor: "rgba(154,160,166,0.18)",
                 hovertemplate: "%{x:.2f} mm/s<extra>input sextet</extra>" }];
      keys.forEach(function (k) {
        t.push({ x: S.v, y: S[k], type: "scatter", mode: "lines", name: label[k] + " (Monte Carlo)",
                 line: { color: D.num[k].color, width: k === "ver2" ? 3.5 : 2, dash: k === "ver3pb" ? "dot" : "solid" },
                 showlegend: !zoom, hovertemplate: "%{x:.2f} mm/s: %{y:.2f}<extra>" + label[k] + "</extra>" });
      });
      return t;
    }
    Plotly.newPlot(elFull, tr(false), base({ xaxis: ax("source velocity (mm/s)", { range: [-11, 11] }),
      yaxis: ax("emission (line 6 = 1)"), showlegend: true,
      legend: { orientation: "h", y: 1.0, yanchor: "bottom", x: 0, font: { size: 11 } }, margin: { l: 56, r: 10, t: 34, b: 46 },
      shapes: [{ type: "rect", x0: 7.8, x1: 10.2, y0: 0, y1: 1.05, fillcolor: "rgba(217,178,111,0.18)", line: { width: 0 } }] }), CFG);
    Plotly.newPlot(elZoom, tr(true), base({ xaxis: ax("source velocity (mm/s)", { range: [7.8, 10.2] }),
      yaxis: ax(""), showlegend: false, margin: { l: 40, r: 10, t: 34, b: 46 } }), CFG);
  }

  function go(D) {
    var q = function (s) { return document.querySelector(s); };
    if (q("#mc-heads")) heads(q("#mc-heads"), D, ["ver1", "ver2", "ver3pb"], true);
    if (q("#mc-ver2")) heads(q("#mc-ver2"), D, ["ver2"], false);
    if (q("#mc-theta")) theta(q("#mc-theta"), D.pipe);
    if (q("#mc-kernel")) kmatrix(q("#mc-kernel"), D.pipe);
    if (q("#mc-spec-full")) spectra(q("#mc-spec-full"), q("#mc-spec-zoom"), D);
    document.documentElement.dataset.mc = "ready";
  }
  function start() {
    if (!window.Plotly) { setTimeout(start, 60); return; }
    var src = document.querySelector("script[data-mc]");
    fetch(src ? src.getAttribute("data-mc") : "assets/data/mc.json").then(function (r) { return r.json(); }).then(go)
      .catch(function (e) { document.documentElement.dataset.mc = "error: " + e; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
