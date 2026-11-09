# Source map - learn-ai-supply-chain-with-phoebe

Internal build document. Every number a page quotes must appear here with its tier, or be printed by
a bench. Compiled 2026-11-09. Hyphens only.

**Tiers.** [S] read at source on 2026-11-09 (the sentence or number was on the page or in the PDF).
[R] reported: seen only in an abstract record, a secondary source or a search snippet, so it is taught
as "reported". [C] constructed for the Northwick example, labelled "Constructed Northwick example" on
every page. [M] computed by a bench in the browser (`assets/asc-live.js`) and by
`materials/asc_reference.py` (they agree on 482 values; `compare-ladder.py` also catches a planted
0.1% fault).

**Fast-moving:** vendor and consultancy claims about AI forecasting, and every tool price. Re-verify
before delivery.

## The question across all six sessions

The vendor says the forecast is 30% better. How much stock, service and cash does that actually move,
and where does a spreadsheet still win?

## Running case [C]

**Northwick**, a constructed mid-size homeware retailer: about 4,000 SKUs, 2 distribution centres
(DC North, DC South), about 60 stores and an online shop. Running artifact: **Northwick's AI planning
playbook**, one page that grows each session:

| Session | Section added to the playbook |
|---|---|
| 1 | The forecast-error budget (error per segment, which method owns which cell) |
| 2 | The stock policy (service target per class, safety stock rule) |
| 3 | The allocation rules (short-supply week) |
| 4 | The disruption playbook (bullwhip causes and the information we share) |
| 5 | The override rules (when a planner may change the number, and how it is logged) |
| 6 | The business case, then the memo |

Grep 2026-11-09: "Northwick" has 0 hits across sibling course pages. Never Phoebe's employers,
clients or projects. Northwick's bench constants (4,000 SKUs, 80 units a week per SKU, GBP 6 cost and
GBP 6 margin a unit, weekly error 55% of demand, orders every 2 weeks, GBP 250,000 a year and GBP
150,000 set-up for the tool, 25% holding rate, 4-week lead time, 95% cycle service) are all [C].
Allocation case [C]: 1,200 units for 1,600 wanted; North stores 700 at GBP 7.50 margin, South stores
500 at GBP 6.80, online 400 at GBP 9.00.

## Seams (side picked out loud, linked with absolute https, never retaught)

| Sibling | They own | This course owns |
|---|---|---|
| learn-timeseries-forecasting a3, a5, b2, b6, b8 | forecasting METHODS, baselines, ML forecasting, error metrics and backtesting | the DECISION after the forecast: error as an input to stock, allocation and reroute. s1 links a5 and b8 for metric definitions, b6 for ML forecasting |
| learn-economics p1-p3, p10 | price elasticity theory and estimation | none: promotions appear only as a demand-spike driver, linked to p1 |
| learn-when-ai | the general routing skill (dashboard vs ML vs GenAI) | the supply chain instance of that call; s1 links 03-when-classic-ml-wins |
| learn-ai-finance | finance workflows with AI | working capital appears only as the s6 business-case output; s6 links a5-roi-business-case |
| learn-physical-ai-robotics (planned) | warehouse robots, sensors, simulation | none; no robots, no warehouse automation |

Sibling URLs (absolute):
- https://phoebefu6.github.io/learn-timeseries-forecasting-with-phoebe/courses/a3-methods-no-math.html
- https://phoebefu6.github.io/learn-timeseries-forecasting-with-phoebe/courses/a5-measuring-forecasts.html
- https://phoebefu6.github.io/learn-timeseries-forecasting-with-phoebe/courses/b2-decomposition-baselines.html
- https://phoebefu6.github.io/learn-timeseries-forecasting-with-phoebe/courses/b6-ml-forecasting.html
- https://phoebefu6.github.io/learn-timeseries-forecasting-with-phoebe/courses/b8-backtesting-metrics.html
- https://phoebefu6.github.io/learn-economics-with-phoebe/courses/p1-demand-from-data.html
- https://phoebefu6.github.io/learn-when-ai-with-phoebe/courses/03-when-classic-ml-wins.html
- https://phoebefu6.github.io/learn-ai-finance-with-phoebe/courses/a5-roi-business-case.html

## Verified facts

### Data: UCI Online Retail II [S]
- Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository.
  https://doi.org/10.24432/C5CG6D. Licence CC BY 4.0 [S]. File `online_retail_II.xlsx` inside
  https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip [S].
