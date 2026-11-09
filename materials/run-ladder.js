/* Runs every bench through assets/asc-live.js in node and prints the same JSON shape as
   materials/asc_reference.py. Usage: node materials/run-ladder.js > node.json */
var path = require("path");
var S = require(path.join(__dirname, "..", "assets", "asc-sample.js"));
var E = require(path.join(__dirname, "..", "assets", "asc-live.js"));
var pg = E.playground(S);
pg.beta = E.forecastAll(S).beta;
var stock = {}, alloc = {}, bw = {}, sim = {};
E.STOCK_RUNGS.forEach(function (r) { var o = E.stock(S, r[1]); delete o.perSku; stock[r[0]] = o; });
E.ALLOC_RUNGS.forEach(function (r) { alloc[r[0] + "-" + r[1]] = E.allocate(r[0], r[1]); });
E.BW_RUNGS.forEach(function (r) { bw[r[0]] = E.bullwhip(S, r[1]).ratios; });
E.caseRungs(pg, S).forEach(function (r) { sim[r[0]] = E.simulate(r[1]); });
var out = { playground: pg, stock: stock, allocation: alloc, bullwhip: bw, simulator: sim,
  newsvendor: { cu6co2: 6 / (6 + 2), z95: E.invNorm(0.95), z98: E.invNorm(0.98) } };
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
