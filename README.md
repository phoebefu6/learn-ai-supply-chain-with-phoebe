<!-- learn-with-phoebe hub banner -->
> ### 📚 Part of [**Learn with Phoebe**](https://phoebefu6.github.io/learn-with-phoebe/)
> The shelf of 192 free, hands-on courses on AI, data, and the craft around them. **[Browse every course ↗](https://phoebefu6.github.io/learn-with-phoebe/)**
<!-- /learn-with-phoebe hub banner -->

# Learn AI + Supply Chain with Phoebe

Six 45-minute sessions for ops, supply chain and planning leads being sold an AI forecasting or
planning tool, and for the planners and analysts who will run it. One question runs through all
six: the vendor says the forecast is 30 percent better, so how much stock, service and cash does
that actually move, and where does a spreadsheet still win?

1. Every forecast is wrong: budget the error
2. From forecast to stock: safety stock and service level
3. Allocate scarce stock: rules before optimisers
4. Shocks and the bullwhip
5. When the planner is right: overrides and trust
6. The business case: price it on the bench

Every bench runs in the browser. The forecast playground, stock policy and bullwhip lever use 45
real SKUs and 104 real weeks from the UCI Online Retail II dataset (Daqing Chen, 2012, CC BY 4.0,
https://doi.org/10.24432/C5CG6D), sampled and aggregated to weekly demand by
`materials/build-asc-sample.py`. `materials/asc_reference.py` recomputes every number in Python
and `materials/compare-ladder.py` checks the two agree. Northwick, the running retailer, and every
one of its volumes, costs and prices are constructed.

No code or vendor account needed. Static HTML, no build step.

by Phoebe Fu
