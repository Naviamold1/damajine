# Damajine demo run sheet

Three demos, about 90 seconds each. Live site: https://damajine.vercel.app

## Before you go on

- Open the site in a fresh incognito window. Empty storage means Wedding loads, already seated (60/60).
- Browser zoom 100% on a laptop screen. On a 1080p projector use 125% (Ctrl +), then click **Fit** (bottom right of the canvas).
- The proxy allows 120 Gemini calls per 10 minutes per IP, and the whole venue may share one IP. Avoid heavy testing right before you present. If live prompts suddenly answer instantly with "I could not turn that into a rule", you are rate limited: switch to safe prompts or a phone hotspot.
- The proxy uses `gemini-3.5-flash-lite` unless `GEMINI_MODEL` is set in Vercel. Do not switch to `gemini-3.8-flash` on this key: its quota runs out (HTTP 429).
- Gemini answers in about 1 to 1.5 s (first call after idle up to 3 s). One warm-up prompt a few minutes before is fine. The safe prompts below answer from the demo cache without calling Gemini, so they always give the scripted result. Anything else goes to Gemini; if that fails, the app falls back to the offline parser. If it hangs, the fallback kicks in after 6 s.
- Local fallback with no network: `VITE_AI_OFFLINE=1 pnpm dev`. Safe prompts and import work the same; wow prompts do not.
- Reset a preset: click its name in the header (Wedding, Hackathon, Restaurant). Ctrl+Z undoes the reset. Full reset: new incognito window.
- Do not click **Solve all** on Wedding or Hackathon. It reseats everyone from scratch (46 moves on Wedding) and leaves the dance-floor tables empty.

| Key | Does |
| --- | --- |
| Ctrl+K | Open or close the rule bar (it toggles: pressing it with the bar open closes it) |
| Enter (in bar) | Parse, then Enter again to propose |
| Enter / Esc (on canvas) | Keep / Revert the proposal |
| Ctrl+Z, Ctrl+Y | Undo, redo |
| Ctrl+Enter (import box) | Parse the pasted list |

## Safe prompts (cached, identical offline)

Wedding
- `Keep Tornike and Luka apart` (1 move)
- `Seat Nino with Mariam` (asks which Nino, then 0 moves)
- `Seat the groom's university friends together` (4 moves)
- `Seat Sophie Turner with Emily Clarke, James Wilson and David Miller` (3 moves, offline parser)
- `Put Eteri near the dance floor` (0 moves, 1 soft left, offline parser)

Hackathon
- `Seat Ana with her team` (1 move)
- `Put Anuki, Giorgi, Lizi, Tazo and Omar near power` (5 moves, offline parser)
- Import list below (offline parser gives the same table)

Restaurant (all five story steps are cached)
- `The Japaridze party needs wheelchair access` (seats all 4 walk-ins)
- `The Gelashvili party is celebrating a birthday, give them a table on the terrace` (1 move)
- `It's raining, close the terrace` (3 moves, terrace tables removed)
- `The Beridze party paid and left` (B1 frees up)
- Import `Okafor, 2 people, just walked in` (offline parser)

## Wow prompts (live Gemini only)

- `grandma Eteri should be close to the dance floor and her grandson Lasha must sit with her`
- `Sophie and Emily only speak English, they must sit with James Wilson and David Miller`
- `Seat team Pkhali Devs together` (after the import)
- `Kartuli Bytes have five laptops, put them by the power sockets`

Offline these answer "I could not turn that into a rule". Use the safe twin listed in each demo.

## Power prompts (live Gemini only, tested on Wedding)

The bar now takes any request: rules, direct seating, tables, guests, room features, or questions. One Enter shows the plan, a second Enter previews it, Keep commits it as one undo step.

| Prompt | What you see |
| --- | --- |
| `who is sitting with Eteri?` | A plain answer, nothing changes |
| `how many vegetarians are there and where do they sit?` | A plain answer |
| `make sure each table has the same amount of people` | Balance rule, 6 moves (also works offline) |
| `the Kvaratskhelia family cancelled` | 3 guests marked not attending, 3 seats freed |
| `add two 10-seat round tables next to the stage and move the groom's university friends there` | 2 new tables by the stage (canvas zooms out to show them), 6 moves |
| `make table 6 a 10 seater and rename it Kids table` | Table change, 0 moves |
| `remove the entrance and make the dance floor bigger` | Room features change |
| `no more than 8 people per table` | Limit rule, 3 moves |
| `Put Otar at table 4 and pin him` | Direct move plus pin. Shows 1 hard left (Otar needs a step-free table): direct moves are allowed to override rules |

## 1. Wedding (core story)

Setup: fresh window, Wedding is loaded and seated. Do not press Solve all.

1. Ctrl+K, type, Enter:
   ```
   Keep Tornike and Luka apart
   ```
   See: hard apart rule, Luka Table 2 → Head table, 1 move. Enter: blue arc on the canvas, Keep bar. Enter to keep.
   Say: "Plain English in, one move out. Nothing changes until I keep it."
2. Ctrl+K, type, Enter:
   ```
   Seat Nino with Mariam
   ```
   See: "Which Nino: Nino Beridze or Nino Tsiklauri?" Click **Nino Tsiklauri**. 0 moves, they already share Table 8. Enter, Enter.
   Say: "Two Ninos at this wedding. It asks instead of guessing."