- 1,067,371 rows, 2009-12-01 to 2011-12-09 [S, and counted by our build: 525,461 + 541,910 across
  the two sheets]. A UK-based online retailer; "Many customers of the company are wholesalers" [S].
  Invoice codes starting "c" are cancellations [S]. Prices in sterling [S].
- The dataset card names the columns InvoiceNo, UnitPrice, CustomerID; the shipped file's header
  says Invoice, Price, Customer ID (checked by our build).
- Our modification (stated on the widget and in `materials/build-asc-sample.py`): product codes
  only, weekly net units per SKU floored at zero, 104 full weeks 2009-12-07 to 2011-11-28, fit weeks
  0-77, holdout weeks 78-103 (2011-06-06 to 2011-11-28), ABC by fit revenue (80/15/5), XYZ by this
  catalogue's CV terciles, 5 SKUs per cell drawn with seed 20261109 (45 SKUs).

### Bullwhip: Lee, Padmanabhan, Whang 1997
- Management Science 43(4), 546-558, https://doi.org/10.1287/mnsc.43.4.546 [S, full PDF read]. The
  abstract names "four sources of the bullwhip effect: demand signal processing, rationing game,
  order batching, and price variations" [S]. Counteracting actions include "information sharing of
  sell-through and inventory status data, coordination of orders across retailers" [S]. Procter &
  Gamble "found that the diaper orders issued by the distributors have a degree of variability" [S].
  The word "Pampers" does not appear in the MS paper; do not attribute it there.
- Sloan Management Review 38(3), 93-102, Spring 1997, "The Bullwhip Effect in Supply Chains" [R]:
  the SMR page could not be read. The "information sharing, channel alignment, operational
  efficiency" labels and the Pampers framing are associated with the SMR article in secondary
  sources only; teach them as reported, or do not use them.

### Judgmental adjustment: Fildes, Goodwin, Lawrence, Nikolopoulos 2009
- International Journal of Forecasting 25(1), 3-23, https://doi.org/10.1016/j.ijforecast.2008.11.010
  [S for the citation via Crossref]. Findings [R, from the Lancaster eprints abstract and university
  record pages, not the body text]: more than 60,000 forecasts and outcomes from four supply-chain
  companies; adjustments improved accuracy on average in 3 of the 4 companies; larger adjustments
  tended to improve accuracy and smaller ones often reduced it; upward (positive) adjustments were
  much less likely to improve accuracy than downward ones, which the authors attribute to optimism
  bias. Exact per-company percentages: not found, never quoted.

### Forecast value added: Gilliland [R]
- Definition as quoted in Petropoulos et al., "Forecasting: theory and practice", IJF 2022 (arXiv
  2012.03854, PDF read): FVA "is defined as the change in a forecasting performance metric that can
  be attributed to a particular step or participant" (attributed there to Gilliland 2002); start
  from a naive forecast and ask whether each later step improves it; steps that do not are "process
  waste" [S for the Petropoulos text, R for Gilliland's own wording]. Gilliland's book: The Business
  Forecasting Deal (Wiley, 2010) [R].

### M5 accuracy competition
- Makridakis, Spiliotis, Assimakopoulos 2022, "M5 accuracy competition: Results, findings, and
  conclusions", IJF 38(4), 1346-1364, https://doi.org/10.1016/j.ijforecast.2021.11.013 [S for the
  citation]. From the 2020 preprint [S preprint, R for the published version]: 42,840 series, 30,490
  of them product-store; Walmart daily unit sales 2011-01-29 to 2016-06-19; metric WRMSSE; top methods
  "focused on LightGBM implementations and variants"; improvements over the best benchmark "higher
  than 20% for the top five" and "22.4% for the winning team" (benchmark: exponential smoothing,
  bottom-up); 5,507 teams; 415 (7.5%) beat the top-performing benchmark. Teach as "the competition
  paper reports"; the 22.4% is checked against the preprint only.

### Inventory text: Silver, Pyke, Thomas [R]
- Inventory and Production Management in Supply Chains, 4th ed., CRC Press, 2017 (ISBN
  9781466558618) [S for the edition, publisher page read]. The formulas used here (safety stock =
  k x sigma_L; cycle service level P1 vs fill rate P2; expected units short = sigma_L x G(k)) are the
  standard textbook forms; page numbers not cited. The bench implements them; they are taught as the
  standard formulas, not as a quotation.

