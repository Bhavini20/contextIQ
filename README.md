# ContextIQ · Quality Score for contextual

A hosted, interactive concept prototype for a Product Management case study (Media.net, Topic 4: integrating contextual targeting into an ad server).

ContextIQ scores every page on **specificity**, **confidence** and **brand suitability**, turns specificity and confidence into a campaign-specific **match probability**, uses suitability as a hard gate, applies the advertiser's **threshold**, and scales the **bid** by match probability. The prototype is a decision simulator over 10 curated pages and 1,000 seeded, simulated ad requests.

> All data is simulated (seeded PRNG, seed 42). Brands and publishers are fictional. Not Media.net data and not a forecast.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (Vitest), incl. the 9 worked results
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

Requires Node 20+.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, **Add New → Project**, import the repo. The framework preset is detected as Vite; `vercel.json` sets `npm run build` and `dist/`.
3. Deploy. The site is static: no environment variables, no API keys, no backend.

Or from the CLI: `npx vercel --prod`.

## Before submitting

- Add the proposal PDF as `public/ContextIQ-proposal.pdf`; the "Read the proposal" link points to `/ContextIQ-proposal.pdf`.
- Optionally export `public/og.svg` to `public/og.png` (1200×630) and point `og:image` at it with an absolute URL; most social platforms don't render SVG previews.

## Project structure

```
src/
  engine/            Pure logic. Every number on screen comes from here.
    taxonomy.ts      Simplified IAB-style taxonomy and closeness rules
    data.ts          10 curated pages (with original article text) and 7 campaigns
    inventory.ts     Seeded inventory: 55 pages, 1,000 requests, hidden ground truth
    engine.ts        Fit, match probability, bands, gate → protected or threshold → price → auction, Strict baseline
    metrics.ts       Fill, revenue, eCPM, precision, guardrails, sweep, calibration, reports, suggested threshold, bid provenance
    classifier.ts    Paste-your-own keyword classifier (demo stand-in for production models)
    __tests__/       Vitest suite
  app/               State + URL deep links, guided mode, command bar, shell
  components/        UI primitives (meter, tooltips, sliders, chips)
  features/          landing, pages (analyser + profile + trace), campaigns, tradeoffs, reports, how
```

## Interaction notes

- **Guided demo:** "Start the demo" on the landing page, or the button at the bottom right. ← → to move, Esc to exit.
- **R** runs another impression in the decision trace. **Ctrl/⌘ + K** opens the command bar.
- State (view, page, strategy, focused campaign, campaign settings, toggles) lives in the URL, so any view can be shared with "Copy link".
- Light and dark themes; `prefers-reduced-motion` is respected.

## Publisher-safe by design

ContextIQ never reprices what Strict matching already sells. Each campaign submits one bid per request:

- **Protected:** if the campaign is Strict-eligible (suitable, primary topic inside its target, confidence ≥ 0.70) it bids its full base bid, exactly as today. Thresholds and bid curves never touch it.
- **Incremental:** otherwise it goes through ContextIQ: suitability gate, threshold, bid scaled by its preset curve.

Because ContextIQ's bids are a superset of Strict's under the same first-price auction, publisher revenue and fill are at least Strict's on every simulated request, at every threshold from 0.30 to 0.95, with strict suitability on or off. The test suite checks this request by request. At the preset thresholds, ContextIQ fills 9.6 points more requests and earns about 20% more per 1,000 requests, with zero suitability violations.

That guarantee holds in this deterministic simulation under unchanged auction rules. A live pilot measures it; production revenue can still vary. Repricing existing inventory by match quality is a Phase 2, opt-in, spend-neutral step, after the pilot proves the signal.