3. Ctrl+K, type, Enter:
   ```
   grandma Eteri should be close to the dance floor and her grandson Lasha must sit with her
   ```
   See: soft dance-floor rule, hard together rule, 0 moves, 1 soft left. Enter: Table 5 turns orange. Enter to keep.
   Say: "Eteri needs the step-free table, and it is not by the dance floor. Must beats should, and it tells you what it could not do."
4. Ctrl+K, type, Enter:
   ```
   Sophie and Emily only speak English, they must sit with James Wilson and David Miller
   ```
   See: hard together rule, Sophie, Emily, David → Table 6, 3 moves. Enter, Enter.
   Say: "It worked out who 'they' are. Gemini writes the rule, our solver does the seating."
   Keep the word "must". Without it Gemini sometimes makes the rule soft and you get 1 odd move and "2 soft left".
5. Ctrl+Z (Sophie's group goes back), Ctrl+Y.
   Say: "Every AI change is one undo step."
6. Click **Print**: tables plus an alphabetical "Find your seat" list. Esc.

Fallback: if step 3 or 4 is slow or says "could not turn that into a rule", Esc and type the safe twin: `Put Eteri near the dance floor` (same 0 moves, 1 soft left) and `Seat Sophie Turner with Emily Clarke, James Wilson and David Miller` (same 3 moves).

## 2. Hackathon (this room)

Setup: click **Hackathon**. 54/55 seated, Ana Gelovani is under Unseated. Teams Tamada, Null Pointers, Svaneti Signal are pinned.

1. Ctrl+K, type, Enter:
   ```
   Seat Ana with her team
   ```
   See: Ana unseated → T7 with Svaneti Signal, 1 move. Enter, Enter.
   Say: "Ana joined her team this morning. It knows which team."
2. Click **Import**, paste, Ctrl+Enter:
   ```
   Nini Kalandadze (wheelchair)
   Dato Abuladze +1
   team Pkhali Devs:
   Mariam & Sandro Tsintsadze, vegan
   - luka chikovani, veg
   ```
   See: 4 rows. Nini wc, Dato size 2, Mariam & Sandro size 2 vegan, luka veg, team as group. Click **Add 4 guests**: 4 moves, Nini → T10 (step-free). Enter.
   Say: "Messy late registrations, pasted straight from the chat."
3. Ctrl+K, type, Enter:
   ```
   Seat team Pkhali Devs together
   ```
   See: 2 moves to T9. Enter, Enter.
4. Ctrl+K, type, Enter:
   ```
   Kartuli Bytes have five laptops, put them by the power sockets
   ```
   See: all five T11 → T8 (by the sockets), 5 or 6 moves (6 when one guest at T8 moves over to make room), nothing left over. Enter, Enter.
   Say: "It knows the room: stage, quiet corner, wall sockets."

Fallback: import works offline as is. Skip step 3. For step 4 type `Put Anuki, Giorgi, Lizi, Tazo and Omar near power` (same 5 moves).
Avoid `Put team Khachapuri near the stage`: they already sit at T2, so it shows 0 moves.

## 3. Restaurant (live floor)

Setup: click **Restaurant**. 17/31 seated. Eight parties are eating and pinned (one color each, pins on the chips), four walk-ins wait under "Waiting for a seat": Japaridze (wheelchair), Gelashvili (birthday), Chen, Kobakhidze.

Every step is cached, so it gives exactly this result with or without Gemini.

1. Ctrl+K, type, Enter:
   ```
   The Japaridze party needs wheelchair access
   ```
   See: 4 moves, every walk-in seated at a table of their own, Japaridze → F3 (step-free). 31/31. Enter, Enter.
   Say: "One sentence, the whole waiting line is seated, and nobody who is eating gets moved."
2. Ctrl+K, type, Enter:
   ```
   The Gelashvili party is celebrating a birthday, give them a table on the terrace
   ```
   See: Gelashvili B2 → P3 on the terrace, 1 move. Enter, Enter.
3. Ctrl+K, type, Enter:
   ```
   It's raining, close the terrace
   ```
   See: "Remove P1, P2 and P3", the birthday's terrace rule dropped, 3 moves: Smith → F2, Mchedlishvili → T4, Gelashvili → B2. Nothing left unresolved. Enter, Enter.
   Say: "The weather changed. One sentence, the terrace is gone, and everyone out there has a table inside, even the people already eating."
4. Ctrl+K, type, Enter:
   ```
   The Beridze party paid and left
   ```
   See: "Remove Nino Beridze", B1 is free. Enter, Enter.
5. Click **Import guests**, type `Okafor, 2 people, just walked in`, Ctrl+Enter, **Add 1 guest**: Okafor → B1 (the booth Beridze freed), 1 move. Enter.
   Say: "Tables turn over, a walk-in arrives, one move. The rest of the floor stays put."

Bonus: drag any chip onto a specific seat (it snaps to the nearest one). Dropping on a taken seat sends that guest back to "Waiting for a seat". Ctrl+Z undoes it.
Parties never share a table in this preset (the bar is the exception), so do not ask to seat two parties together.

## Known issues

- Wedding: Solve all repacks tightly and empties Tables 3 and 4.
