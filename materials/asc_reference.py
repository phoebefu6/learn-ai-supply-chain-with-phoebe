"""Python reference for assets/asc-live.js - recomputes every bench number in the same order.

Usage: python3 materials/asc_reference.py > python.json
Then:  node materials/run-ladder.js > node.json
       python3 materials/compare-ladder.py node.json python.json

Pure Python on purpose (no numpy): the same float operations in the same order as the JS, so
the two agree to 1e-9. Every Northwick constant is CONSTRUCTED and labelled so on the widgets.
"""
import json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
METHODS = ["naive", "ma8", "snaive", "ses", "learned"]
BASELINES = ["naive", "ma8", "snaive", "ses"]
T0 = 52
LAMBDA = 1.0
WIN = 13
CAP = 3.0
CELLS = [a + x for a in "ABC" for x in "XYZ"]


def load():
    s = open(os.path.join(HERE, "..", "assets", "asc-sample.js"), encoding="ascii").read()
    return json.loads(re.search(r"var ASC_SAMPLE = (\{.*\});\n", s).group(1))


# ------------------------------------------------ normal distribution helpers
def norm_pdf(z):
    return math.exp(-0.5 * z * z) / math.sqrt(2 * math.pi)


def norm_cdf(z):
    # Abramowitz and Stegun 26.2.17 (abs error < 7.5e-8)
    t = 1.0 / (1.0 + 0.2316419 * abs(z))
    poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
    p = 1.0 - norm_pdf(abs(z)) * poly
    return p if z >= 0 else 1.0 - p


def inv_norm(p):
    # Acklam's rational approximation (relative error < 1.15e-9)
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
         1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
         6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
         -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
    lo = 0.02425
    if p < lo:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / \
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    if p > 1 - lo:
        q = math.sqrt(-2 * math.log(1 - p))
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / \
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / \
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)


def loss_g(z):
    return norm_pdf(z) - z * (1.0 - norm_cdf(z))


# ------------------------------------------------ forecasting
def level(y, t):
    """Recent level: mean of the 13 weeks before week t (the learned model's unit of scale)."""
    s = 0.0
    for k in range(1, WIN + 1):
        s += y[t - k]
    return s / WIN


def features(y, t, r):
    s8 = 0.0
    for k in range(1, 9):
        s8 += y[t - k]
    w = 2 * math.pi * t / 52
    return [1.0, y[t - 1] / r, y[t - 2] / r, y[t - 3] / r, y[t - 4] / r, (s8 / 8) / r,
            math.sin(w), math.cos(w), math.sin(2 * w), math.cos(2 * w)]


def solve(A, b):
    n = len(b)
    M = [A[i][:] + [b[i]] for i in range(n)]
    for col in range(n):
        piv = col
        for r in range(col + 1, n):
            if abs(M[r][col]) > abs(M[piv][col]):
                piv = r
        M[col], M[piv] = M[piv], M[col]
        for r in range(col + 1, n):
            f = M[r][col] / M[col][col]
            for c in range(col, n + 1):
                M[r][c] -= f * M[col][c]
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        s = M[i][n]
        for c in range(i + 1, n):
            s -= M[i][c] * x[c]
        x[i] = s / M[i][i]
    return x


def fit_learned(S):
    """Pooled ridge across every SKU: each week is expressed as a multiple of that SKU's recent
    level, spikes above CAP x the level are clipped when training (outlier treatment)."""
    fit = S["fit"]
    nf = 10
    A = [[0.0] * nf for _ in range(nf)]
    b = [0.0] * nf
    for sku in S["skus"]:
        y = sku["demand"]
        for t in range(WIN, fit):
            r = level(y, t)
            if r <= 0:
                continue
            x = features(y, t, r)
            tgt = min(y[t] / r, CAP)
            for i in range(nf):
                b[i] += x[i] * tgt
                for j in range(nf):
                    A[i][j] += x[i] * x[j]
    for i in range(1, nf):
        A[i][i] += LAMBDA
    return solve(A, b)


def ses_alpha(y, fit):
    best_k, best = 1, None
    for k in range(1, 10):
        a = k / 10
        lev = float(y[0])
        sse = 0.0
        for t in range(1, fit):
            e = y[t] - lev
            sse += e * e
            lev = a * y[t] + (1 - a) * lev
        if best is None or sse < best:
            best, best_k = sse, k
    return best_k / 10


