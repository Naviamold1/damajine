# Damajine

Seating canvas for any gathering: weddings, corporate events, restaurants, hackathons, auditoriums, trains. One engine, six demo presets, plus "New event" to start from a blank room or a preset's room (saved under "Yours" in the header). Gemini turns plain language into a plan of typed actions (rules, seating, tables, guests, room features, answers); a deterministic solver does the seating. Built for HACKTOBERFEST Georgia 2026 (17-18 Oct), so speed and a working demo beat polish. See `PLAN.md` for phases and the demo.

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
- `src/ai/`: Gemini calls. `actions.ts` is the core: Gemini answers with a list of `Action`s (a Zod union, one small schema per type), `applyActions` validates each against the chart and applies it to a copy (bad ones are skipped with a reason), and `planProposal` lets the solver reseat around the result. It never mutates the chart directly; the result becomes a proposal (the whole next chart) the user keeps or reverts. `rules.ts` holds the offline parser used when Gemini is unavailable. To give the AI a new ability, add an `Action` variant, handle it in `applyActions`, and mention it in the prompt.
- `src/domain/edits.ts`: pure chart edits (remove guests or tables with cleanup) shared by the store and AI actions.
- `src/presets/`: restaurant, wedding, corporate, hackathon, auditorium, train (layout + decor + rule templates + demo guests).
- `api/`: one serverless function that holds the Gemini key. The key never ships to the client.

## Design ("supra table")

The UI design is settled. Extend it; do not restyle it. Tokens live in `src/index.css` `@theme`, so use them (`text-ink`, `bg-floor`, `text-wine`, `shadow-island`...) instead of raw hex.

- Light theme. White chrome (header, sidebar), cool gray dotted `floor` for the canvas, `ink` text, `dim` / `faint` for secondary text.
- One accent: Saperavi `wine`, used for selection, pins, the seated progress bar and the AI sparkle. Status colors are reserved for meaning: `hard` red, `soft` orange, `moved` teal (proposals).
- Type: Gabarito (`font-display`) for the wordmark, headings, table labels and chip initials. Onest (`font-sans`) for everything else. Both are bundled via `@fontsource-variable`, so they work offline.
- The signature is guest chips: initials on a pastel tinted by group (`groupTint` in `canvas/derived.ts`). The same `GuestChip` appears in the sidebar, command bar, proposal card and import preview. Status states replace the tint with a solid status color and white text.
- Floating canvas controls are white rounded "islands" (`rounded-xl bg-white shadow-island`): legend top left, add-table dock top right, zoom bottom right, `AskPill` / `ProposalBar` bottom center.
- Dialogs: `rounded-2xl` white card on `bg-ink/25`, with a `bg-floor` footer for key hints.
- Icons come from `canvas/icons.tsx` (stroke, 1em). Add new paths there rather than pulling in an icon library.
- Motion: only the one-shot `animate-pop` (dialogs, proposed moves), disabled under reduced motion. No looping animations.
- Copy: plain, sentence case, says what happens ("Reseat all", "Import guests", "Read list"). Needs show as emoji in the UI (`guestBadges`) and as text in print (`guestTags`).

## Rules for working here

- Keep it simple. Prefer the smallest change that works.
- No `any`. Lean on inference and `z.infer`. No one-line casting wrappers.
- Tests are for the engine and the AI parsing layer (violations per rule, pins stay put, repair moves few guests, party sizes fit). No smoke tests.
- Comment how functions are used, concisely, above the definition. Keep comments in sync with changes.
- Stay inside your assigned area. If a change needs another area's files, say so instead of editing them.
- Do not touch production deploys or env secrets.