### Newsvendor
- Critical fractile: order up to the quantile Cu / (Cu + Co) of demand. MIT OCW 15.772J
  "Newsvendor Inventory Problem" PDF compares against a "critical fractile 0.375" in a worked example
  [S]. The general formula is taught as standard [R for a verbatim textbook print].

### Algorithm aversion and appreciation (taught as a disagreement)
- Dietvorst, Simmons, Massey 2015, JEP: General 144(1), 114-126, https://doi.org/10.1037/xge0000033
  [S, Wharton PDF]: after seeing an algorithm err, people were "less likely to choose it over an
  inferior human forecaster", "even among those who saw the algorithm outperform the human"; people
  "more quickly lose confidence in algorithmic than human forecasters". Five studies.
- Dietvorst, Simmons, Massey 2018, Management Science 64(3), 1155-1170,
  https://doi.org/10.1287/mnsc.2016.2643 [S abstract]: people were "more likely to choose to use an
  imperfect algorithm when they could modify" its forecasts, "even when participants were severely
  restricted" in how much.
- Logg, Minson, Moore 2019, "Algorithm appreciation", OBHDP 151, 90-103,
  https://doi.org/10.1016/j.obhdp.2018.12.005 [R abstract copies]: across six experiments lay people
  relied more on advice labelled algorithmic than human; the effect weakened for experts in
  forecasting and when choosing between an algorithm and their own estimate.

### Automation bias
- Parasuraman and Manzey 2010, Human Factors 52(3), 381-410, https://doi.org/10.1177/0018720810376055
  [S abstract]: automation bias produces "both omission and commission errors when decision aids are
  imperfect"; it "occurs in both naive and expert participants, cannot be prevented by training or
  instructions".

### Vendor and consultancy claims (taught as claims with their basis, never resolved)
- McKinsey pages are reported (search snippets only; mckinsey.com would not load) to say AI-driven
  forecasting can cut forecast errors by "20 and 50%" (and "30 to 50 percent" on another page). No
  study, sample or measurement basis was visible [R, primary UNVERIFIED]. Taught as: a range a vendor
  deck will quote, with no published method behind it that we could read. The "30% better" in
  Northwick's pitch is constructed [C] and sits inside that quoted range on purpose.

## Bench canon [M] (python = node, 482 values; reported to the precision pages print)

### Forecast playground (s1, reused s2 and s5): 45 real SKUs, holdout 26 weeks, one week ahead
| Method | WAPE | Bias |
|---|---|---|
| Naive (last week) | 90.9% | -2.0% |
| 8-week average | 79.6% | -4.4% |
| Same week last year | 130.7% | +38.3% |
| Exponential smoothing | 80.2% | -0.8% |
| Learned model (pooled ridge) | 77.5% | -17.3% |

- Best spreadsheet method overall: 8-week average, 79.6%. Learned model is 2.7% better (2.68%) than
  it, 14.8% better than naive. It wins 6 of 9 cells.
- Per cell, best baseline vs learned (lift): AX ses 53.9 vs 55.0 (-2.1%); AY ses 95.5 vs 92.9 (+2.8%);
  AZ ma8 98.6 vs 95.0 (+3.6%); BX ses 77.8 vs 78.8 (-1.4%); BY same-week-last-year 109.1 vs 104.1
  (+4.5%); BZ ma8 117.4 vs 105.7 (+10.0%); CX ses 67.6 vs 67.5 (+0.2%); CY same-week-last-year 106.5
  vs 116.0 (-8.9%); CZ ma8 113.6 vs 110.9 (+2.3%).
- By XYZ (learned / 8-week avg / ses): X 58.6 / 58.3 / 57.6; Y 98.2 / 103.1 / 104.5; Z 98.6 / 103.1
  / 106.7. The learned model wins the jumpy columns and loses the steady one.
- Override +15% on the learned model: WAPE 79.8%, bias -4.9% (accuracy worse, bias smaller).
- Catalogue: 5,059 product codes, 1,952 sold start to end; textbook X cut (CV at or under 0.5) finds
  2 of 1,952; median CV 2.05; tercile cuts 1.59 and 2.55. Eligible SKUs per cell: AX 404, AY 132,
  AZ 49, BX 187, BY 215, BZ 136, CX 60, CY 303, CZ 466.

