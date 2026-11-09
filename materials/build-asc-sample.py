"""Build assets/asc-sample.js for learn-ai-supply-chain-with-phoebe.

Real rows: UCI Machine Learning Repository, "Online Retail II" (Daqing Chen, 2012), CC BY 4.0,
https://doi.org/10.24432/C5CG6D, file online_retail_II.xlsx (both sheets, 1,067,371 rows:
a UK online retailer of giftware and homeware, 2009-12-01 to 2011-12-09). Convert the xlsx to
one CSV first (columns Invoice, StockCode, Description, Quantity, InvoiceDate, Price,
Customer ID, Country).

Modified (CC BY 4.0 asks us to say so):
- Product rows only: StockCode of five digits plus up to two letters (drops POST, DOT, M,
  BANK CHARGES, AMAZONFEE and similar non-product codes).
- Weekly demand per SKU = net Quantity per Monday-start week (cancellation rows, Invoice
  starting "C", carry negative quantities and are netted in), floored at zero. 104 full weeks,
  2009-12-07 to 2011-11-28. The two Christmas closure weeks are real zeros.
- Fit period = weeks 0-77, holdout = weeks 78-103 (26 weeks, 2011-06-06 to 2011-11-28).
- ABC by fit-period revenue (Quantity x Price) across ALL product SKUs: A = the SKUs making the
  first 80% of revenue, B = the next 15%, C = the rest.
- XYZ by coefficient of variation of fit-period weekly demand. The textbook cut (X <= 0.5,
  Y <= 1.0) puts almost no SKU in X here (wholesale demand is lumpy), so the cut used is this
  catalogue's own terciles of CV, computed over the eligible SKUs. Both counts are shipped.
- Eligible SKU: sold in the first 13 weeks, in the last 13 weeks, and in the holdout, with
  positive fit revenue. 5 SKUs per ABC x XYZ cell drawn with seed 20261109 (45 SKUs).
- price = fit-period revenue / fit-period units, rounded to 2 decimals (GBP).

Nothing is forecast here. Forecasts, errors and stock are computed in the browser
(assets/asc-live.js) and in materials/asc_reference.py on exactly these rows.

Usage: python3 -I build-asc-sample.py <oriii.csv> <repo>/assets/asc-sample.js
"""
import json, random, sys
import numpy as np
import pandas as pd

SEED = 20261109
PER_CELL = 5
N_WEEKS = 104
FIT = 78


def tidy(name):
    t = " ".join(str(name).split()).rstrip(".").title()
    return t.replace("'T ", "'t ").replace("'S ", "'s ")


def main(src, out):
    df = pd.read_csv(src, dtype={"StockCode": str, "Invoice": str}, parse_dates=["InvoiceDate"])
    n_rows = len(df)
    p = df[df.StockCode.str.match(r"^\d{5}[A-Za-z]{0,2}$", na=False)].copy()
    p["StockCode"] = p.StockCode.str.upper()
    p["wk"] = p.InvoiceDate.dt.normalize() - pd.to_timedelta(p.InvoiceDate.dt.dayofweek, unit="D")
    weeks = pd.date_range("2009-12-07", periods=N_WEEKS, freq="7D")
    p = p[p.wk.isin(weeks)]
    p["rev"] = p.Quantity * p.Price
    W = (p.pivot_table(index="StockCode", columns="wk", values="Quantity", aggfunc="sum")
         .reindex(columns=weeks).fillna(0).clip(lower=0).astype(int))
    fitp = p[p.wk < weeks[FIT]]
    rev = fitp.groupby("StockCode").rev.sum().reindex(W.index).fillna(0)
    units = W.iloc[:, :FIT].sum(1)
    r = rev[rev > 0].sort_values(ascending=False, kind="mergesort")
    cum = r.cumsum() / r.sum()
    abc = pd.Series(np.where(cum <= 0.8, "A", np.where(cum <= 0.95, "B", "C")), index=r.index)
    fit = W.iloc[:, :FIT].astype(float)
    cv = fit.std(axis=1, ddof=0) / fit.mean(axis=1)
    elig = ((W.iloc[:, :13].sum(1) > 0) & (W.iloc[:, N_WEEKS - 13:].sum(1) > 0)
            & (W.iloc[:, FIT:].sum(1) > 0) & (rev > 0))
    E = W.index[elig]
    t1, t2 = np.quantile(cv[E].values, [1 / 3, 2 / 3])
    xyz = pd.Series(np.where(cv <= t1, "X", np.where(cv <= t2, "Y", "Z")), index=W.index)
    textbook = pd.Series(np.where(cv <= 0.5, "X", np.where(cv <= 1.0, "Y", "Z")), index=W.index)

    # the most frequent description on positive-quantity rows (adjustment notes like "Damaged"
    # sit on negative rows), tidied: single spaces, no trailing full stop, title case.
    names = (p[p.Quantity > 0].groupby("StockCode").Description
             .agg(lambda s: s.dropna().mode().iloc[0] if s.dropna().size else ""))
    rng = random.Random(SEED)
    skus = []
    cells = {}
    for a in "ABC":
        for x in "XYZ":
            pool = sorted(c for c in E if abc.get(c) == a and xyz[c] == x)
            cells[a + x] = len(pool)
            for code in sorted(rng.sample(pool, PER_CELL)):
                skus.append({
                    "code": code,
                    "name": tidy(names.get(code, "")),
                    "abc": a, "xyz": x,
                    "cv": round(float(cv[code]), 2),
                    "price": round(float(rev[code] / units[code]), 2),
                    "demand": [int(v) for v in W.loc[code].tolist()],
                })
    data = {
        "source": "UCI Machine Learning Repository, Online Retail II (Daqing Chen, 2012), "
                  "file online_retail_II.xlsx, %d rows, 2009-12-01 to 2011-12-09" % n_rows,
        "licence": "CC BY 4.0, https://creativecommons.org/licenses/by/4.0/",
        "doi": "https://doi.org/10.24432/C5CG6D",
        "modified": "weekly net units per SKU, floored at 0; ABC by fit revenue; XYZ by catalogue "
                    "CV terciles; 5 SKUs per cell, seed %d" % SEED,
        "weeks": [w.strftime("%Y-%m-%d") for w in weeks],
        "fit": FIT,
        "catalogue": {
            "productSkus": int(len(W)), "eligible": int(len(E)),
            "cvCuts": [round(float(t1), 2), round(float(t2), 2)],
            "cells": cells,
            "textbookX": int(sum(1 for c in E if textbook[c] == "X")),
            "textbookZ": int(sum(1 for c in E if textbook[c] == "Z")),
            "cvMedian": round(float(np.median(cv[E].values)), 2),
        },
        "skus": skus,
    }
    js = ("/* Derived from UCI Online Retail II (Daqing Chen, CC BY 4.0, doi 10.24432/C5CG6D). "
          "Modified: weekly net units per SKU, 45 SKUs sampled across ABC x XYZ with seed %d. "
          "Generated by materials/build-asc-sample.py - do not edit by hand. */\n" % SEED)
    js += "var ASC_SAMPLE = " + json.dumps(data, separators=(",", ":")) + ";\n"
    js += 'if (typeof module !== "undefined" && module.exports) module.exports = ASC_SAMPLE;\n'
    open(out, "w", encoding="ascii").write(js)
    print("wrote", out, len(js), "bytes;", len(skus), "skus; cuts", t1, t2, "cells", cells,
          "textbook X", data["catalogue"]["textbookX"])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
