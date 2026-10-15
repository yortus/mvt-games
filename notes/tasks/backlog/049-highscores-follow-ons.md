# Highscores: Follow-Ons

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-15 |
| Updated  | 2026-10-15 |

## Description

Proposal 046 gave the Arcade's games global highscore tables, kept by a
Cloudflare Worker. It was archived on 2026-10-15. This task holds what it
left open. None of it is needed for the tables to work. Each item can be
done on its own, or dropped.

### Each game configures its own table

The games with tables, each with its cap and its table's version, are listed
in `GAMES`, in `packages/website/src/highscores/rules/games.ts`. That is far
from the games, so it is hard to keep up to date. The owner wants each game
to configure its own table instead, probably in its `start/entry.ts`, in
place of `hasHighscores: true`.

The catch is the Worker. It needs the list of games at every post, but it
cannot import the catalogue, because each `entry.ts` imports its thumbnail
image. So the Worker's list would need to be generated from the entries when
the site is built, or extracted from them by a script, with a test that the
two agree. The catalogue test that checks `hasHighscores` against `GAMES`
would then go.

### One cap for every game

Each game has a cap, the highest score the Worker accepts. The Worker
enforces it on every post, so nothing in a browser can get round it. But a
cap stops only scores above it. For the open-ended games it is 9,999,999,
which stops only absurd numbers. Only Crumb Chase's cap, 2520, is its true
maximum.

One cap for every game, set by the most digits the table can show, would
lose almost nothing. Crumb Chase could keep its own. It would leave each
game only its id and its table's version to configure, which makes the
item above smaller.

### Looking after the tables

Neither Worker has an admin token yet, so no row can be removed from either
environment's tables. The command to set one is in the Worker's README. The
test environment's Astrovoid table holds a test row, `T.T` with 1 point,
from a check on 2026-10-08.

### Later ideas

These are from 046's section 11, step 9. Each needs its own decision.

- **The leader on each card.** The Arcade's wall could show each game's top
  score on its card.
- **Tables in attract mode.** A card playing live could show its table
  between runs, as a cabinet did.
- **Crumb Chase's ties.** Every win scores 2520, so its table fills with
  ties, ordered by who got there first. A time bonus on winning would fix
  it, but changes the game.
- **A score for Dojo Duel.** It has no table, because a match is only won
  or lost. A points difference, or a win streak, would need a change to its
  model.
- **Replay checks.** The Worker cannot tell an earned score from a typed
  one. It could replay a run (its seed, its frame times and its inputs)
  through the game's model and recompute the score. Only Neon Monsoon uses
  seeded random numbers today. See 046 section 8.3.

### A lint rule for imports into `src/`

The Worker's code once imported `'../src/highscores'` from outside `src/`.
Lint did not catch it, because the barrel-import rules cover only files
under `packages/*/src/`. It now uses the `#highscores` import mapping. A
rule that stops a file outside a package's `src/` importing into it with a
relative path would catch the next one.

## Acceptance Criteria

- [ ] Each game configures its own table, and the Worker's list of games
      comes from the games, or the item is dropped.
- [ ] The caps are decided: one for every game, or kept as they are.
- [ ] Each Worker has an admin token, and the test row is gone, or both are
      left as they are on purpose.
- [ ] Each later idea is built, or dropped.
- [ ] Lint stops relative imports into a package's `src/` from outside it,
      or the item is dropped.

## Progress Log

- **2026-10-15.** Created from 046's loose ends, as 046 was archived. The
  first item is the owner's, from reviewing `GAMES` during the hand-over.
