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

- Replace `[YOUR NAME]` (`AUTHOR_NAME`) and `PROPOSAL_PDF_URL` in `src/lib/format.ts`.
- Optionally export `public/og.svg` to `public/og.png` (1200×630) and point `og:image` at it with an absolute URL; most social platforms don't render SVG previews.

## Project structure

```
src/
  engine/            Pure logic. Every number on screen comes from here.
    taxonomy.ts      Simplified IAB-style taxonomy and closeness rules
    data.ts          10 curated pages (with original article text) and 7 campaigns
    inventory.ts     Seeded inventory: 55 pages, 1,000 requests, hidden ground truth
    engine.ts        Fit, match probability, bands, gate → threshold → price → auction, Strict baseline
    metrics.ts       Fill, revenue, eCPM, precision, guardrails, sweep, calibration, reports, suggested threshold, break-even uplift
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

## A finding worth knowing

With the spec's fixed logic and 0% advertiser trust uplift, ContextIQ fills about 9.6 points more requests than Strict matching but earns about 5% less per 1,000 requests, because it discounts pages Strict already sold at full price. It breaks even at a trust uplift of roughly 6%. The prototype shows this openly (Trade-offs → "The honest number") rather than tuning the data: it is the hypothesis the pilot is designed to test.
