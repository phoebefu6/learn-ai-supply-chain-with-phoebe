/* ============================================================
   asc-live.js - learn-ai-supply-chain-with-phoebe
   Five widgets, computed for real in your browser.

   1. FORECAST PLAYGROUND (sessions 1 and 5). 45 real SKUs, 104 real
      weeks of UCI Online Retail II demand (assets/asc-sample.js).
      Five forecasters run one week ahead: naive, 8-week moving
      average, seasonal naive, simple exponential smoothing and a
      small learned model (pooled ridge on recent lags + week of
      year). Scored on the last 26 weeks, which no model saw.
      REAL: the rows, every forecast, every error.
   2. STOCK POLICY (session 2). Safety stock = z x sigma x sqrt(L)
      from each forecaster's own error, then checked on the 26
      holdout weeks. REAL: the errors and the check. The service
      targets and lead time are levers.
   3. ALLOCATION (session 3). Four allocation rules on one short-
      supply week. CONSTRUCTED: Northwick's channels and margins.
   4. BULLWHIP (session 4). Order-up-to policy across three tiers
      fed the real weekly demand. REAL: demand and the policy maths.
   5. BUSINESS CASE (session 6). Safety stock, expected units short
      and holding cost before and after a forecast-error cut.
      REAL: the formulas. CONSTRUCTED: every Northwick volume, cost
      and price.

   materials/asc_reference.py recomputes every number in Python, in
   the same order, and materials/compare-ladder.py checks they agree.
   ============================================================ */
