# CLAUDE.md · ContextIQ prototype

You are building the **hosted, interactive prototype** for a Product Management case study submitted to **Media.net** (a leading contextual advertising / adtech company) for an APM role. This prototype is half of the submission and will be judged by product leaders. It must be **excellent**: correct, explorable, and designed to the standard of the best product websites in the world.

## Read these first (in order)

1. `docs/01-assignment-brief.md`: what Media.net asked for and how it is judged. (Original PDF: `docs/00-assignment-original.pdf`.)
2. `docs/02-solution-proposal.md`: our product, **ContextIQ**, the problem, the solution, metrics, rollout and risks.
3. `docs/03-prototype-spec.md`: **the build spec.** Data, engine logic, worked results, required screens, metrics, edge cases, traceability checklist, acceptance criteria.
4. `docs/04-design-direction.md`: **the creative brief.** The design language, concept ideas, visual system and anti-patterns.

## The product in one paragraph

ContextIQ is "Quality Score for contextual advertising." Instead of a yes/no match between a page and an ad category, it scores each page on **specificity**, **confidence** and **brand suitability**, combines specificity and confidence into a campaign-specific **match probability**, uses suitability as a hard pass/fail gate, applies the advertiser's **threshold**, and scales the **bid** by match probability (curve set by an objective preset). The prototype is a **decision simulator** that lets a reviewer see, on 10 curated pages and 1,000 simulated requests, how this beats today's strict matching on reach and revenue while protecting relevance and suitability, and where it costs something (the P7 cannibalisation case).

## Non-negotiables

1. **Logic is fixed.** Implement `src/engine/` exactly per spec sections 3, 4, 6 and 7. Write unit tests (Vitest) for all 9 worked results in spec section 4 and for "suitability violations = 0" **before** building UI. Every number on screen must come from the engine; nothing hard-coded for display.
2. **Design is free.** Layout, navigation, visual metaphors, motion and how the six areas are organised are yours to invent, guided by `04-design-direction.md`. Be ambitious and original. Avoid every item in its anti-patterns list.
3. **Everything in the traceability checklist (spec section 9) must be visible** somewhere in the final app.
4. **Static, deterministic, keyless.** React + TypeScript + Vite, Tailwind (custom token theme), Framer Motion for motion, Recharts / visx / hand-rolled SVG for charts. No backend, no API keys, no LLM calls. Seeded PRNG (seed 42). Deployable to Vercel as a static site.
5. **Honest labelling.** Simulated data is labelled elegantly on every view, with chart footnotes. Fictional brands only. No Media.net logo or real advertiser names.
6. **Real content.** Write original, realistic article text (150–300 words) for each curated page. No lorem ipsum anywhere.
7. **Works everywhere.** Chrome, Safari, Firefox; desktop and phone widths; incognito; `prefers-reduced-motion`; keyboard accessible; WCAG AA contrast.

## Suggested project structure

```
src/
  engine/        # taxonomy.ts, data.ts (pages, campaigns), inventory.ts (seeded), engine.ts, classifier.ts, metrics.ts
  engine/__tests__/
  design/        # tokens, typography, motion presets
  components/    # reusable UI primitives
  features/      # landing/story, analyser, profile, campaigns, trace, dashboard, reports, how-it-works
  app/           # routing, URL state, guided mode
```

## How to work

1. Read all four docs. Then write a short plan: your **design concept** (which ideas from the creative brief you'll use or what you'll invent instead, the default theme, type pairing and accent colour), the information architecture, and the build order. Show me the plan before writing UI code.
2. Build the engine and tests first; run them green.
3. Build the design tokens and app shell, then each area. After each area, run the app, take screenshots (desktop and ~390px mobile), and critique them against `04-design-direction.md`. Iterate on anything that looks like a generic dashboard.
4. Implement guided mode following the 90-second script in spec section 1.
5. Run the acceptance checklist in spec section 10 and tick every traceability item in spec section 9. Report any gaps honestly.
6. Prepare for deployment: `vercel.json` if needed, a clean `README.md` with run/deploy steps, and correct `<title>`, favicon and social preview meta (title: "ContextIQ · Quality Score for contextual").

## Placeholders to leave clearly marked

- `[YOUR NAME]` in the footer.
- `PROPOSAL_PDF_URL` constant for the "Read the proposal" link.

## Definition of done

- All unit tests pass, including the 9 worked results.
- Every item in spec section 9 is visible; every item in spec section 10's acceptance list is met.
- A first-time reviewer can complete the 90-second guided path without help, and would describe the app as "polished" and "clearly a real product idea", not "a prototype".
