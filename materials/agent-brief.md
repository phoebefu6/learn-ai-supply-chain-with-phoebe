# Agent brief - shared by every fan-out page of learn-ai-supply-chain-with-phoebe

Internal build document, never linked from an audience page.

You are writing ONE static HTML session page. No servers, no npm. **If your target file already
exists on disk, do not write it; report that and stop.** Write the file, return its path and one
line of coverage. No HTML in your reply.

## Read first, in this order

1. The template page. Copy its structure, classes, SVG grammar and quiz markup EXACTLY, including
   3 options per quiz question:
   `/Users/phoebe.fu/Documents/Claude_Work/github_repo/learn-ai-supply-chain-with-phoebe/courses/01-every-forecast-is-wrong.html`
2. The source map: every verified number, its evidence tier, per-session coverage, the seams and
   the bench canon. Use ONLY its numbers; never invent a statistic; if a fact is missing, teach the
   uncertainty.
   `/Users/phoebe.fu/Documents/Claude_Work/github_repo/learn-ai-supply-chain-with-phoebe/materials/official-course-map.md`
3. The stylesheet `:root` block for the palette tokens:
   `/Users/phoebe.fu/Documents/Claude_Work/github_repo/learn-ai-supply-chain-with-phoebe/assets/style.css`
4. The widget kit (wipe, tick, tryrow, stakes, scorecard markup contracts):
   `/Users/phoebe.fu/Documents/Claude_Work/github_repo/learn-ai-supply-chain-with-phoebe/materials/widget-kit.md`
5. The bench engine's DOM section, to know what your widget prints:
   `/Users/phoebe.fu/Documents/Claude_Work/github_repo/learn-ai-supply-chain-with-phoebe/assets/asc-live.js`
   You may run `node /Users/phoebe.fu/Documents/Claude_Work/github_repo/learn-ai-supply-chain-with-phoebe/materials/run-ladder.js`
   (from a scratch directory under /private/tmp/claude-504/asc/, never the repo) to see canon numbers.

## Page skeleton (keep every component)

toolbar (crumb EXACTLY "learn-ai-supply-chain-with-phoebe / Session N of 6", #toggle-all,
#zoom-toggle) · masthead (eyebrow "Learn AI + Supply Chain with Phoebe · Session N of 6", h1 with one
`<span class="accent">`, .sub, .chip-row with the level chip (🟡 Medium for 2-3, 🟠 Hands-on for
5) plus the two audience chips and "45 min" as in the template, .agenda a1-a4) · main.wrap ·
section#intro (Part 0: kicker, .lede, .legend pills, .callout.win "★ What you walk out with
tonight") · 3 Parts, each `section.section#part-N` with section-kicker (klabel "Part N · covers ...",
h2, `.tag.concept "N min live"`), a `.lede`, ONE figure, `details.card` accordions (summary:
`.mode.live` or `.mode.self`, title, `.mini`, `.caret ▶`), at least one `.callout.example` with
`span.ex-pill` "Real world" on the page · section#demo-1 Build-along (kicker `.tag.demo "★ 22 min ·
everyone builds"`, .lede, the bench widget div, ONE figure, `.steps > .step`, each with a
`.prompt-box.good` carrying a `span.label`; the last step writes the playbook section) ·
section#exercise Homework (ol, 4 items) · section#quiz (3 x `.quiz-q data-answer="0-based"`,
`p.qtext`, `button.qopt` "A · ...", 3 options, `p.qwhy`; one `p.quiz-score` after the last) ·
section#official, h2 EXACTLY "What this session teaches, and where it came from",
`.covered > .covered-row` (pill solid ✓ / light ◐ + name + note), then the `.mono` line EXACTLY
"Every fact on this page, and its verification tier, is recorded in the course's source map." ·
section.cheat#cheatsheet (h3 "Session N cheat sheet <span>· pin this</span>", .grid-2 of six
.cheat-item) · `.callout.next` with `.nx-pill` "Next session" · footer.pagefoot · scripts:
`<script src="../assets/asc-sample.js?v=1"></script>` `<script src="../assets/asc-live.js?v=1"></script>`
`<script src="../assets/app.js?v=2"></script>`.

Head: the template's social meta block with this page's own title/description/url;
`<title>Session N · <title> - learn ai supply chain with phoebe</title>`;
`<link rel="stylesheet" href="../assets/style.css?v=1">`. Nothing else external.

First `details.card` in the FIRST Part is `open` only on page 1; on your page none is open except
the intro card, as in the template. Sentence case headings. Warm practitioner voice, concrete,
never dry. Inside prompt-boxes escape `&` `<` `>`. 450 to 650 lines is guidance about depth, never
a target. Density: 4 figures or widgets minimum (3 Part figures + build-along figure + the bench
widget; add one wipe, tick, tryrow or stakes from the kit where it earns its place).

## Hard rules (a violation is rework)

- NEVER an em dash or en dash, anywhere (prose, code, aria-labels, comments). Hyphen only.
- No meta text: never "this course", "in this course", "the course teaches", "this page". State the
  professional norm directly with its reason. The two exact estate phrases above are the only
  self-references; "session 5" cross-references are fine.
- Attribution "by Phoebe Fu". Never "built with" a tool.
- Every number comes from the map or is printed by a widget, or is labelled constructed. For
  constructed data print "your numbers will differ". Every number your page quotes from a widget
  must be one the widget actually prints at the stated setting.
- Contested or missing evidence: teach the disagreement; never resolve what the literature has not.
  Anything tiered [R] in the map is written as "reported" or "the abstract reports".
