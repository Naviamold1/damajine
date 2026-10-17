# Damajine: implementation plan

Seating canvas for any gathering. Wedding, corporate event, restaurant. One engine, three presets. Gemini turns plain language into rules; a deterministic solver does the seating.

Hackathon: 17-18 Oct 2026, demos Sunday evening.

## Principles

- Shared types are the contract: `src/domain/types.ts`. Everything infers from the Zod schemas.
- Solver is deterministic and pure. AI never mutates the chart directly. It returns validated `Rule[]` / `Guest[]` / text, shown as a proposal the user keeps or reverts.
- Every edit (human or AI) goes through `useChart.commit`, so undo/redo covers everything.
- No backend except one serverless function that hides the Gemini key.
- Cut order if time runs out: restaurant live mode, then smart import, then explanations. Never cut canvas, solver, or NL rules.

## Phase 0: lock contract (first ~30 min, all)

- Review `domain/types.ts`. Add missing fields now, not later.
- Agree store actions: `addGuest`, `moveGuest`, `pinGuest`, `addSeatable`, `moveSeatable`, `addRule`, `applyAssignments`.
- Agree the proposal shape: `{ assignments, moved, violations, explanation }`.
- Git repo, branch per person, merge to `main` often.

## Phase 1: parallel build

**A: Canvas**

1. Pan/zoom surface, render seatables by `kind` (round, rect, booth, row, bar, zone).
2. Drag seatables; place from a palette.
3. Guest list sidebar; drag guest onto a seatable; unseated list.
4. Pin toggle, undo/redo buttons, violation highlight on seats and tables.
5. Proposal overlay: show moved guests, Keep / Revert.

**B: Engine**

1. `findViolations`: apart, together, zone, accessible, capacity.
2. `solve`: group `together` guests, place by constraints, respect pins, party size vs seats, zones.
3. `repair`: minimal-move fix; seat late arrivals without reshuffling.
4. Tests: violations per rule type, pinned stay put, repair moves few guests, party size fits. Focused, no smoke tests.

**C: AI + presets**

1. `api/gemini.ts` Vercel function. Key in env, JSON schema mode, rate limit by simple per-IP cap.
2. `ai/rules.ts`: text to `Rule[]`, resolving names to guest ids, validated with Zod. Ask back when a name is ambiguous.
3. `presets/`: wedding, corporate, restaurant. Each = layout, rule templates, demo guests.
4. `ai/import.ts`: pasted messy list to `Guest[]`.
5. `ai/explain.ts`: why a guest sits where they do, using solver facts as grounding.

## Phase 2: integrate

- Wire NL rule box to store, then to `repair`, then to proposal overlay.
- Wire preset switcher.
- Wire import flow.
- Printable chart (print CSS or PDF export).
- Fix geometry and drag bugs; they will be the most of them.

## Phase 3: demo polish

- Rehearse the three demos below. Pre-seed data so nothing depends on live typing luck.
- Fallback for Gemini failure: cached responses for the demo prompts.
- Deploy to Vercel, test from a clean browser.
- Slides: problem, 3 presets, live demo, "where this goes" (live restaurant floor, shared sessions).

## Risks

- Solver quality: start with greedy + local search, no fancy optimization.
- Canvas geometry eats time: ship rounded/rect only first, other kinds as styled variants.
- Gemini latency or quota: cache demo responses, show a loading state, keep deterministic paths working offline.
- Name matching in NL rules: fuzzy match plus explicit confirm step.

## Unresolved questions

- Gemini model ID and quota for the key we will use?
- Deploy target confirmed as Vercel?
- Restaurant mode: static demo of walk-in repair only, or a true live floor?
