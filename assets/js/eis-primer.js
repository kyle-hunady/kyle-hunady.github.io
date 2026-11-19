/* EIS primer figures for battery.html: simulated Nyquist plots of ideal circuits.
   #eis-rc   series R_s + (R || C), apex at omega = 1/RC marked
   #eis-cell Li | electrolyte | Li: R_b + (R_gb || C_gb) + (R_ct || C_dl)
   Equal aspect on both axes. Model curves are lines; dots mark each decade of frequency. */
(function () {
  'use strict';
  const css = (v, fb) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;

  // impedance of R || C at angular frequency w, as [re, im]
  function rc(w, R, C) {
    if (R <= 0) return [0, 0];
    const a = w * R * C, d = 1 + a * a;
    return [R / d, -R * a / d];
  }

  function fmtF(f) {
    if (f >= 1e6) return +(f / 1e6).toPrecision(2) + ' MHz';
    if (f >= 1e3) return +(f / 1e3).toPrecision(2) + ' kHz';
    if (f >= 1) return +f.toPrecision(2) + ' Hz';
    return +f.toPrecision(2) + ' Hz';
  }
  function fmtC(c) {
    if (c >= 1e-6) return +(c / 1e-6).toPrecision(2) + ' µF';
    return +(c / 1e-9).toPrecision(2) + ' nF';
  }
  const DECADE = { 1e6: '1 MHz', 1e5: '100 kHz', 1e4: '10 kHz', 1e3: '1 kHz', 1e2: '100 Hz', 1e1: '10 Hz', 1: '1 Hz', 0.1: '0.1 Hz' };

  // Set up a canvas with equal-aspect axes covering 0..xmax and at least 0..ymin.
  // The canvas height follows its width so the y range stays tight.
  function axes(cv, xmax, ymin) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth;
    if (!W) return null;
    const pad = { l: 50, r: 10, t: 10, b: 34 }, pw = W - pad.l - pad.r;
    const s = pw / xmax;                                 // px per ohm, same on both axes
    const ph = Math.max(ymin * s, 120), H = ph + pad.t + pad.b;
    cv.style.height = H + 'px';
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const X = v => pad.l + v * s, Y = v => pad.t + ph - v * s;
    const ymax = ph / s, xEnd = pw / s;
    const ink = css('--muted', '#999'), rule = css('--rule', '#333');
    const raw = xEnd / 5, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map(k => k * mag).find(k => k >= raw);
    g.font = '11px ' + css('--sans', 'sans-serif'); g.lineWidth = 1; g.strokeStyle = rule; g.fillStyle = ink;
    g.textAlign = 'center';
    for (let x = 0; x <= xEnd + 1e-9; x += step) {
      g.beginPath(); g.moveTo(X(x), pad.t); g.lineTo(X(x), pad.t + ph); g.stroke();
      g.fillText(String(Math.round(x)), X(x), pad.t + ph + 14);
    }
    g.textAlign = 'right';
    let ystep = step; while (ymax / ystep < 2) ystep /= 2;
    for (let y = 0; y <= ymax + 1e-9; y += ystep) {
      g.beginPath(); g.moveTo(pad.l, Y(y)); g.lineTo(pad.l + pw, Y(y)); g.stroke();
      g.fillText(String(Math.round(y)), pad.l - 5, Y(y) + 4);
    }
    g.textAlign = 'center';
    g.fillText('Z′ (Ω)', pad.l + pw / 2, H - 4);
    g.save(); g.translate(11, pad.t + ph / 2); g.rotate(-Math.PI / 2); g.fillText('−Z″ (Ω)', 0, 0); g.restore();
    g.textAlign = 'left';
    return { g, X, Y, pad, pw, ph, W, H };
  }

  function clip(a) { const { g, pad, pw, ph } = a; g.save(); g.beginPath(); g.rect(pad.l, pad.t, pw, ph); g.clip(); }

  // label with a subscript, e.g. sub(g, 'R', 'b', x, y); align 'center' | 'left' | 'right'
  function sub(g, main, s, x, y, align) {
    const font = css('--sans', 'sans-serif');
    g.font = '11px ' + font; const w1 = g.measureText(main).width;
    g.font = '9px ' + font; const w2 = g.measureText(s).width;
    const w = w1 + w2, x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2, al = g.textAlign; g.textAlign = 'left';
    g.font = '11px ' + font; g.fillText(main, x0, y);
    g.font = '9px ' + font; g.fillText(s, x0 + w1, y + 3);
    g.font = '11px ' + font; g.textAlign = al;
  }

  // dots at each decade of frequency, with labels that skip when crowded
  function decades(a, Zf, avoid) {
    const { g, X, Y } = a, wht = css('--white', '#eee'), ink = css('--muted', '#999');
    const placed = (avoid || []).slice();
    for (let e = 6; e >= -1; e--) {
      const f = Math.pow(10, e), z = Zf(f), x = X(z[0]), y = Y(-z[1]);
      g.fillStyle = wht; g.beginPath(); g.arc(x, y, 3, 0, 2 * Math.PI); g.fill();
      if (placed.every(p => Math.hypot(p[0] - x - 18, p[1] - y + 6) > 34)) {
        placed.push([x + 18, y - 6]);
        g.fillStyle = ink; g.font = '10px ' + css('--sans', 'sans-serif');
        g.fillText(DECADE[f] || '', x + 5, y - 6);
      }
    }
  }

  const sweep = []; for (let e = 8; e >= -2; e -= 0.01) sweep.push(Math.pow(10, e));

  /* ---------- figure a: R_s + (R || C) ---------- */
  function figRC() {
    const root = document.getElementById('eis-rc'); if (!root) return;
    const cv = root.querySelector('canvas'), out = root.querySelector('.fig-out');
    const iR = root.querySelector('.a-r'), iC = root.querySelector('.a-c');
    const Rs = 100;
    root.state = {};
    function draw() {
      const R = +iR.value, C = Math.pow(10, +iC.value);
      const fApex = 1 / (2 * Math.PI * R * C);
      Object.assign(root.state, { R, C, fApex });
      const Zf = f => { const z = rc(2 * Math.PI * f, R, C); return [Rs + z[0], z[1]]; };
      const a = axes(cv, 3400, 1600); if (!a) return;
      const { g, X, Y } = a, acc = css('--accent', '#D9B26F'), wht = css('--white', '#eee'), ink = css('--muted', '#999');
      clip(a);
      g.strokeStyle = acc; g.lineWidth = 2; g.beginPath();
      sweep.forEach((f, i) => { const z = Zf(f), x = X(z[0]), y = Y(-z[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
      const ax = X(Rs + R / 2), ay = Y(R / 2);
      g.fillStyle = ink;
      sub(g, 'R', 's', X(Rs + R) + 6, Y(0) - 5, 'left');
      g.fillText('+ R', X(Rs + R) + 6 + g.measureText('Rs').width + 2, Y(0) - 5);
      decades(a, Zf, [[ax + 50, ay - 10], [ax + 90, ay - 10], [X(Rs) - 12, Y(0) - 8], [X(Rs + R) + 22, Y(0) - 8]]);
      // apex: omega = 1/RC sits at the top of the arc
      g.setLineDash([3, 3]); g.strokeStyle = ink; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax, Y(0) - 14); g.stroke(); g.setLineDash([]);
      g.strokeStyle = wht; g.lineWidth = 1.5; g.beginPath(); g.arc(ax, ay, 6, 0, 2 * Math.PI); g.stroke();
      g.fillStyle = wht; g.font = '11px ' + css('--sans', 'sans-serif');
      g.fillText('ω = 1/RC  (' + fmtF(fApex) + ')', ax + 10, ay - 8);
      g.restore();
      g.fillStyle = ink; sub(g, 'R', 's', X(Rs) - 4, Y(0) - 5, 'right');
      out.textContent = 'R = ' + R + ' Ω, C = ' + fmtC(C) + '. The arc is ' + R + ' Ω wide and ' + R / 2 +
        ' Ω tall. Its top is at f = 1/(2πRC) = ' + fmtF(fApex) + '.';
    }
    [iR, iC].forEach(el => el.addEventListener('input', draw));
    window.addEventListener('resize', draw);
    draw();
  }

  /* ---------- figure b: Li | electrolyte | Li ---------- */
  function figCell() {
    const root = document.getElementById('eis-cell'); if (!root) return;
    const cv = root.querySelector('canvas'), out = root.querySelector('.fig-out');
    const iB = root.querySelector('.b-rb'), iG = root.querySelector('.b-rgb'), iT = root.querySelector('.b-rct');
    const Cgb = 1e-9, Cdl = 1e-6;
    root.state = {};
    function draw() {
      const Rb = +iB.value, Rgb = +iG.value, Rct = +iT.value;
      const parts = f => { const w = 2 * Math.PI * f; return [rc(w, Rgb, Cgb), rc(w, Rct, Cdl)]; };
      const Zf = f => { const [a, b] = parts(f); return [Rb + a[0] + b[0], a[1] + b[1]]; };
      const fG = Rgb > 0 ? 1 / (2 * Math.PI * Rgb * Cgb) : 0, fT = Rct > 0 ? 1 / (2 * Math.PI * Rct * Cdl) : 0;
      Object.assign(root.state, { Rb, Rgb, Rct, fG, fT, total: Rb + Rgb + Rct });
      const a = axes(cv, 6000, 1500); if (!a) return;
      const { g, X, Y } = a, acc = css('--accent', '#D9B26F'), steel = css('--steel', '#7FA7C9'),
        wht = css('--white', '#eee'), ink = css('--muted', '#999');
      clip(a);
      // color each segment by which element supplies most of -Z''
      g.lineWidth = 2;
      for (let i = 1; i < sweep.length; i++) {
        const f = sweep[i], z0 = Zf(sweep[i - 1]), z1 = Zf(f), [pg, pt] = parts(f);
        g.strokeStyle = -pg[1] >= -pt[1] ? steel : acc;
        g.beginPath(); g.moveTo(X(z0[0]), Y(-z0[1])); g.lineTo(X(z1[0]), Y(-z1[1])); g.stroke();
      }
      const lbl = [[X(Rb), Y(0) - 12], [X(Rb + Rgb / 2), Y(Rgb / 2) - 10], [X(Rb + Rgb + Rct / 2), Y(Rct / 2) - 10]];
      decades(a, Zf, lbl.concat(lbl.map(p => [p[0] + 30, p[1]]), lbl.map(p => [p[0] - 30, p[1]])));
      // R_b intercept
      g.strokeStyle = wht; g.lineWidth = 1.5; g.beginPath(); g.arc(X(Rb), Y(0), 6, 0, 2 * Math.PI); g.stroke();
      g.fillStyle = wht; g.font = '11px ' + css('--sans', 'sans-serif'); g.textAlign = 'center';
      sub(g, 'R', 'b', X(Rb), Y(0) - 12);
      if (Rgb > 0) { g.fillStyle = steel; g.fillText('grain boundaries', X(Rb + Rgb / 2), Y(Rgb / 2) - 10); }
      if (Rct > 0) { g.fillStyle = acc; g.fillText('Li interfaces', X(Rb + Rgb + Rct / 2), Y(Rct / 2) - 10); }
      g.textAlign = 'left';
      g.restore();
      out.textContent = 'Bulk resistance ' + Rb + ' Ω.' +
        (Rgb > 0 ? ' Grain-boundary arc ' + Rgb + ' Ω, top at ' + fmtF(fG) + '.' : ' No grain-boundary arc.') +
        (Rct > 0 ? ' Interface arc ' + Rct + ' Ω, top at ' + fmtF(fT) + '.' : ' No interface arc.') +
        ' Total ' + (Rb + Rgb + Rct) + ' Ω.';
    }
    [iB, iG, iT].forEach(el => el.addEventListener('input', draw));
    window.addEventListener('resize', draw);
    draw();
  }

  figRC();
  figCell();
})();