def forecast_all(S):
    """F[i][method] = list of N one-step-ahead forecasts (None before week T0)."""
    n = len(S["weeks"])
    fit = S["fit"]
    beta = fit_learned(S)
    out = []
    for sku in S["skus"]:
        y = sku["demand"]
        a = ses_alpha(y, fit)
        lev = float(y[0])
        sesf = [None] * n
        for t in range(1, n):
            sesf[t] = lev
            lev = a * y[t] + (1 - a) * lev
        F = {k: [None] * n for k in METHODS}
        for t in range(T0, n):
            F["naive"][t] = float(y[t - 1])
            s8 = 0.0
            for k in range(1, 9):
                s8 += y[t - k]
            F["ma8"][t] = s8 / 8
            F["snaive"][t] = float(y[t - 52])
            F["ses"][t] = sesf[t]
            r = level(y, t)
            if r <= 0:
                F["learned"][t] = 0.0
            else:
                x = features(y, t, r)
                v = 0.0
                for i in range(10):
                    v += x[i] * beta[i]
                F["learned"][t] = max(0.0, v * r)
        out.append({"F": F, "alpha": a})
    return out, beta


def sums(S, FA, method, t_from, t_to, adj):
    rows = []
    for i, sku in enumerate(S["skus"]):
        y = sku["demand"]
        f = FA[i]["F"][method]
        ab = er = ac = 0.0
        for t in range(t_from, t_to):
            ft = f[t] * (1 + adj)
            ab += abs(ft - y[t])
            er += ft - y[t]
            ac += y[t]
        rows.append([ab, er, ac])
    return rows


def agg(S, rows, keyf):
    g = {}
    for i, sku in enumerate(S["skus"]):
        k = keyf(sku)
        if k not in g:
            g[k] = [0.0, 0.0, 0.0]
        for j in range(3):
            g[k][j] += rows[i][j]
    return {k: {"wape": v[0] / v[2], "bias": v[1] / v[2]} for k, v in sorted(g.items())}


def score(S, FA, method, adj=0.0):
    n = len(S["weeks"])
    rows = sums(S, FA, method, S["fit"], n, adj)
    return {
        "overall": agg(S, rows, lambda s: "all")["all"],
        "cells": agg(S, rows, lambda s: s["abc"] + s["xyz"]),
        "abc": agg(S, rows, lambda s: s["abc"]),
        "xyz": agg(S, rows, lambda s: s["xyz"]),
        "sku": [r[0] / r[2] for r in rows],
    }


def playground(S, FA=None):
    if FA is None:
        FA, _ = forecast_all(S)
    sc = {m: score(S, FA, m) for m in METHODS}
    best = {}
    for c in CELLS:
        bm = None
        for m in BASELINES:
            if bm is None or sc[m]["cells"][c]["wape"] < sc[bm]["cells"][c]["wape"]:
                bm = m
        bw = sc[bm]["cells"][c]["wape"]
        lw = sc["learned"]["cells"][c]["wape"]
        best[c] = {"baseline": bm, "wape": bw, "learned": lw, "lift": (bw - lw) / bw}
    ob = None
    for m in BASELINES:
        if ob is None or sc[m]["overall"]["wape"] < sc[ob]["overall"]["wape"]:
            ob = m
    obw = sc[ob]["overall"]["wape"]
    lw = sc["learned"]["overall"]["wape"]
    vs_naive = (sc["naive"]["overall"]["wape"] - lw) / sc["naive"]["overall"]["wape"]
    return {
        "methods": {m: {"overall": sc[m]["overall"], "cells": sc[m]["cells"], "abc": sc[m]["abc"],
                        "xyz": sc[m]["xyz"]} for m in METHODS},
        "bestByCell": best,
        "bestBaseline": {"method": ob, "wape": obw},
        "learnedLift": (obw - lw) / obw,
        "learnedVsNaive": vs_naive,
        "learnedWins": sum(1 for c in CELLS if best[c]["lift"] > 0),
        "override15": score(S, FA, "learned", 0.15)["overall"],
        "alphas": [r["alpha"] for r in FA],
    }


# ------------------------------------------------ stock policy (session 2)
STOCK_RUNGS = [
    ["flat", {"method": "ma8", "csl": {"A": 0.95, "B": 0.95, "C": 0.95}, "L": 2}],
    ["tiered", {"method": "ma8", "csl": {"A": 0.98, "B": 0.95, "C": 0.90}, "L": 2}],
    ["learned", {"method": "learned", "csl": {"A": 0.98, "B": 0.95, "C": 0.90}, "L": 2}],
    ["naive", {"method": "naive", "csl": {"A": 0.98, "B": 0.95, "C": 0.90}, "L": 2}],
    ["longlead", {"method": "ma8", "csl": {"A": 0.98, "B": 0.95, "C": 0.90}, "L": 6}],
]


