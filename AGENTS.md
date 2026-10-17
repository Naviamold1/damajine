# Damajine

Seating canvas for any gathering: weddings, corporate events, restaurants. One engine, three presets. Gemini turns plain language into rules; a deterministic solver does the seating. Built for HACKTOBERFEST Georgia 2026 (17-18 Oct), so speed and a working demo beat polish. See `PLAN.md` for phases and the demo.

## Commands

- `pnpm dev`: dev server
- `pnpm build`: typecheck + build (run before declaring anything done)
- `pnpm lint`: oxlint
- `pnpm test`: vitest

Package manager is pnpm. Do not use npm or yarn.

## Stack

Vite, React 19, TypeScript, Tailwind 4, Zustand, Zod, Vitest. shadcn is not initialized yet; run `pnpm dlx shadcn@latest init` when components are needed. Imports use the `@/` alias for `src/`.

## Architecture

- `src/domain/types.ts`: Zod schemas and inferred types (`Guest`, `Seatable`, `Rule`, `Assignment`, `Chart`). This is the contract. Infer types from the schemas, never hand-write parallel types. Changing it affects everyone, so flag it.
- `src/engine/`: pure, deterministic solver (`findViolations`, `solve`, `repair`). No React, no I/O, no randomness without a seed. Must respect pinned assignments, hard rules, and party size vs seats.
- `src/store/chart.ts`: Zustand store with undo/redo and local persistence. Every edit, human or AI, goes through `commit` so undo covers it.
- `src/ai/`: Gemini calls. The model returns structured output validated by the Zod schemas. It never mutates the chart directly; its result becomes a proposal the user keeps or reverts.
- `src/presets/`: wedding, corporate, restaurant (layout + rule templates + demo guests).
- `api/`: one serverless function that holds the Gemini key. The key never ships to the client.

## Rules for working here

- Keep it simple. Prefer the smallest change that works.
- No `any`. Lean on inference and `z.infer`. No one-line casting wrappers.
- Tests are for the engine and the AI parsing layer (violations per rule, pins stay put, repair moves few guests, party sizes fit). No smoke tests.
- Comment how functions are used, concisely, above the definition. Keep comments in sync with changes.
- Stay inside your assigned area. If a change needs another area's files, say so instead of editing them.
- Do not touch production deploys or env secrets.
