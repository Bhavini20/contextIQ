# Kickoff prompt: paste this into Claude Code

> Put this folder's contents in an empty project directory first (so `CLAUDE.md` and `docs/` sit at the root), then open Claude Code there and paste the message below.

---

I'm submitting a Product Management case study to Media.net (a leading contextual advertising company) for an APM role. You're going to build the hosted, interactive prototype for it. It's half of my submission and it needs to be outstanding.

Everything you need is in this folder:

- `CLAUDE.md`: your working instructions and non-negotiables.
- `docs/01-assignment-brief.md` (+ `docs/00-assignment-original.pdf`): what Media.net asked for and how they judge it.
- `docs/02-solution-proposal.md`: our product, ContextIQ ("Quality Score for contextual").
- `docs/03-prototype-spec.md`: the exact build spec: data, engine logic, 9 worked results that must match, required screens, metrics, edge cases, traceability and acceptance checklists.
- `docs/04-design-direction.md`: the creative brief.

Two things matter equally:

1. **Correctness.** The engine logic and numbers in the spec are fixed. Build `engine.ts` and its unit tests first and make all 9 worked results pass before any UI.
2. **Design.** I don't want this to feel "prototypey". Study the design language in `04-design-direction.md` (Stripe's storytelling, Linear's precision, NYT Upshot-style explorable explanations) and take real creative liberty. Invent the layout, the visual metaphors and the interactions. If you can beat the concept ideas in the brief, do. Just keep every item in the spec's traceability checklist visible, and avoid every anti-pattern listed.

Start by reading all the docs, then show me a short plan before writing UI code:
- your design concept (theme, type pairing, accent colour, the 2–3 signature interactions),
- the information architecture (how the six areas, guided "story" mode and free exploration fit together),
- the build order.

After I approve, build it, screenshot each view at desktop and mobile widths, critique the screenshots against the design brief, iterate, run the acceptance checklist, and get it ready to deploy on Vercel.