def stock(S, FA, o):
    fit, n = S["fit"], len(S["weeks"])
    tot = 0.0
    cls = {}
    for i, sku in enumerate(S["skus"]):
        y = sku["demand"]
        f = FA[i]["F"][o["method"]]
        se = 0.0
        for t in range(T0, fit):
            e = y[t] - f[t]
            se += e * e
        sigma = math.sqrt(se / (fit - T0))
        z = inv_norm(o["csl"][sku["abc"]])
        ss = z * sigma * math.sqrt(o["L"])
        val = ss * sku["price"]
        hits = 0
        for t in range(fit, n):
            if y[t] <= f[t] + z * sigma:
                hits += 1
        tot += val
        c = cls.setdefault(sku["abc"], {"value": 0.0, "hits": 0, "weeks": 0, "target": o["csl"][sku["abc"]]})
        c["value"] += val
        c["hits"] += hits
        c["weeks"] += n - fit
    for c in cls.values():
        c["achieved"] = c["hits"] / c["weeks"]
    hits = sum(c["hits"] for c in cls.values())
    weeks = sum(c["weeks"] for c in cls.values())
    return {"value": tot, "achieved": hits / weeks,
            "classes": {k: {"value": v["value"], "achieved": v["achieved"], "target": v["target"]}
                        for k, v in sorted(cls.items())}}


# ------------------------------------------------ allocation (session 3, CONSTRUCTED)
ALLOC = {"channels": [["North stores", 700, 7.5], ["South stores", 500, 6.8], ["Online", 400, 9.0]]}
ALLOC_RUNGS = [["fair", 1200], ["stores", 1200], ["margin", 1200], ["floor", 1200], ["fair", 800]]


def allocate(rule, supply, floor=0.5):
    ch = ALLOC["channels"]
    give = [0.0] * len(ch)
    total = sum(c[1] for c in ch)
    if rule == "fair":
        for i, c in enumerate(ch):
            give[i] = min(c[1], supply * c[1] / total)
    else:
        left = float(supply)
        if rule == "floor":
            for i, c in enumerate(ch):
                g = min(c[1] * floor, left)
                give[i] = g
                left -= g
        order = [0, 1, 2] if rule == "stores" else sorted(range(len(ch)), key=lambda k: (-ch[k][2], k))
        for i in order:
            g = min(ch[i][1] - give[i], left)
            give[i] += g
            left -= g
    rows = [{"name": c[0], "units": give[i], "fill": give[i] / c[1], "margin": give[i] * c[2]}
            for i, c in enumerate(ch)]
    return {"rows": rows, "margin": sum(r["margin"] for r in rows),
            "lowestFill": min(r["fill"] for r in rows)}


# ------------------------------------------------ bullwhip (session 4)
BW_RUNGS = [
    ["base", {"p": 8, "L": 2, "share": False, "batch": 1}],
    ["jumpy", {"p": 4, "L": 2, "share": False, "batch": 1}],
    ["slowship", {"p": 8, "L": 4, "share": False, "batch": 1}],
    ["batch", {"p": 8, "L": 2, "share": False, "batch": 4}],
    ["share", {"p": 8, "L": 2, "share": True, "batch": 1}],
    ["cure", {"p": 13, "L": 2, "share": True, "batch": 1}],
]
BW_Z = 1.65
BW_EV0 = 13


def demand_series(S, code="all"):
    n = len(S["weeks"])
    if code != "all":
        for s in S["skus"]:
            if s["code"] == code:
                return [float(v) for v in s["demand"]]
    out = [0.0] * n
    for s in S["skus"]:
        for t in range(n):
            out[t] += s["demand"][t]
    return out


def pvar(x, a, b):
    m = 0.0
    for t in range(a, b):
        m += x[t]
    m /= (b - a)
    v = 0.0
    for t in range(a, b):
        v += (x[t] - m) * (x[t] - m)
    return v / (b - a)


def bullwhip(S, o, code="all"):
    D = demand_series(S, code)
    n = len(D)
    p, L = o["p"], o["L"]
    X = D
    ratios = []
    orders = []
    vd = pvar(D, BW_EV0, n)
    for k in range(3):
        B = D if o["share"] else X
        q = [0.0] * n
        prevS = None
        acc = 0.0
        for t in range(n):
            if t + 1 >= p:
                mu = 0.0
                for j in range(t - p + 1, t + 1):
                    mu += B[j]
                mu /= p
                v = 0.0
                for j in range(t - p + 1, t + 1):
                    v += (B[j] - mu) * (B[j] - mu)
                sd = math.sqrt(v / p)
                St = (L + 1) * mu + BW_Z * sd * math.sqrt(L + 1)
                raw = X[t] if prevS is None else max(0.0, X[t] + St - prevS)
                prevS = St
            else:
                raw = X[t]
            if k == 0 and o["batch"] > 1:
                acc += raw
                if (t + 1) % o["batch"] == 0:
                    q[t] = acc
                    acc = 0.0
            else:
                q[t] = raw
        ratios.append(pvar(q, BW_EV0, n) / vd)
        orders.append(q)
        X = q
    return {"ratios": ratios, "orders": orders, "demand": D}