- NEVER "lottery" or "lotteries"; say the mechanism.
- English words only.
- Do not attribute "Pampers", "channel alignment" or "operational efficiency" to Lee, Padmanabhan
  and Whang (unverified). Fildes et al. 2009 findings are from the abstract: say so.
- Titles, widget ids and class names must not collide with siblings. Use only the asc-* ids given
  in your outline. Never reuse a sibling course's case name (Quayside, Cadence, Kettle & Co,
  Marchmont, Brindle, Marrow).
- Light surfaces only. No dark panels.
- Running case: "Northwick", a constructed mid-size homeware retailer (about 4,000 SKUs, DC North
  and DC South, about 60 stores, an online shop). Label "Constructed Northwick example" wherever its
  numbers appear. Never Phoebe's employers, clients or projects.

## Figure grammar (hand-drawn, every figure)

Palette, ONLY these hexes: ink #18200C · muted #4F5842 · deep olive #26330F · olive #3D5020 ·
mid olive #5C7330 · soft #C9D6A8 · tint #F2F5E8 · faint #CDD3BF · hairline #E3E7D8 ·
paper #F8F9F3 · safety yellow #F2C200 · yellow ink #5E4500 · yellow tint #FFF6D1 · #FFFFFF ·
universal reds #991B1B #FEF2F2 #FCA5A5 only for a wrong-way panel.
Text on #F2C200 is ALWAYS ink #18200C, never white. White text only on #3D5020, #26330F or #5C7330.

- `<figure class="zoomable">` > `<svg viewBox="0 0 880 H" role="img" aria-label="the data, not the
  shape">` > `<defs>` + `<style>` + content, then `<figcaption>🔍 Click to zoom - takeaway</figcaption>`.
  Grow H, never W.
- Prefix unique per figure, used for every class and id: `s<N><letter>` (s2a, s2b ... s5d).
- `<defs>` holds a wobble filter `id="PSk"` (feTurbulence fractalNoise baseFrequency 0.02
  numOctaves 2 seed int + feDisplacementMap scale 2.4, x -3% y -3% width 106% height 106%), a
  hachure pattern `id="PHc"` (7x7 userSpaceOnUse, rotate(-38), one #3D5020 line, opacity .5), an
  open arrowhead `id="PAr"` (path M1 1 L9 5 L1 9, fill none, ink stroke 1.6). ALL shapes sit inside
  ONE `<g filter="url(#PSk)" fill="none" stroke="#18200C" stroke-width="2" stroke-linecap="round"
  stroke-linejoin="round">`; rects carry a tiny rotation (under 1 degree for panels). Fills: white,
  tint, the hachure for "the pile" or "the data", and safety yellow ONLY for the one thing the figure
  is about. Text classes: `.PH` 800 12px ink heading · `.PL` 600 12px ink label · `.PS` 400 11px
  muted · `.PB` 800 11px #5E4500 · `.PV` 800 16-20px #26330F value · `.PW` 800 12px white on an olive
  fill · `.PA` 700 11px #3D5020 axis caption · `.PN` 400 12px muted note.
- ALL `<text>` outside the filtered group, never below 10.5px.
- Fit: max chars about (box width - 20) / 7 at 12px, 6.4px per char at 11px; full-width note under
  110 chars; 40px between neighbouring point labels; bottom note 22px below the last row, H clears
  it by 8px. No path, arrow or line may cross a label. When in doubt, shorten.
- Draw the MECHANISM (where the error enters the stock formula, which channel the rule starves,
  where the override enters the forecast chain), never a metaphor literally, never decoration.

## Cross-links (absolute URLs, only these)

- Forecast metrics: https://phoebefu6.github.io/learn-timeseries-forecasting-with-phoebe/courses/a5-measuring-forecasts.html
- Backtesting: https://phoebefu6.github.io/learn-timeseries-forecasting-with-phoebe/courses/b8-backtesting-metrics.html
- Baselines: https://phoebefu6.github.io/learn-timeseries-forecasting-with-phoebe/courses/b2-decomposition-baselines.html
- When AI: https://phoebefu6.github.io/learn-when-ai-with-phoebe/courses/03-when-classic-ml-wins.html
- Economics demand from data: https://phoebefu6.github.io/learn-economics-with-phoebe/courses/p1-demand-from-data.html
- AI finance ROI: https://phoebefu6.github.io/learn-ai-finance-with-phoebe/courses/a5-roi-business-case.html
- Hub: https://phoebefu6.github.io/learn-with-phoebe/

## Footer chain and session titles

Footer left: "Session N of 6 · learn-ai-supply-chain-with-phoebe · by Phoebe Fu &nbsp;·&nbsp; 📚 <a href="https://phoebefu6.github.io/learn-with-phoebe/">Learn with Phoebe ↗</a>"
Footer right: `<a href="0(N-1)-....html">← Prev: <title></a> &nbsp;·&nbsp; <a href="0(N+1)-....html">Next: <title> →</a>`

1. 01-every-forecast-is-wrong.html · Every forecast is wrong: budget the error
2. 02-from-forecast-to-stock.html · From forecast to stock: safety stock and service level
3. 03-allocate-scarce-stock.html · Allocate scarce stock: rules before optimisers
4. 04-shocks-and-the-bullwhip.html · Shocks and the bullwhip
5. 05-when-the-planner-is-right.html · When the planner is right: overrides and trust
6. 06-price-it-on-the-bench.html · The business case: price it on the bench

Playbook sections: 1 forecast-error budget · 2 stock policy · 3 allocation rules · 4 disruption
playbook · 5 override rules · 6 business case.