### Stock policy (s2): 45 SKUs, holdout checked one week ahead (1,170 SKU-weeks)
| Rung | Safety stock value | Achieved overall | A | B | C |
|---|---|---|---|---|---|
| 95% flat, 8-week avg, L 2 | GBP 11,854 | 93.3% | 96.4 | 94.6 | 89.0 |
| Tiered 98/95/90, 8-week avg | GBP 14,184 | 93.1% | 97.4 | 94.6 | 87.2 |
| Same tiers, learned model | GBP 13,668 | 92.1% | 95.9 | 94.1 | 86.2 |
| Same tiers, naive | GBP 17,852 | 93.8% | 97.7 | 95.6 | 87.9 |
| Tiered, lead time 6 weeks | GBP 24,567 | 93.1% | 97.4 | 94.6 | 87.2 |
- z at 95% = 1.645, at 98% = 2.054. Newsvendor Cu 6, Co 2: critical ratio 75%.

### Allocation (s3) [C inputs, M arithmetic], 1,200 units
| Rule | North / South / Online | Margin | Lowest fill |
|---|---|---|---|
| Fair share | 525 / 375 / 300 (75% each) | GBP 9,188 (9,187.50) | 75% |
| Stores first | 700 / 500 / 0 | GBP 8,650 | 0% |
| Highest margin first | 700 / 100 / 400 | GBP 9,530 | 20% |
| Floor 50%, then margin | 550 / 250 / 400 | GBP 9,425 | 50% |
| Fair share at 800 units | 350 / 250 / 200 | GBP 6,125 | 50% |

### Bullwhip (s4): all 45 SKUs summed, ratios = variance of orders / variance of demand, weeks 13-103
| Rung | Stores | DC | Supplier |
|---|---|---|---|
| Base (8-week view, L 2) | 4.0x | 18.2x | 87.6x |
| React to 4 weeks | 6.6x | 50.4x | 411.7x |
| Lead time 4 weeks | 6.0x | 40.1x | 289.6x |
| Stores order every 4 weeks | 9.2x | 23.5x | 90.0x |
| Share sell-through | 4.0x | 9.2x | 16.5x |
| Share + 13-week view | 2.8x | 5.6x | 9.3x |

### Business case (s6) [C inputs, M arithmetic]
| Rung | Cash released | Net a year | Payback | Break-even cut | CSL / fill |
|---|---|---|---|---|---|
| Today, no tool | - | - | - | 12.4% | 95.0 / 98.9 |
| Vendor claim, error -30% | GBP 1,042,179 | GBP 354,727 | 5.1 months | 12.4% | 95.0 / 99.2 |
| The bench: measured 2.7% | GBP 93,044 | -GBP 196,011 | never | 12.4% | 95.0 / 98.9 |
| Only where it wins (6 cells = 54% of SKUs, 3.7% cut there; slider shows 3.7% and 54%) | GBP 70,520 | -GBP 209,081 | never | 22.9% | 95.0 / 98.9 |
| Bank it as service | GBP 0 | -GBP 140,879 | never | 9.3% | 95.3 / 99.0 |
| Claim + upward overrides 10% | GBP 82,179 (GBP 960,000 parked by bias) | GBP 114,727 | 15.7 months | 24.3% | 95.0 / 99.2 |
- Safety stock today GBP 3,473,931. Note: "only where it wins" covers the catalogue share of the six
  winning cells; the widget prints the coverage slider value, so pages quote the slider, not a
  derived share.

## Per-session coverage

### 1. Every forecast is wrong: budget the error (green)
Error as a planning input; bias vs spread; WAPE in one line (link ts a5/b8 for definitions); ABC/XYZ;
where a learned model earns its place and where a spreadsheet wins; M5 as the strongest public
evidence (and why 22.4% on Walmart is not your number). Playground. Artifact: forecast-error budget.

### 2. From forecast to stock: safety stock and service level (yellow)
z x sigma x sqrt(L); cycle service level vs fill rate; newsvendor critical ratio; tiering service by
ABC; past error understates next error (the holdout check). Stock widget + newsvendor widget.
Artifact: stock policy.

### 3. Allocate scarce stock: rules before optimisers (yellow)
Fair share, priority, margin, floor-then-margin; rationing game link to s4; what an optimiser must be
told (objective, constraints, tie-breaks); allocation widget. Scorecard 1 (forgiving). Artifact:
allocation rules.