# ------------------------------------------------ business case (session 6, CONSTRUCTED)
NW = {"skus": 4000, "mu": 80.0, "unitCost": 6.0, "unitMargin": 6.0, "errRatio": 0.55, "orderWeeks": 2.0}
BASE_LV = {"tool": True, "impr": 0.0, "cover": 1.0, "L": 4, "csl": 0.95, "rate": 0.25, "toolCost": 250000.0,
           "setup": 150000.0, "bank": "cash", "upBias": 0.0}


def case_rungs(pg, S):
    cat = S["catalogue"]["cells"]
    tot = float(sum(cat[c] for c in CELLS))
    win = [c for c in CELLS if pg["bestByCell"][c]["lift"] > 0]
    share = 0.0
    wl = 0.0
    for c in win:
        share += cat[c] / tot
        wl += pg["bestByCell"][c]["lift"] * cat[c] / tot
    seg = wl / share if share > 0 else 0.0

    def lv(**kw):
        d = dict(BASE_LV)
        d.update(kw)
        return d
    return [
        ["today", lv(tool=False)],
        ["vendor", lv(impr=0.30)],
        ["bench", lv(impr=pg["learnedLift"])],
        ["earns", lv(impr=seg, cover=share)],
        ["service", lv(impr=seg, cover=share, bank="service")],
        ["override", lv(impr=0.30, upBias=0.10)],
    ]


def break_even(lv):
    """Smallest error cut (0 to 0.9) at which net annual value reaches zero, by bisection."""
    def net(x):
        d = dict(lv)
        d["impr"] = x
        d["tool"] = True
        return core(d)["netAnnual"]
    if net(0.9) < 0:
        return None
    lo, hi = 0.0, 0.9
    for _ in range(50):
        mid = (lo + hi) / 2
        if net(mid) < 0:
            lo = mid
        else:
            hi = mid
    return hi


def simulate(lv):
    out = core(lv)
    out["breakEven"] = break_even(lv)
    return out


def core(lv):
    mu = NW["mu"]
    sig0 = NW["errRatio"] * mu
    rL = math.sqrt(lv["L"])
    z0 = inv_norm(lv["csl"])
    sigL0 = sig0 * rL
    sigL1 = sig0 * (1 - lv["impr"]) * rL
    cyc = 52.0 / NW["orderWeeks"]
    Q = NW["orderWeeks"] * mu
    ss0 = z0 * sigL0
    esc0 = sigL0 * loss_g(z0)
    if lv["bank"] == "cash":
        z1 = z0
        ss1 = z0 * sigL1
    else:
        z1 = ss0 / sigL1
        ss1 = ss0
    esc1 = sigL1 * loss_g(z1)
    cov = lv["cover"]
    n = NW["skus"]
    ssv0 = ss0 * NW["unitCost"] * n
    ssv1 = (cov * ss1 + (1 - cov) * ss0) * NW["unitCost"] * n
    biasv = lv["upBias"] * mu * (lv["L"] + 1) * NW["unitCost"] * n * cov
    stock1 = ssv1 + biasv
    lost0 = esc0 * cyc * NW["unitMargin"] * n
    lost1 = (cov * esc1 + (1 - cov) * esc0) * cyc * NW["unitMargin"] * n
    cash = ssv0 - stock1
    hold = cash * lv["rate"]
    marg = lost0 - lost1
    tool = lv["toolCost"] if lv["tool"] else 0.0
    net = hold + marg - tool
    pay = lv["setup"] / (net / 12) if net > 0 and tool > 0 else None
    csl1 = cov * norm_cdf(z1) + (1 - cov) * norm_cdf(z0)
    fill0 = 1 - esc0 / Q
    fill1 = 1 - (cov * esc1 + (1 - cov) * esc0) / Q
    return {"ssValueToday": ssv0, "stockAfter": stock1, "cashReleased": cash, "holdingSaving": hold,
            "marginSaving": marg, "toolCost": tool, "netAnnual": net, "paybackMonths": pay,
            "cslAfter": csl1, "fillToday": fill0, "fillAfter": fill1, "biasStock": biasv}


def main():
    S = load()
    FA, beta = forecast_all(S)
    pg = playground(S, FA)
    pg["beta"] = beta
    out = {
        "playground": pg,
        "stock": {r[0]: stock(S, FA, r[1]) for r in STOCK_RUNGS},
        "allocation": {r[0] + "-" + str(r[1]): allocate(r[0], r[1]) for r in ALLOC_RUNGS},
        "bullwhip": {r[0]: bullwhip(S, r[1])["ratios"] for r in BW_RUNGS},
        "simulator": {r[0]: simulate(r[1]) for r in case_rungs(pg, S)},
        "newsvendor": {"cu6co2": 6.0 / (6.0 + 2.0), "z95": inv_norm(0.95), "z98": inv_norm(0.98)},
    }
    json.dump(out, sys.stdout, indent=1)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