(function () {
  "use strict";

  var METHODS = ["naive", "ma8", "snaive", "ses", "learned"];
  var BASELINES = ["naive", "ma8", "snaive", "ses"];
  var T0 = 52, LAMBDA = 1.0, WIN = 13, CAP = 3.0;
  var CELLS = ["AX", "AY", "AZ", "BX", "BY", "BZ", "CX", "CY", "CZ"];

  /* ------------------------------------------------ normal helpers */
  function normPdf(z) { return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI); }
  function normCdf(z) {
    var t = 1.0 / (1.0 + 0.2316419 * Math.abs(z));
    var poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    var p = 1.0 - normPdf(Math.abs(z)) * poly;
    return z >= 0 ? p : 1.0 - p;
  }
  function invNorm(p) {
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
      1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
      6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var lo = 0.02425, q, r;
    if (p < lo) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - lo) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function lossG(z) { return normPdf(z) - z * (1.0 - normCdf(z)); }

  /* ------------------------------------------------ forecasting */
  function level(y, t) {
    var s = 0.0;
    for (var k = 1; k <= WIN; k++) s += y[t - k];
    return s / WIN;
  }
  function features(y, t, r) {
    var s8 = 0.0;
    for (var k = 1; k < 9; k++) s8 += y[t - k];
    var w = 2 * Math.PI * t / 52;
    return [1.0, y[t - 1] / r, y[t - 2] / r, y[t - 3] / r, y[t - 4] / r, (s8 / 8) / r,
      Math.sin(w), Math.cos(w), Math.sin(2 * w), Math.cos(2 * w)];
  }
  function solve(A, b) {
    var n = b.length, M = [], i, r, c;
    for (i = 0; i < n; i++) M.push(A[i].slice().concat([b[i]]));
    for (var col = 0; col < n; col++) {
      var piv = col;
      for (r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      var tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
      for (r = col + 1; r < n; r++) {
        var f = M[r][col] / M[col][col];
        for (c = col; c < n + 1; c++) M[r][c] -= f * M[col][c];
      }
    }
    var x = new Array(n).fill(0.0);
    for (i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (c = i + 1; c < n; c++) s -= M[i][c] * x[c];
      x[i] = s / M[i][i];
    }
    return x;
  }
  function fitLearned(S) {
    var fit = S.fit, nf = 10, A = [], b = new Array(nf).fill(0.0), i, j;
    for (i = 0; i < nf; i++) A.push(new Array(nf).fill(0.0));
    S.skus.forEach(function (sku) {
      var y = sku.demand;
      for (var t = WIN; t < fit; t++) {
        var r = level(y, t);
        if (r <= 0) continue;
        var x = features(y, t, r), tgt = Math.min(y[t] / r, CAP);
        for (i = 0; i < nf; i++) {
          b[i] += x[i] * tgt;
          for (j = 0; j < nf; j++) A[i][j] += x[i] * x[j];
        }
      }
    });
    for (i = 1; i < nf; i++) A[i][i] += LAMBDA;
    return solve(A, b);
  }
  function sesAlpha(y, fit) {
    var bestK = 1, best = null;
    for (var k = 1; k < 10; k++) {
      var a = k / 10, lev = y[0], sse = 0.0;
      for (var t = 1; t < fit; t++) {
        var e = y[t] - lev;
        sse += e * e;
        lev = a * y[t] + (1 - a) * lev;
      }
      if (best === null || sse < best) { best = sse; bestK = k; }
    }
    return bestK / 10;
  }
  var cacheS = null, cacheF = null;
  function forecastAll(S) {
    if (cacheS === S && cacheF) return cacheF;
    var n = S.weeks.length, fit = S.fit, beta = fitLearned(S);
    var out = S.skus.map(function (sku) {
      var y = sku.demand, a = sesAlpha(y, fit), lev = y[0], t;
      var sesf = new Array(n).fill(null);
      for (t = 1; t < n; t++) { sesf[t] = lev; lev = a * y[t] + (1 - a) * lev; }
      var F = {};
      METHODS.forEach(function (m) { F[m] = new Array(n).fill(null); });
      for (t = T0; t < n; t++) {
        F.naive[t] = y[t - 1];
        var s8 = 0.0;
        for (var k = 1; k < 9; k++) s8 += y[t - k];
        F.ma8[t] = s8 / 8;
        F.snaive[t] = y[t - 52];
        F.ses[t] = sesf[t];
        var r = level(y, t);
        if (r <= 0) F.learned[t] = 0.0;
        else {
          var x = features(y, t, r), v = 0.0;
          for (var i = 0; i < 10; i++) v += x[i] * beta[i];
          F.learned[t] = Math.max(0.0, v * r);
        }
      }
      return { F: F, alpha: a };
    });
    cacheS = S; cacheF = { FA: out, beta: beta };
    return cacheF;
  }
  function sums(S, FA, method, from, to, adj) {
    return S.skus.map(function (sku, i) {
      var y = sku.demand, f = FA[i].F[method], ab = 0.0, er = 0.0, ac = 0.0;
      for (var t = from; t < to; t++) {
        var ft = f[t] * (1 + adj);
        ab += Math.abs(ft - y[t]); er += ft - y[t]; ac += y[t];
      }
      return [ab, er, ac];
    });
  }
  function agg(S, rows, keyf) {
    var g = {};
    S.skus.forEach(function (sku, i) {
      var k = keyf(sku);
      if (!g[k]) g[k] = [0.0, 0.0, 0.0];
      for (var j = 0; j < 3; j++) g[k][j] += rows[i][j];
    });
    var out = {};
    Object.keys(g).sort().forEach(function (k) { out[k] = { wape: g[k][0] / g[k][2], bias: g[k][1] / g[k][2] }; });
    return out;
  }
  function score(S, FA, method, adj) {
    var rows = sums(S, FA, method, S.fit, S.weeks.length, adj || 0);
    return {
      overall: agg(S, rows, function () { return "all"; }).all,
      cells: agg(S, rows, function (s) { return s.abc + s.xyz; }),
      abc: agg(S, rows, function (s) { return s.abc; }),
      xyz: agg(S, rows, function (s) { return s.xyz; }),
      sku: rows.map(function (r) { return r[0] / r[2]; })
    };
  }
  function playground(S) {
    var FA = forecastAll(S).FA, sc = {};
    METHODS.forEach(function (m) { sc[m] = score(S, FA, m); });
    var best = {};
    CELLS.forEach(function (c) {
      var bm = null;
      BASELINES.forEach(function (m) { if (bm === null || sc[m].cells[c].wape < sc[bm].cells[c].wape) bm = m; });
      var bw = sc[bm].cells[c].wape, lw = sc.learned.cells[c].wape;
      best[c] = { baseline: bm, wape: bw, learned: lw, lift: (bw - lw) / bw };
    });
    var ob = null;
    BASELINES.forEach(function (m) { if (ob === null || sc[m].overall.wape < sc[ob].overall.wape) ob = m; });
    var obw = sc[ob].overall.wape, lw = sc.learned.overall.wape, methods = {};
    METHODS.forEach(function (m) { methods[m] = { overall: sc[m].overall, cells: sc[m].cells, abc: sc[m].abc, xyz: sc[m].xyz }; });
    return {
      methods: methods, bestByCell: best,
      bestBaseline: { method: ob, wape: obw },
      learnedLift: (obw - lw) / obw,
      learnedVsNaive: (sc.naive.overall.wape - lw) / sc.naive.overall.wape,
      learnedWins: CELLS.filter(function (c) { return best[c].lift > 0; }).length,
      override15: score(S, FA, "learned", 0.15).overall,
      alphas: FA.map(function (r) { return r.alpha; })
    };
  }

  /* ------------------------------------------------ stock policy */
  var STOCK_RUNGS = [
    ["flat", { method: "ma8", csl: { A: 0.95, B: 0.95, C: 0.95 }, L: 2 }],
    ["tiered", { method: "ma8", csl: { A: 0.98, B: 0.95, C: 0.90 }, L: 2 }],
    ["learned", { method: "learned", csl: { A: 0.98, B: 0.95, C: 0.90 }, L: 2 }],
    ["naive", { method: "naive", csl: { A: 0.98, B: 0.95, C: 0.90 }, L: 2 }],
    ["longlead", { method: "ma8", csl: { A: 0.98, B: 0.95, C: 0.90 }, L: 6 }]
  ];
  function stock(S, o) {
    var FA = forecastAll(S).FA, fit = S.fit, n = S.weeks.length, tot = 0.0, cls = {}, order = [];
    var perSku = [];
    S.skus.forEach(function (sku, i) {
      var y = sku.demand, f = FA[i].F[o.method], se = 0.0, t;
      for (t = T0; t < fit; t++) { var e = y[t] - f[t]; se += e * e; }
      var sigma = Math.sqrt(se / (fit - T0));
      var z = invNorm(o.csl[sku.abc]);
      var ss = z * sigma * Math.sqrt(o.L);
      var val = ss * sku.price, hits = 0;
      for (t = fit; t < n; t++) if (y[t] <= f[t] + z * sigma) hits += 1;
      tot += val;
      if (!cls[sku.abc]) { cls[sku.abc] = { value: 0.0, hits: 0, weeks: 0, target: o.csl[sku.abc] }; order.push(sku.abc); }
      var c = cls[sku.abc];
      c.value += val; c.hits += hits; c.weeks += n - fit;
      perSku.push({ sigma: sigma, ss: ss, value: val, achieved: hits / (n - fit) });
    });
    var hitsAll = 0, weeksAll = 0, classes = {};
    Object.keys(cls).sort().forEach(function (k) {
      var c = cls[k];
      hitsAll += c.hits; weeksAll += c.weeks;
      classes[k] = { value: c.value, achieved: c.hits / c.weeks, target: c.target };
    });
    return { value: tot, achieved: hitsAll / weeksAll, classes: classes, perSku: perSku };
  }

  /* ------------------------------------------------ allocation (constructed) */
  var ALLOC = { channels: [["North stores", 700, 7.5], ["South stores", 500, 6.8], ["Online", 400, 9.0]] };
  var ALLOC_RUNGS = [["fair", 1200], ["stores", 1200], ["margin", 1200], ["floor", 1200], ["fair", 800]];
  function allocate(rule, supply, floor) {
    if (floor == null) floor = 0.5;
    var ch = ALLOC.channels, give = ch.map(function () { return 0.0; }), i;
    var total = 0;
    ch.forEach(function (c) { total += c[1]; });
    if (rule === "fair") {
      ch.forEach(function (c, k) { give[k] = Math.min(c[1], supply * c[1] / total); });
    } else {
      var left = supply;
      if (rule === "floor") {
        ch.forEach(function (c, k) { var g = Math.min(c[1] * floor, left); give[k] = g; left -= g; });
      }
      var order = rule === "stores" ? [0, 1, 2]
        : [0, 1, 2].sort(function (a, b) { return (ch[b][2] - ch[a][2]) || (a - b); });
      for (i = 0; i < order.length; i++) {
        var k2 = order[i], g2 = Math.min(ch[k2][1] - give[k2], left);
        give[k2] += g2; left -= g2;
      }
    }
    var rows = ch.map(function (c, k) { return { name: c[0], units: give[k], fill: give[k] / c[1], margin: give[k] * c[2] }; });
    var m = 0, lowest = Infinity;
    rows.forEach(function (r) { m += r.margin; lowest = Math.min(lowest, r.fill); });
    return { rows: rows, margin: m, lowestFill: lowest };
  }

  /* ------------------------------------------------ bullwhip */
  var BW_RUNGS = [
    ["base", { p: 8, L: 2, share: false, batch: 1 }],
    ["jumpy", { p: 4, L: 2, share: false, batch: 1 }],
    ["slowship", { p: 8, L: 4, share: false, batch: 1 }],
    ["batch", { p: 8, L: 2, share: false, batch: 4 }],
    ["share", { p: 8, L: 2, share: true, batch: 1 }],
    ["cure", { p: 13, L: 2, share: true, batch: 1 }]
  ];
  var BW_Z = 1.65, BW_EV0 = 13;
  function demandSeries(S, code) {
    var n = S.weeks.length, t;
    if (code && code !== "all") {
      for (var i = 0; i < S.skus.length; i++) if (S.skus[i].code === code) return S.skus[i].demand.slice();
    }
    var out = new Array(n).fill(0.0);
    S.skus.forEach(function (s) { for (t = 0; t < n; t++) out[t] += s.demand[t]; });
    return out;
  }
  function pvar(x, a, b) {
    var m = 0.0, t;
    for (t = a; t < b; t++) m += x[t];
    m /= (b - a);
    var v = 0.0;
    for (t = a; t < b; t++) v += (x[t] - m) * (x[t] - m);
    return v / (b - a);
  }
  function bullwhip(S, o, code) {
    var D = demandSeries(S, code || "all"), n = D.length, p = o.p, L = o.L, X = D;
    var ratios = [], orders = [], vd = pvar(D, BW_EV0, n);
    for (var k = 0; k < 3; k++) {
      var B = o.share ? D : X, q = new Array(n).fill(0.0), prevS = null, acc = 0.0;
      for (var t = 0; t < n; t++) {
        var raw;
        if (t + 1 >= p) {
          var mu = 0.0, j;
          for (j = t - p + 1; j < t + 1; j++) mu += B[j];
          mu /= p;
          var v = 0.0;
          for (j = t - p + 1; j < t + 1; j++) v += (B[j] - mu) * (B[j] - mu);
          var sd = Math.sqrt(v / p);
          var St = (L + 1) * mu + BW_Z * sd * Math.sqrt(L + 1);
          raw = prevS === null ? X[t] : Math.max(0.0, X[t] + St - prevS);
          prevS = St;
        } else raw = X[t];
        if (k === 0 && o.batch > 1) {
          acc += raw;
          if ((t + 1) % o.batch === 0) { q[t] = acc; acc = 0.0; }
        } else q[t] = raw;
      }
      ratios.push(pvar(q, BW_EV0, n) / vd);
      orders.push(q);
      X = q;
    }
    return { ratios: ratios, orders: orders, demand: D };
  }

  /* ------------------------------------------------ business case (constructed) */
  var NW = { skus: 4000, mu: 80.0, unitCost: 6.0, unitMargin: 6.0, errRatio: 0.55, orderWeeks: 2.0 };
  var BASE_LV = { tool: true, impr: 0.0, cover: 1.0, L: 4, csl: 0.95, rate: 0.25, toolCost: 250000.0,
    setup: 150000.0, bank: "cash", upBias: 0.0 };
  function caseRungs(pg, S) {
    var cat = S.catalogue.cells, tot = 0;
    CELLS.forEach(function (c) { tot += cat[c]; });
    var win = CELLS.filter(function (c) { return pg.bestByCell[c].lift > 0; });
    var share = 0.0, wl = 0.0;
    win.forEach(function (c) { share += cat[c] / tot; wl += pg.bestByCell[c].lift * cat[c] / tot; });
    var seg = share > 0 ? wl / share : 0.0;
    function lv(kw) { var d = {}; Object.keys(BASE_LV).forEach(function (k) { d[k] = BASE_LV[k]; }); Object.keys(kw).forEach(function (k) { d[k] = kw[k]; }); return d; }
    return [
      ["today", lv({ tool: false })],
      ["vendor", lv({ impr: 0.30 })],
      ["bench", lv({ impr: pg.learnedLift })],
      ["earns", lv({ impr: seg, cover: share })],
      ["service", lv({ impr: seg, cover: share, bank: "service" })],
      ["override", lv({ impr: 0.30, upBias: 0.10 })]
    ];
  }
  function core(lv) {
    var mu = NW.mu, sig0 = NW.errRatio * mu, rL = Math.sqrt(lv.L), z0 = invNorm(lv.csl);
    var sigL0 = sig0 * rL, sigL1 = sig0 * (1 - lv.impr) * rL;
    var cyc = 52.0 / NW.orderWeeks, Q = NW.orderWeeks * mu;
    var ss0 = z0 * sigL0, esc0 = sigL0 * lossG(z0), z1, ss1;
    if (lv.bank === "cash") { z1 = z0; ss1 = z0 * sigL1; } else { z1 = ss0 / sigL1; ss1 = ss0; }
    var esc1 = sigL1 * lossG(z1), cov = lv.cover, n = NW.skus;
    var ssv0 = ss0 * NW.unitCost * n;
    var ssv1 = (cov * ss1 + (1 - cov) * ss0) * NW.unitCost * n;
    var biasv = lv.upBias * mu * (lv.L + 1) * NW.unitCost * n * cov;
    var stock1 = ssv1 + biasv;
    var lost0 = esc0 * cyc * NW.unitMargin * n;
    var lost1 = (cov * esc1 + (1 - cov) * esc0) * cyc * NW.unitMargin * n;
    var cash = ssv0 - stock1, hold = cash * lv.rate, marg = lost0 - lost1;
    var tool = lv.tool ? lv.toolCost : 0.0, net = hold + marg - tool;
    var pay = net > 0 && tool > 0 ? lv.setup / (net / 12) : null;
    return { ssValueToday: ssv0, stockAfter: stock1, cashReleased: cash, holdingSaving: hold,
      marginSaving: marg, toolCost: tool, netAnnual: net, paybackMonths: pay,
      cslAfter: cov * normCdf(z1) + (1 - cov) * normCdf(z0),
      fillToday: 1 - esc0 / Q, fillAfter: 1 - (cov * esc1 + (1 - cov) * esc0) / Q, biasStock: biasv };
  }
  function breakEven(lv) {
    function net(x) { var d = {}; Object.keys(lv).forEach(function (k) { d[k] = lv[k]; }); d.impr = x; d.tool = true; return core(d).netAnnual; }
    if (net(0.9) < 0) return null;
    var lo = 0.0, hi = 0.9;
    for (var i = 0; i < 50; i++) { var mid = (lo + hi) / 2; if (net(mid) < 0) lo = mid; else hi = mid; }
    return hi;
  }
  function simulate(lv) { var o = core(lv); o.breakEven = breakEven(lv); return o; }

  var ENGINE = { METHODS: METHODS, CELLS: CELLS, NW: NW, ALLOC: ALLOC, invNorm: invNorm, normCdf: normCdf,
    forecastAll: forecastAll, score: score, playground: playground, stock: stock, allocate: allocate,
    bullwhip: bullwhip, caseRungs: caseRungs, simulate: simulate,
    STOCK_RUNGS: STOCK_RUNGS, ALLOC_RUNGS: ALLOC_RUNGS, BW_RUNGS: BW_RUNGS };

  if (typeof module !== "undefined" && module.exports) module.exports = ENGINE;
  if (typeof window === "undefined") return;
  window.ASC_ENGINE = ENGINE;

  /* ================================================ DOM widgets */
  var MNAME = { naive: "Naive (last week)", ma8: "8-week average", snaive: "Same week last year",
    ses: "Exponential smoothing", learned: "Learned model" };
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 1 : d) + "%"; }
  function spct(x, d) { return (x > 0 ? "+" : "") + pct(x, d); }
  function gbp(n) { var s = Math.round(Math.abs(n)).toLocaleString("en-GB"); return (n < 0 ? "-" : "") + "£" + s; }
  function shell(root, title, sub) {
    var wk = el("div", "wk asc-wk"), head = el("div", "wk-head");
    head.appendChild(el("b", null, title));
    if (sub) head.appendChild(el("span", "wk-hint", sub));
    wk.appendChild(head);
    var body = el("div", "wk-body");
    wk.appendChild(body);
    root.appendChild(wk);
    return body;
  }
  function meter(parent, label, cls) {
    var m = el("div", "asc-meter " + (cls || "")), big = el("output", "asc-big", "-");
    m.appendChild(big);
    var lab = el("span", "asc-mlab", label);
    m.appendChild(lab);
    var sub = el("span", "asc-msub", "");
    m.appendChild(sub);
    parent.appendChild(m);
    return { big: big, sub: sub, box: m, lab: lab };
  }
  function chips(parent, items, onPick) {
    var bar = el("div", "asc-presets"), btns = {};
    items.forEach(function (it) {
      var b = el("button", "asc-chip", it[1]);
      b.type = "button";
      b.addEventListener("click", function () { onPick(it[0]); });
      btns[it[0]] = b;
      bar.appendChild(b);
    });
    parent.appendChild(bar);
    return { bar: bar, set: function (id) { Object.keys(btns).forEach(function (k) { btns[k].classList.toggle("on", k === id); }); } };
  }
  function slider(parent, label, min, max, step, fmt, onInput) {
    var lab = el("label", "asc-slider");
    lab.appendChild(el("span", null, label + " "));
    var out = el("b", null, "");
    lab.appendChild(out);
    var inp = document.createElement("input");
    inp.type = "range"; inp.min = String(min); inp.max = String(max); inp.step = String(step);
    inp.setAttribute("aria-label", label);
    inp.addEventListener("input", function () { onInput(Number(inp.value)); });
    lab.appendChild(inp);
    parent.appendChild(lab);
    return { set: function (v) { inp.value = String(v); out.textContent = fmt(v); } };
  }
  function rail(parent, text) { parent.appendChild(el("p", "asc-rail", text)); }
  function sparkSvg(series, colours, h) {
    /* lines only, no text: the legend lives in HTML next to it */
    var W = 640, H = h || 150, n = series[0].length, mx = 0;
    series.forEach(function (s) { s.forEach(function (v) { if (v != null && v > mx) mx = v; }); });
    if (mx <= 0) mx = 1;
    var ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("class", "asc-spark");
    svg.setAttribute("aria-hidden", "true");
    var base = document.createElementNS(ns, "line");
    base.setAttribute("x1", "0"); base.setAttribute("x2", String(W)); base.setAttribute("y1", String(H - 4)); base.setAttribute("y2", String(H - 4));
    base.setAttribute("stroke", "var(--hairline)"); base.setAttribute("stroke-width", "1.5");
    svg.appendChild(base);
    series.forEach(function (s, k) {
      var pts = [];
      s.forEach(function (v, i) { if (v != null) pts.push((i * (W - 8) / (n - 1) + 4).toFixed(1) + "," + (H - 4 - v / mx * (H - 14)).toFixed(1)); });
      var pl = document.createElementNS(ns, "polyline");
      pl.setAttribute("points", pts.join(" "));
      pl.setAttribute("fill", "none");
      pl.setAttribute("stroke", colours[k]);
      pl.setAttribute("stroke-width", k === 0 ? "2.4" : "1.8");
      pl.setAttribute("stroke-linejoin", "round");
      if (k > 0) pl.setAttribute("stroke-dasharray", k === 1 ? "6 4" : "2 4");
      svg.appendChild(pl);
    });
    return svg;
  }
  function legend(parent, items) {
    var p = el("p", "asc-legend");
    items.forEach(function (it) {
      var s = el("span", "asc-key");
      var sw = el("i", "asc-sw");
      sw.style.borderTopColor = it[0];
      sw.style.borderTopStyle = it[2] || "solid";
      s.appendChild(sw);
      s.appendChild(document.createTextNode(it[1]));
      p.appendChild(s);
    });
    parent.appendChild(p);
    return p;
  }

  /* ------------------------------------------------ 1. forecast playground */
  function mountPlay(root) {
    var S = window.ASC_SAMPLE, cat = S.catalogue;
    var body = shell(root, "Forecast playground: 45 real SKUs, 26 weeks no model saw",
      "UCI Online Retail II, one week ahead, scored on 2011-06-06 to 2011-11-28");
    var pg = playground(S), FA = forecastAll(S).FA;
    var state = { method: "learned", adj: 0, sku: 0 };
    var pick = chips(body, METHODS.map(function (m) { return [m, MNAME[m]]; }), function (m) { state.method = m; render(); });
    var ctl = el("div", "asc-ctl");
    var adjS = slider(ctl, "Planner override on every forecast", -0.3, 0.3, 0.05, function (v) { return spct(v, 0); },
      function (v) { state.adj = v; render(); });
    body.appendChild(ctl);
    var reads = el("div", "asc-reads");
    var mW = meter(reads, "WAPE: units wrong per unit sold"), mB = meter(reads, "bias: over (+) or under (-)");
    var mL = meter(reads, "vs the best spreadsheet method"), mC = meter(reads, "cells where the learned model wins");
    body.appendChild(reads);
    var verdict = el("p", "asc-verdict");
    body.appendChild(verdict);
    body.appendChild(el("p", "asc-note", "Error by segment. Rows: ABC by revenue. Columns: XYZ by how jumpy weekly demand is. Olive tint: the learned model beats the best of the four spreadsheet methods in that cell. Yellow tint: a spreadsheet method wins."));
    var grid = el("div", "asc-grid");
    body.appendChild(grid);
    var skuWrap = el("details", "asc-skus");
    skuWrap.appendChild(el("summary", null, "Look at one SKU: actual vs forecast across the 26 holdout weeks"));
    var sel = document.createElement("select");
    sel.className = "asc-select";
    sel.setAttribute("aria-label", "Pick a SKU");
    S.skus.forEach(function (s, i) { var o = el("option", null, s.abc + s.xyz + " · " + s.name); o.value = String(i); sel.appendChild(o); });
    sel.addEventListener("change", function () { state.sku = Number(sel.value); render(); });
    var skuBody = el("div", "asc-skubody");
    skuBody.appendChild(sel);
    var chartBox = el("div", "asc-chart");
    skuBody.appendChild(chartBox);
    var skuNote = el("p", "asc-note");
    skuBody.appendChild(skuNote);
    skuWrap.appendChild(skuBody);
    body.appendChild(skuWrap);
    rail(body, "Real: " + cat.productSkus.toLocaleString("en-GB") + " product codes, " + cat.eligible.toLocaleString("en-GB") +
      " sold from start to end; the 45 here are 5 per ABC x XYZ cell, drawn with a fixed seed. The textbook X cut (weekly demand CV at or under 0.5) finds " +
      cat.textbookX + " of the " + cat.eligible.toLocaleString("en-GB") + "; the median CV is " + cat.cvMedian +
      ", so the XYZ cut here is this catalogue's own thirds (CV " + cat.cvCuts[0] + " and " + cat.cvCuts[1] +
      "). The learned model is a pooled ridge regression on the last 4 weeks, the 8-week average and week of year, each scaled by the SKU's 13-week level, trained on weeks before the holdout. The override slider is the only thing you add.");
    var last = null;
    function render() {
      pick.set(state.method);
      adjS.set(state.adj);
      var sc = score(S, FA, state.method, state.adj);
      var o = sc.overall, bb = pg.bestBaseline;
      mW.big.textContent = pct(o.wape);
      mW.sub.textContent = MNAME[state.method] + (state.adj ? ", override " + spct(state.adj, 0) : "");
      mB.big.textContent = spct(o.bias);
      mB.sub.textContent = o.bias < 0 ? "forecasts run short of what sold" : "forecasts run over what sold";
      var lift = (bb.wape - o.wape) / bb.wape;
      mL.big.textContent = spct(lift);
      mL.sub.textContent = "best spreadsheet: " + MNAME[bb.method] + " at " + pct(bb.wape);
      mL.box.classList.toggle("asc-warn", lift < 0);
      mC.big.textContent = pg.learnedWins + " of 9";
      mC.sub.textContent = "no override; vs the best baseline per cell";
      verdict.textContent = state.adj !== 0
        ? (function () {
            var w0 = score(S, FA, state.method, 0).overall;
            return o.wape > w0.wape
              ? "An override on every forecast moves the bias and costs accuracy: WAPE " + pct(o.wape) + " against " + pct(w0.wape) + " untouched."
              : "WAPE improves to " + pct(o.wape) + " (untouched " + pct(w0.wape) + ") while bias moves to " + spct(o.bias) + ": on lumpy demand WAPE rewards forecasting low, so read both.";
          })()
        : state.method === "learned"
          ? "The learned model is " + pct(pg.learnedLift) + " better than the best spreadsheet method overall, and it runs " + pct(-o.bias) + " short. It wins on the jumpy cells and loses on the steady ones."
          : state.method === "snaive"
            ? "Same week last year is the worst here: these SKUs sold less in 2011 than in 2010, so it forecasts " + spct(o.bias) + " too high."
            : MNAME[state.method] + ": WAPE " + pct(o.wape) + ". Pick the learned model to see where it earns its place.";
      grid.innerHTML = "";
      grid.appendChild(el("span", "asc-gh", ""));
      ["X steady", "Y jumpy", "Z very jumpy"].forEach(function (h) { grid.appendChild(el("span", "asc-gh", h)); });
      ["A", "B", "C"].forEach(function (a) {
        grid.appendChild(el("span", "asc-gh asc-gr", a + (a === "A" ? " top 80% revenue" : a === "B" ? " next 15%" : " last 5%")));
        ["X", "Y", "Z"].forEach(function (x) {
          var c = a + x, b = pg.bestByCell[c], w = sc.cells[c];
          var cell = el("div", "asc-cell " + (b.lift > 0 ? "win" : "lose"));
          cell.appendChild(el("b", null, pct(w.wape, 0)));
          cell.appendChild(el("span", null, "best sheet " + pct(b.wape, 0) + " (" + MNAME[b.baseline].split(" (")[0] + ")"));
          grid.appendChild(cell);
        });
      });
      var s = S.skus[state.sku], f = FA[state.sku].F[state.method], act = [], fc = [];
      for (var t = S.fit; t < S.weeks.length; t++) { act.push(s.demand[t]); fc.push(f[t] * (1 + state.adj)); }
      chartBox.innerHTML = "";
      chartBox.appendChild(sparkSvg([act, fc], ["var(--indigo-deep)", "var(--amber-ink)"]));
      legend(chartBox, [["var(--indigo-deep)", "units sold"], ["var(--amber-ink)", MNAME[state.method], "dashed"]]);
      skuNote.textContent = s.name + " (" + s.code + ", cell " + s.abc + s.xyz + ", £" + s.price.toFixed(2) + " a unit): WAPE " + pct(sc.sku[state.sku]) +
        " on " + act.reduce(function (p, v) { return p + v; }, 0).toLocaleString("en-GB") + " units sold in the holdout.";
      last = { method: state.method, adj: state.adj, wape: o.wape, bias: o.bias, lift: lift, wins: pg.learnedWins };
      window.ASC_PLAY.last = last;
    }
    window.ASC_PLAY = { method: function (m) { state.method = m; render(); }, adj: function (v) { state.adj = v; render(); },
      result: function () { return window.ASC_PLAY.last; }, canon: pg };
    render();
  }

  /* ------------------------------------------------ 2. stock policy */
  function mountStock(root) {
    var S = window.ASC_SAMPLE;
    var body = shell(root, "Stock policy: safety stock from each forecaster's own error",
      "z x sigma x sqrt(lead time), then checked on 26 real weeks");
    var o = { method: "ma8", csl: { A: 0.95, B: 0.95, C: 0.95 }, L: 2 }, cur = null;
    var RL = { flat: "95% on everything", tiered: "Tier by ABC: 98 / 95 / 90", learned: "Same tiers, learned model",
      naive: "Same tiers, naive forecast", longlead: "Lead time 6 weeks" };
    var rungs = chips(body, STOCK_RUNGS.map(function (r) { return [r[0], RL[r[0]]]; }), function (id) { setRung(id); });
    var mpick = chips(body, METHODS.map(function (m) { return [m, MNAME[m]]; }), function (m) { o.method = m; cur = null; render(); });
    var sl = el("div", "asc-sliders"), S2 = {};
    ["A", "B", "C"].forEach(function (k) {
      S2[k] = slider(sl, "Cycle service target, " + k + " items", 0.8, 0.99, 0.01, function (v) { return pct(v, 0); },
        function (v) { o.csl[k] = v; cur = null; render(); });
    });
    S2.L = slider(sl, "Lead time in weeks", 1, 8, 1, function (v) { return v + (v === 1 ? " week" : " weeks"); },
      function (v) { o.L = v; cur = null; render(); });
    body.appendChild(sl);
    var reads = el("div", "asc-reads");
    var mV = meter(reads, "safety stock value, 45 SKUs"), mA = meter(reads, "service achieved, all SKUs");
    var mT = meter(reads, "A items: target vs achieved"), mC = meter(reads, "C items: target vs achieved");
    body.appendChild(reads);
    var verdict = el("p", "asc-verdict");
    body.appendChild(verdict);
    var table = el("table", "clean asc-ledger");
    body.appendChild(table);
    rail(body, "Real: sigma is the root mean squared one-week-ahead error of the chosen forecaster over weeks 52 to 77 (before the holdout; the learned model was trained on those weeks too, so its sigma flatters it). Achieved service = the share of the 26 holdout weeks where units sold fitted under forecast + z x sigma, one week ahead. Unit values are the real average prices. The lead-time lever scales stock by sqrt(L) as the textbook formula does; the weekly check does not change with it.");
    var last = null;
    function setRung(id) {
      STOCK_RUNGS.forEach(function (r) { if (r[0] === id) { o.method = r[1].method; o.L = r[1].L; o.csl = { A: r[1].csl.A, B: r[1].csl.B, C: r[1].csl.C }; } });
      cur = id; render();
    }
    function render() {
      rungs.set(cur); mpick.set(o.method);
      ["A", "B", "C"].forEach(function (k) { S2[k].set(o.csl[k]); });
      S2.L.set(o.L);
      var r = stock(S, o), base = stock(S, STOCK_RUNGS[0][1]);
      mV.big.textContent = gbp(r.value);
      mV.sub.textContent = (r.value >= base.value ? "+" : "") + gbp(r.value - base.value) + " vs 95% flat on the 8-week average";
      mA.big.textContent = pct(r.achieved);
      mA.sub.textContent = "of 1,170 SKU-weeks covered";
      mT.big.textContent = pct(r.classes.A.achieved);
      mT.sub.textContent = "target " + pct(r.classes.A.target, 0);
      mT.box.classList.toggle("asc-warn", r.classes.A.achieved < r.classes.A.target);
      mC.big.textContent = pct(r.classes.C.achieved);
      mC.sub.textContent = "target " + pct(r.classes.C.target, 0);
      mC.box.classList.toggle("asc-warn", r.classes.C.achieved < r.classes.C.target);
      var short = ["A", "B", "C"].filter(function (k) { return r.classes[k].achieved < r.classes[k].target; });
      verdict.textContent = short.length
        ? "The formula promised " + short.map(function (k) { return k + " " + pct(r.classes[k].target, 0); }).join(", ") +
          " and the real weeks delivered less. Error measured on the past understates the error you meet next."
        : "Every class met its target on the real holdout weeks.";
      table.innerHTML = "";
      var hd = el("tr");
      ["Class", "Target", "Achieved", "Safety stock value"].forEach(function (h) { hd.appendChild(el("th", null, h)); });
      table.appendChild(hd);
      ["A", "B", "C"].forEach(function (k) {
        var tr = el("tr"), c = r.classes[k];
        [k, pct(c.target, 0), pct(c.achieved), gbp(c.value)].forEach(function (v) { tr.appendChild(el("td", null, v)); });
        table.appendChild(tr);
      });
      last = { method: o.method, L: o.L, value: r.value, achieved: r.achieved, A: r.classes.A.achieved, C: r.classes.C.achieved };
      window.ASC_STOCK.last = last;
    }
    window.ASC_STOCK = { setRung: setRung, result: function () { return window.ASC_STOCK.last; },
      set: function (k, v) { o[k] = v; cur = null; render(); } };
    setRung("flat");
  }

  /* ------------------------------------------------ newsvendor tryrow */
  function mountNews(root) {
    var body = shell(root, "Newsvendor: how much service is worth buying", "critical ratio = Cu / (Cu + Co)");
    var st = { cu: 6, co: 2 };
    var sl = el("div", "asc-sliders");
    var a = slider(sl, "Cu: margin lost per unit short (£)", 0.5, 20, 0.5, function (v) { return "£" + v.toFixed(2); }, function (v) { st.cu = v; render(); });
    var b = slider(sl, "Co: cost per unit left over (£)", 0.5, 20, 0.5, function (v) { return "£" + v.toFixed(2); }, function (v) { st.co = v; render(); });
    body.appendChild(sl);
    var reads = el("div", "asc-reads asc-reads2");
    var mR = meter(reads, "service level worth buying"), mZ = meter(reads, "z: safety factor");
    body.appendChild(reads);
    function render() {
      a.set(st.cu); b.set(st.co);
      var cr = st.cu / (st.cu + st.co);
      mR.big.textContent = pct(cr);
      mR.sub.textContent = "Cu " + "£" + st.cu.toFixed(2) + ", Co £" + st.co.toFixed(2);
      mZ.big.textContent = cr >= 0.999 || cr <= 0.001 ? "-" : invNorm(cr).toFixed(2);
      mZ.sub.textContent = cr < 0.5 ? "below the mean forecast" : "above the mean forecast";
      window.ASC_NEWS.last = { ratio: cr, z: invNorm(cr) };
    }
    window.ASC_NEWS = { set: function (cu, co) { st.cu = cu; st.co = co; render(); }, result: function () { return window.ASC_NEWS.last; } };
    render();
  }

  /* ------------------------------------------------ 3. allocation */
  function mountAlloc(root) {
    var body = shell(root, "Short-supply week: 1,200 lanterns, 1,600 wanted",
      "Constructed Northwick example: four rules, the same stock");
    var st = { rule: "fair", supply: 1200, floor: 0.5 }, cur = "fair";
    var RL = { fair: "Fair share", stores: "Stores first", margin: "Highest margin first", floor: "Floor, then margin" };
    var pick = chips(body, ["fair", "stores", "margin", "floor"].map(function (k) { return [k, RL[k]]; }), function (k) { st.rule = k; cur = k; render(); });
    var sl = el("div", "asc-sliders");
    var sS = slider(sl, "Units available this week", 400, 1600, 100, function (v) { return v.toLocaleString("en-GB"); }, function (v) { st.supply = v; render(); });
    var fS = slider(sl, "Floor every channel gets first (floor rule)", 0.2, 0.8, 0.05, function (v) { return pct(v, 0); }, function (v) { st.floor = v; render(); });
    body.appendChild(sl);
    var bars = el("div", "asc-bars");
    body.appendChild(bars);
    var reads = el("div", "asc-reads asc-reads2");
    var mM = meter(reads, "margin this week"), mF = meter(reads, "lowest channel fill");
    body.appendChild(reads);
    var verdict = el("p", "asc-verdict");
    body.appendChild(verdict);
    rail(body, "Constructed Northwick example: North stores want 700 at £7.50 margin a unit, South stores 500 at £6.80, online 400 at £9.00. Real: the arithmetic of each rule. A real optimiser does the same arithmetic over thousands of SKUs and locations; what it cannot do is choose the rule.");
    function render() {
      pick.set(cur); sS.set(st.supply); fS.set(st.floor);
      var r = allocate(st.rule, st.supply, st.floor);
      bars.innerHTML = "";
      r.rows.forEach(function (row) {
        var line = el("div", "asc-bar");
        line.appendChild(el("span", "asc-bname", row.name));
        var track = el("span", "asc-track"), fill = el("i", "asc-fill" + (row.fill < 0.5 ? " low" : ""));
        fill.style.width = (row.fill * 100).toFixed(1) + "%";
        track.appendChild(fill);
        line.appendChild(track);
        line.appendChild(el("span", "asc-bval", Math.round(row.units).toLocaleString("en-GB") + " units · " + pct(row.fill, 0)));
        bars.appendChild(line);
      });
      mM.big.textContent = gbp(r.margin);
      mM.sub.textContent = "at the constructed margins";
      mF.big.textContent = pct(r.lowestFill, 0);
      mF.sub.textContent = r.rows.filter(function (x) { return x.fill === r.lowestFill; })[0].name;
      mF.box.classList.toggle("asc-warn", r.lowestFill < 0.5);
      verdict.textContent = r.lowestFill === 0
        ? "One channel gets nothing. Whoever wrote the rule decided that, whether or not they meant to."
        : r.lowestFill < 0.5
          ? "Most margin, and one channel below half its demand. That is a decision about which customers wait."
          : "Every channel gets at least half of what it asked for.";
      window.ASC_ALLOC.last = { rule: st.rule, supply: st.supply, margin: r.margin, lowestFill: r.lowestFill };
    }
    window.ASC_ALLOC = { rule: function (k) { st.rule = k; cur = k; render(); }, supply: function (v) { st.supply = v; render(); },
      result: function () { return window.ASC_ALLOC.last; } };
    render();
  }

  /* ------------------------------------------------ 4. bullwhip */
  function mountBw(root) {
    var S = window.ASC_SAMPLE;
    var body = shell(root, "Bullwhip lever: three tiers fed 104 real weeks",
      "order-up-to policy at every tier; variance of orders / variance of demand");
    var o = { p: 8, L: 2, share: false, batch: 1 }, code = "all", cur = "base";
    var RL = { base: "Base case", jumpy: "React to 4 weeks", slowship: "Lead time 4 weeks", batch: "Stores order monthly",
      share: "Share sell-through data", cure: "Share data + 13-week view" };
    var rungs = chips(body, BW_RUNGS.map(function (r) { return [r[0], RL[r[0]]]; }), function (id) { setRung(id); });
    var ctl = el("div", "asc-sliders");
    var pS = slider(ctl, "Weeks each tier averages to forecast", 4, 13, 1, function (v) { return v + " weeks"; }, function (v) { o.p = v; cur = null; render(); });
    var lS = slider(ctl, "Lead time between tiers", 1, 6, 1, function (v) { return v + (v === 1 ? " week" : " weeks"); }, function (v) { o.L = v; cur = null; render(); });
    var bS = slider(ctl, "Stores place an order every", 1, 4, 1, function (v) { return v + (v === 1 ? " week" : " weeks"); }, function (v) { o.batch = v; cur = null; render(); });
    body.appendChild(ctl);
    var row = el("div", "asc-ctl");
    var share = el("label", "asc-anti asc-good");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.addEventListener("change", function () { o.share = cb.checked; cur = null; render(); });
    share.appendChild(cb);
    share.appendChild(document.createTextNode(" Share sell-through: every tier forecasts from what customers bought, not from the orders it receives"));
    row.appendChild(share);
    var sel = document.createElement("select");
    sel.className = "asc-select";
    sel.setAttribute("aria-label", "Demand series");
    var o0 = el("option", null, "All 45 SKUs together"); o0.value = "all"; sel.appendChild(o0);
    S.skus.forEach(function (s) { var op = el("option", null, s.abc + s.xyz + " · " + s.name); op.value = s.code; sel.appendChild(op); });
    sel.addEventListener("change", function () { code = sel.value; render(); });
    row.appendChild(sel);
    body.appendChild(row);
    var reads = el("div", "asc-reads asc-reads3");
    var m1 = meter(reads, "stores' orders to the DC"), m2 = meter(reads, "DC's orders to the supplier"), m3 = meter(reads, "supplier's orders to the factory", "asc-bad");
    body.appendChild(reads);
    var chartBox = el("div", "asc-chart");
    body.appendChild(chartBox);
    var verdict = el("p", "asc-verdict");
    body.appendChild(verdict);
    rail(body, "Real: weekly units from UCI Online Retail II and the order-up-to rule (order = demand seen + change in the target level; target = (L + 1) x average + 1.65 x spread x sqrt(L + 1), over the last p weeks). Orders cannot go below zero. Ratios measured over weeks 13 to 103. Each tier is a teaching model of Northwick's chain, not its real policy.");
    function setRung(id) { BW_RUNGS.forEach(function (r) { if (r[0] === id) { o = { p: r[1].p, L: r[1].L, share: r[1].share, batch: r[1].batch }; } }); cur = id; render(); }
    function render() {
      rungs.set(cur); pS.set(o.p); lS.set(o.L); bS.set(o.batch); cb.checked = o.share;
      var r = bullwhip(S, o, code);
      [m1, m2, m3].forEach(function (m, k) {
        m.big.textContent = r.ratios[k].toFixed(1) + "x";
        m.sub.textContent = "variance vs customer demand";
      });
      m3.box.classList.toggle("on", r.ratios[2] > 20);
      chartBox.innerHTML = "";
      chartBox.appendChild(sparkSvg([r.demand.slice(BW_EV0), r.orders[0].slice(BW_EV0), r.orders[1].slice(BW_EV0)],
        ["var(--indigo-deep)", "var(--amber-ink)", "#9A3412"], 170));
      legend(chartBox, [["var(--indigo-deep)", "customer demand"], ["var(--amber-ink)", "stores' orders", "dashed"], ["#9A3412", "DC's orders", "dotted"]]);
      verdict.textContent = r.ratios[2] > 20
        ? "The supplier sees " + r.ratios[2].toFixed(0) + " times the swing customers made. Nobody in the chain did anything wrong; each tier followed a sensible rule."
        : r.ratios[2] < r.ratios[0] * 3
          ? "The swing barely grows up the chain. Every tier is reading the same customer signal."
          : "The swing still grows at each tier, by less.";
      window.ASC_BW.last = { rung: cur, code: code, ratios: r.ratios.slice() };
    }
    window.ASC_BW = { setRung: setRung, series: function (c) { code = c; sel.value = c; render(); },
      set: function (k, v) { o[k] = v; cur = null; render(); }, result: function () { return window.ASC_BW.last; } };
    setRung("base");
  }

  /* ------------------------------------------------ 5. business case */
  function mountCase(root) {
    var S = window.ASC_SAMPLE;
    var body = shell(root, "Northwick's AI planning tool, priced",
      "safety stock, units short and holding cost before and after a forecast-error cut");
    var pg = playground(S), RUNGS = caseRungs(pg, S), lv = {}, cur = null;
    Object.keys(BASE_LV).forEach(function (k) { lv[k] = BASE_LV[k]; });
    var RL = { today: "Today, no tool", vendor: "Vendor claim: error -30%", bench: "The bench: measured cut",
      earns: "Only where it wins", service: "Bank it as service", override: "Claim + upward overrides" };
    var rungs = chips(body, RUNGS.map(function (r) { return [r[0], RL[r[0]]]; }), function (id) { setRung(id); });
    var sl = el("div", "asc-sliders"), I = {};
    function add(k, label, min, max, step, f) { I[k] = slider(sl, label, min, max, step, f, function (v) { lv[k] = v; lv.tool = true; cur = null; render(); }); }
    add("impr", "Cut in forecast error the tool delivers", -0.1, 0.5, 0.01, function (v) { return pct(v, 1); });
    add("cover", "Share of SKUs the tool plans", 0, 1, 0.05, function (v) { return pct(v, 0); });
    add("L", "Supplier lead time", 1, 12, 1, function (v) { return v + " weeks"; });
    add("csl", "Cycle service target", 0.85, 0.99, 0.01, function (v) { return pct(v, 0); });
    add("rate", "Holding cost a year, share of stock value", 0.1, 0.4, 0.01, function (v) { return pct(v, 0); });
    add("toolCost", "Tool cost a year", 0, 800000, 10000, gbp);
    add("upBias", "Planners' upward override, every forecast", 0, 0.3, 0.01, function (v) { return pct(v, 0); });
    body.appendChild(sl);
    var row = el("div", "asc-ctl");
    var svc = el("label", "asc-anti asc-good");
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.addEventListener("change", function () { lv.bank = cb.checked ? "service" : "cash"; cur = null; render(); });
    svc.appendChild(cb);
    svc.appendChild(document.createTextNode(" Bank the gain as service: keep today's stock, let the service level rise"));
    row.appendChild(svc);
    body.appendChild(row);
    var reads = el("div", "asc-reads");
    var mCash = meter(reads, "cash released from stock, one-off"), mNet = meter(reads, "net value a year after tool cost", "asc-bad");
    var mBe = meter(reads, "error cut needed to break even"), mSvc = meter(reads, "service: cycle level / fill rate");
    body.appendChild(reads);
    var verdict = el("p", "asc-verdict");
    body.appendChild(verdict);
    var table = el("table", "clean asc-ledger");
    body.appendChild(table);
    var memoWrap = el("div", "asc-memo");
    var memoBtn = el("button", "asc-chip asc-memo-btn", "Write Northwick's playbook memo from these numbers");
    memoBtn.type = "button";
    var gate = el("p", "asc-gate"), memo = el("div", "prompt-box good asc-memo-text");
    memo.style.display = "none";
    memoWrap.appendChild(memoBtn); memoWrap.appendChild(gate); memoWrap.appendChild(memo);
    body.appendChild(memoWrap);
    var forceOpen = false;
    memoBtn.addEventListener("click", function () {
      var got = window.LWP_PASSPORT ? window.LWP_PASSPORT.count() : 0;
      if (got < 4 && !forceOpen) {
        gate.innerHTML = "";
        gate.appendChild(document.createTextNode("The memo unlocks at 4 passport stamps (you have " + got + "). "));
        var by = el("a", null, "Open it anyway");
        by.href = "#";
        by.addEventListener("click", function (e) { e.preventDefault(); forceOpen = true; gate.textContent = ""; showMemo(); });
        gate.appendChild(by);
        gate.appendChild(document.createTextNode(": the stamps are a nudge, not a lock."));
        return;
      }
      showMemo();
    });
    rail(body, "Real: safety stock = z x sigma x sqrt(L); expected units short per order cycle = sigma x sqrt(L) x G(z), the standard normal loss function; fill rate = 1 - units short / order quantity; an upward bias b adds b x weekly demand x (L + 1) to stock under an order-up-to policy. The bench rungs use the learned model's measured WAPE cut on the real holdout, and the catalogue's real share of SKUs per cell. Constructed Northwick example: 4,000 SKUs, 80 units a week each, £6 cost and £6 margin a unit, weekly error 55% of demand, orders every 2 weeks, £250,000 a year and £150,000 set-up for the tool. Assumes the error spread falls in proportion to WAPE. Re-verify vendor pricing before you sign.");
    var last = null;
    function setRung(id) {
      RUNGS.forEach(function (r) { if (r[0] === id) Object.keys(r[1]).forEach(function (k) { lv[k] = r[1][k]; }); });
      cur = id; render();
    }
    function showMemo() {
      var r = last;
      memo.style.display = "";
      memo.innerHTML = "";
      memo.appendChild(el("span", "label", "★ Northwick's AI planning playbook: the business case"));
      memo.appendChild(document.createTextNode(
        "Ask of the tool: cut weekly forecast error by " + pct(lv.impr, 1) + " on " + pct(lv.cover, 0) + " of SKUs.\n" +
        "Bench check: on 45 real SKUs the learned model cut error " + pct(pg.learnedLift, 1) + " against the best spreadsheet method, winning " + pg.learnedWins + " of 9 segments.\n" +
        "Safety stock today " + gbp(r.ssValueToday) + "; after " + gbp(r.stockAfter) + (r.biasStock > 0 ? " (incl. " + gbp(r.biasStock) + " from upward overrides)" : "") + ".\n" +
        "Cash released once: " + gbp(r.cashReleased) + ". Net value a year after a " + gbp(r.toolCost) + " licence: " + gbp(r.netAnnual) + ".\n" +
        "Break-even error cut at these settings: " + (r.breakEven == null ? "not reachable below 90%" : pct(r.breakEven, 1)) + ".\n" +
        "Service: cycle level " + pct(r.cslAfter, 1) + ", fill rate " + pct(r.fillAfter, 1) + ".\n" +
        "Decision rule: sign only if the vendor's pilot beats our best spreadsheet method by more than the break-even cut on our own holdout weeks.\n" +
        "Constructed Northwick example. Re-verify vendor pricing before you sign."));
    }
    function render() {
      Object.keys(I).forEach(function (k) { I[k].set(lv[k]); });
      cb.checked = lv.bank === "service";
      rungs.set(cur);
      var r = simulate(lv);
      last = r;
      mCash.big.textContent = gbp(r.cashReleased);
      mCash.sub.textContent = "safety stock today " + gbp(r.ssValueToday);
      mNet.big.textContent = gbp(r.netAnnual);
      mNet.sub.textContent = !lv.tool ? "no tool, no licence" : r.paybackMonths == null ? "set-up never pays back" : "set-up pays back in " + r.paybackMonths.toFixed(1) + " months";
      mNet.box.classList.toggle("on", r.netAnnual < 0);
      mBe.big.textContent = r.breakEven == null ? "none" : pct(r.breakEven, 1);
      mBe.sub.textContent = "bench measured " + pct(pg.learnedLift, 1);
      mSvc.big.textContent = pct(r.cslAfter, 1);
      mSvc.sub.textContent = "fill rate " + pct(r.fillAfter, 1) + " (today " + pct(r.fillToday, 1) + ")";
      verdict.textContent = !lv.tool
        ? "Northwick today: " + gbp(r.ssValueToday) + " of safety stock buys a " + pct(lv.csl, 0) + " cycle service level."
        : r.netAnnual < 0
          ? "At this error cut the tool costs more than it saves. The cut it needs is " + (r.breakEven == null ? "out of reach" : pct(r.breakEven, 1)) + "."
          : r.biasStock > 0
            ? "Still positive, but upward overrides park " + gbp(r.biasStock) + " back on the shelf."
            : "It pays: " + gbp(r.netAnnual) + " a year, if the error cut is real on Northwick's own weeks.";
      table.innerHTML = "";
      var hd = el("tr");
      ["Line", "A year", "How"].forEach(function (h) { hd.appendChild(el("th", null, h)); });
      table.appendChild(hd);
      [["Holding cost saved", gbp(r.holdingSaving), "cash released x holding rate"],
       ["Margin no longer lost to stockouts", gbp(r.marginSaving), "fewer units short x £6 margin"],
       ["Tool licence", gbp(-r.toolCost), "constructed; re-verify"],
       ["Net", gbp(r.netAnnual), "before the one-off £150,000 set-up"]
      ].forEach(function (rw) { var tr = el("tr"); rw.forEach(function (c) { tr.appendChild(el("td", null, c)); }); table.appendChild(tr); });
      if (memo.style.display !== "none") showMemo();
      window.ASC_CASE.last = r;
    }
    window.ASC_CASE = { setRung: setRung, result: function () { return window.ASC_CASE.last; },
      set: function (k, v) { lv[k] = v; cur = null; render(); }, rungs: RUNGS };
    setRung("today");
  }

  function boot() {
    var map = { "asc-play": mountPlay, "asc-stock": mountStock, "asc-news": mountNews, "asc-alloc": mountAlloc,
      "asc-bw": mountBw, "asc-case": mountCase };
    Object.keys(map).forEach(function (id) { var n = document.getElementById(id); if (n) map[id](n); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