### 4. Shocks and the bullwhip (orange)
Lee, Padmanabhan, Whang (MS 1997): four causes, information sharing; P&G diaper orders; the bullwhip
lever; control-tower and disruption-sensing claims taught as contested (vendor claims, no public
evaluation read). Artifact: disruption playbook.

### 5. When the planner is right: overrides and trust (orange)
FVA (Gilliland, as quoted by Petropoulos et al.); Fildes et al. 2009 (reported abstract findings);
algorithm aversion vs appreciation (Dietvorst 2015/2018 vs Logg 2019) as a disagreement; automation
bias (Parasuraman and Manzey 2010). Playground override slider reused. Artifact: override rules.

### 6. The business case: price it on the bench (red)
Lever simulator: error cut -> safety stock -> cash and service, minus tool cost; break-even cut;
bank as cash vs service; upward bias parks stock; the vendor's claim vs the bench. Capstone memo.
Scorecard 2 (strict, final). Links ai-finance a5 for ROI method.

## Not covered (honest list)
- Forecasting method internals, hyperparameter tuning, probabilistic forecasting (ts course owns).
- Price elasticity and promotion uplift modelling (economics p1-p3, p10).
- Multi-echelon inventory optimisation (MEIO) maths; we show the shape only.
- Warehouse robotics and automation (physical-ai, planned).
- Transport routing and network design; supplier selection; S&OP process design beyond overrides.
- Any named vendor's product walkthrough (Self-study only, re-verify).
- The SMR 1997 article text (not readable from here); Fildes 2009 body text (abstract only).

## Citation appendix
1. Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5CG6D (CC BY 4.0).
2. Lee, H. L., Padmanabhan, V., Whang, S. (1997). Information distortion in a supply chain: the bullwhip effect. Management Science 43(4), 546-558. https://doi.org/10.1287/mnsc.43.4.546
3. Lee, H. L., Padmanabhan, V., Whang, S. (1997). The bullwhip effect in supply chains. Sloan Management Review 38(3), 93-102. [reported]
4. Fildes, R., Goodwin, P., Lawrence, M., Nikolopoulos, K. (2009). Effective forecasting and judgmental adjustments: an empirical evaluation and strategies for improvement in supply-chain planning. International Journal of Forecasting 25(1), 3-23. https://doi.org/10.1016/j.ijforecast.2008.11.010 [findings reported from abstract]
5. Petropoulos, F., et al. (2022). Forecasting: theory and practice. International Journal of Forecasting 38(3). arXiv 2012.03854 (FVA section, quoting Gilliland 2002).
6. Gilliland, M. (2010). The Business Forecasting Deal. Wiley. [reported]
7. Makridakis, S., Spiliotis, E., Assimakopoulos, V. (2022). M5 accuracy competition: Results, findings, and conclusions. International Journal of Forecasting 38(4), 1346-1364. https://doi.org/10.1016/j.ijforecast.2021.11.013 [numbers from the 2020 preprint]
8. Silver, E. A., Pyke, D. F., Thomas, D. J. (2017). Inventory and Production Management in Supply Chains, 4th ed. CRC Press. [formulas taught as standard]
9. Dietvorst, B. J., Simmons, J. P., Massey, C. (2015). Algorithm aversion: people erroneously avoid algorithms after seeing them err. Journal of Experimental Psychology: General 144(1), 114-126. https://doi.org/10.1037/xge0000033
10. Dietvorst, B. J., Simmons, J. P., Massey, C. (2018). Overcoming algorithm aversion: people will use imperfect algorithms if they can (even slightly) modify them. Management Science 64(3), 1155-1170. https://doi.org/10.1287/mnsc.2016.2643
11. Logg, J. M., Minson, J. A., Moore, D. A. (2019). Algorithm appreciation: people prefer algorithmic to human judgment. Organizational Behavior and Human Decision Processes 151, 90-103. https://doi.org/10.1016/j.obhdp.2018.12.005 [reported]
12. Parasuraman, R., Manzey, D. H. (2010). Complacency and bias in human use of automation: an attentional integration. Human Factors 52(3), 381-410. https://doi.org/10.1177/0018720810376055
13. MIT OpenCourseWare 15.772J (2014). Newsvendor Inventory Problem (lecture notes PDF).
14. McKinsey & Company pages on AI forecasting ("20 and 50%" error reduction) [reported, snippets only].
